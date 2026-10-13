import { strict as assert } from 'node:assert';
import { after, before, mock, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { Form } from '../src/db/schema';
import {
  EARLY_ACCESS_NIMS,
  formQuestionsVisible,
  formSectionsVisible,
  formStatus,
  sectionCount,
} from '../src/lib/form-status';
import type { FormDeps } from '../src/controllers/form.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

const opensAt = new Date('2026-09-12T06:00:00.000Z'); // Sab 12 Sep 2026, 13.00 WIB
const closesAt = new Date('2026-10-31T16:59:00.000Z');
const NOW = new Date('2026-10-08T06:35:00.000Z'); // the harness's Kamis 8 Oktober, 13.35 WIB
const nim = '13525045';

const win = (
  over: Partial<{
    opensAt: Date;
    closesAt: Date | null;
    isActive: boolean;
  }> = {},
) => ({
  opensAt,
  closesAt: null,
  isActive: true,
  ...over,
});

test('status order: already responded, closed, not opened (except early access), open', () => {
  assert.equal(
    formStatus(win(), { hasResponse: false, nim, now: NOW }),
    'open',
  );
  assert.equal(
    formStatus(win(), { hasResponse: true, nim, now: NOW }),
    'already_responded',
  );
  // Already answered wins over closed.
  assert.equal(
    formStatus(win({ isActive: false }), { hasResponse: true, nim, now: NOW }),
    'already_responded',
  );
  assert.equal(
    formStatus(win({ isActive: false }), { hasResponse: false, nim, now: NOW }),
    'closed',
  );
  assert.equal(
    formStatus(win({ closesAt }), { hasResponse: false, nim, now: closesAt }),
    'closed',
  );
  assert.equal(
    formStatus(win({ closesAt }), {
      hasResponse: false,
      nim,
      now: closesAt.getTime() - 1,
    }),
    'open',
  );
  assert.equal(
    formStatus(win(), { hasResponse: false, nim, now: opensAt.getTime() - 1 }),
    'not_opened',
  );
  assert.equal(
    formStatus(win(), { hasResponse: false, nim, now: opensAt }),
    'open',
  );
});

test('early access opens a form early, but never reopens a closed one', () => {
  const early = EARLY_ACCESS_NIMS[0];
  const before = opensAt.getTime() - 1;
  assert.equal(
    formStatus(win(), { hasResponse: false, nim: early, now: before }),
    'open',
  );
  assert.equal(
    formStatus(win({ isActive: false }), {
      hasResponse: false,
      nim: early,
      now: before,
    }),
    'closed',
  );
  assert.equal(
    formStatus(win({ closesAt }), {
      hasResponse: false,
      nim: early,
      now: closesAt,
    }),
    'closed',
  );
});

test('questions show from opening (early access too), and stay visible once closed', () => {
  assert.equal(formSectionsVisible(win(), nim, opensAt.getTime() - 1), false);
  assert.equal(
    formSectionsVisible(win(), EARLY_ACCESS_NIMS[1], opensAt.getTime() - 1),
    true,
  );
  assert.equal(formSectionsVisible(win(), nim, NOW), true);
  assert.equal(formSectionsVisible(win({ isActive: false }), nim, NOW), true);
  assert.equal(sectionCount({ sections: [1, 2, 3, 4, 5] }), 5);
});

// Regression (review M2): a form switched off before it opened counted as closed, and a closed form shows its
// questions, so they leaked before opening. Visibility depends on opening alone, as it did before this branch.
test('a switched-off form, or one whose closing time is before its opening, hides its questions until it opens', () => {
  const before = opensAt.getTime() - 1;
  assert.equal(
    formSectionsVisible(win({ isActive: false }), nim, before),
    false,
  );
  assert.equal(
    formSectionsVisible(
      win({ closesAt: new Date(opensAt.getTime() - 60_000) }),
      nim,
      before,
    ),
    false,
  );
  assert.equal(
    formSectionsVisible(win({ isActive: false }), EARLY_ACCESS_NIMS[0], before),
    true,
  );
  assert.equal(
    formSectionsVisible(win({ isActive: false }), nim, opensAt),
    true,
  );
  // The status is still closed: switched off wins over not opened.
  assert.equal(
    formStatus(win({ isActive: false }), {
      hasResponse: false,
      nim,
      now: before,
    }),
    'closed',
  );
});

// --- the routes, storage faked ---

const nadia = testUser('u-nadia', { nim, angkatan: 2025 });
const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });

function pixelForm(over: Partial<Form> = {}): Form {
  return {
    id: 'pixel',
    slug: 'pixel',
    title: 'Form PIXEL',
    description: null,
    eligibleAngkatan: [2025],
    sections: [
      {
        id: 's1',
        title: 'Data diri',
        questions: [
          { id: 'q1', label: 'Nama lengkap', type: 'text' },
          { id: 'q2', label: 'Saran', type: 'textarea', optional: true },
        ],
      },
      { id: 's2', title: 'Kesan', questions: [] },
    ],
    opensAt,
    closesAt: null,
    isActive: true,
    order: 0,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...over,
  };
}

let createFormRouter: typeof import('../src/controllers/form.controller').createFormRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createFormRouter } = await import('../src/controllers/form.controller'));
  mock.timers.enable({ apis: ['Date'], now: NOW });
});
after(() => mock.timers.reset());

function world(
  form: Form,
  responded = false,
  roles: Record<string, string[]> = {},
) {
  const saved: unknown[] = [];
  const rolesRead: string[] = [];
  const announced: unknown[] = [];
  const deps: FormDeps = {
    getActiveForms: async () => (form.isActive ? [form] : []),
    getFormById: async (id) => (id === form.id ? form : undefined),
    getResponseByUserId: async () =>
      responded
        ? {
            id: 'r1',
            formId: form.id,
            userId: nadia.id,
            answers: [],
            submittedAt: NOW,
          }
        : undefined,
    createFormResponse: async (formId, userId, data) => {
      const r = {
        id: 'new',
        formId,
        userId,
        answers: data.answers,
        submittedAt: NOW,
      };
      saved.push(r);
      return r;
    },
    getFormResponsesCount: async () => saved.length,
    getFormResponsesList: async () => ({ responses: [], total: 0 }),
    getFormResponsesForAnalytics: async () => [],
    getUserRoles: async (userId) => {
      rolesRead.push(userId);
      return (roles[userId] ?? []) as Awaited<
        ReturnType<FormDeps['getUserRoles']>
      >;
    },
    announceResponse: (_formId, event) => announced.push(event),
  };
  return { router: createFormRouter(deps), saved, announced, rolesRead };
}

const answers = { answers: [{ questionId: 'q1', answer: 'Nadia Putri' }] };

test('GET /form: status, sectionCount and closesAt on each item, no sections', async () => {
  const { router } = world(pixelForm({ closesAt }));
  const res = await callRouter(router, nadia, 'GET', '/form');
  assert.equal(res.status, 200);
  const [item] = res.body.forms;
  assert.equal(item.status, 'open');
  assert.equal(item.sectionCount, 2);
  assert.equal(item.closesAt, closesAt.toISOString());
  assert.equal('sections' in item, false);
  const forRaka = await callRouter(router, raka, 'GET', '/form');
  assert.deepEqual(forRaka.body.forms, []);
});

test('GET /form/{id}: status; sections null until opening, kept once closed', async () => {
  const notYet = await callRouter(
    world(pixelForm({ opensAt: new Date('2026-10-10T06:00:00Z') })).router,
    nadia,
    'GET',
    '/form/pixel',
  );
  assert.equal(notYet.body.status, 'not_opened');
  assert.equal(notYet.body.sections, null);

  const closed = await callRouter(
    world(pixelForm({ closesAt: new Date('2026-10-01T00:00:00Z') })).router,
    nadia,
    'GET',
    '/form/pixel',
  );
  assert.equal(closed.body.status, 'closed');
  assert.equal(closed.body.sections.length, 2);

  const offBeforeOpening = await callRouter(
    world(
      pixelForm({ opensAt: new Date('2026-12-01T06:00:00Z'), isActive: false }),
    ).router,
    nadia,
    'GET',
    '/form/pixel',
  );
  assert.equal(offBeforeOpening.body.status, 'closed');
  assert.equal(offBeforeOpening.body.sections, null);

  const done = await callRouter(
    world(pixelForm(), true).router,
    nadia,
    'GET',
    '/form/pixel',
  );
  assert.equal(done.body.status, 'already_responded');
});

// Regression: answers were accepted for a form an admin had switched off (isActive was never checked).
test('a switched-off form refuses answers with 403 and saves nothing', async () => {
  const { router, saved, announced } = world(pixelForm({ isActive: false }));
  const res = await callRouter(
    router,
    nadia,
    'POST',
    '/form/pixel/response',
    answers,
  );
  assert.equal(res.status, 403);
  assert.deepEqual(saved, []);
  assert.deepEqual(announced, []);
});

test('a form past its closing time refuses answers with 403', async () => {
  const { router, saved } = world(pixelForm({ closesAt: NOW }));
  const res = await callRouter(
    router,
    nadia,
    'POST',
    '/form/pixel/response',
    answers,
  );
  assert.equal(res.status, 403);
  assert.deepEqual(saved, []);
});

test('an open form takes answers: 201, and Live Counting hears of it', async () => {
  const { router, saved, announced } = world(pixelForm({ closesAt }));
  const res = await callRouter(
    router,
    nadia,
    'POST',
    '/form/pixel/response',
    answers,
  );
  assert.equal(res.status, 201);
  assert.equal(saved.length, 1);
  assert.equal(announced.length, 1);
});

test('not open yet, not for your angkatan, missing answers, unknown form', async () => {
  const later = world(pixelForm({ opensAt: new Date('2026-10-10T06:00:00Z') }));
  assert.equal(
    (
      await callRouter(
        later.router,
        nadia,
        'POST',
        '/form/pixel/response',
        answers,
      )
    ).status,
    403,
  );
  const { router } = world(pixelForm());
  assert.equal(
    (await callRouter(router, raka, 'POST', '/form/pixel/response', answers))
      .status,
    403,
  );
  assert.equal(
    (
      await callRouter(router, nadia, 'POST', '/form/pixel/response', {
        answers: [],
      })
    ).status,
    400,
  );
  assert.equal(
    (await callRouter(router, nadia, 'POST', '/form/nope/response', answers))
      .status,
    404,
  );
});

// P3-A, from the P2-A review: the questions went to every signed-in member who knew the form's id.
test("GET /form/{id}: questions only for the form's angkatan or a form admin", async () => {
  const w = world(pixelForm(), false, { 'u-raka': ['admin'] });
  const eligible = await callRouter(w.router, nadia, 'GET', '/form/pixel');
  assert.equal(eligible.status, 200);
  assert.equal(eligible.body.sections.length, 2);
  assert.deepEqual(w.rolesRead, [], 'an eligible member costs no roles query');

  const other = testUser('u-other', { nim: '13524099', angkatan: 2024 });
  const outside = await callRouter(w.router, other, 'GET', '/form/pixel');
  assert.equal(outside.status, 200);
  assert.equal(outside.body.sections, null);
  assert.equal(outside.body.title, pixelForm().title);
  assert.deepEqual(outside.body.eligibleAngkatan, [2025]);

  const admin = await callRouter(w.router, raka, 'GET', '/form/pixel');
  assert.equal(admin.status, 200);
  assert.equal(admin.body.sections.length, 2);

  // Another role isn't enough.
  const akademik = await callRouter(
    world(pixelForm(), false, { 'u-raka': ['akademik'] }).router,
    raka,
    'GET',
    '/form/pixel',
  );
  assert.equal(akademik.body.sections, null);
});

test('formQuestionsVisible: angkatan or admin, and never before opening', () => {
  const form = pixelForm();
  const later = pixelForm({ opensAt: new Date('2026-10-10T06:00:00Z') });
  const member = { nim: '13525001', angkatan: 2025, isFormAdmin: false };
  assert.equal(formQuestionsVisible(form, member), true);
  assert.equal(
    formQuestionsVisible(form, { ...member, angkatan: 2024 }),
    false,
  );
  assert.equal(
    formQuestionsVisible(form, {
      ...member,
      angkatan: 2024,
      isFormAdmin: true,
    }),
    true,
  );
  assert.equal(formQuestionsVisible(later, member), false);
  assert.equal(
    formQuestionsVisible(later, { ...member, isFormAdmin: true }),
    false,
  );
});
