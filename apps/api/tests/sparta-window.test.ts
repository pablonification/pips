import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  ELIGIBLE_SPARTA_NIM_OVERRIDES,
  isSpartaEligible,
  SPARTA_WINDOW,
  spartaWindowFor,
} from '../src/lib/sparta-window';
import {
  DraftInternshipSubmissionSchema,
  UpsertInternshipSubmissionSchema,
} from '../src/types/internship.types';
import type { InternshipDeps } from '../src/controllers/internship.controller';
import { callRouter } from './support/router';
import { testUser } from './support/session';

const deadline = new Date('2026-08-23T16:59:00.000Z'); // Minggu 23 Agustus 2026, 23.59 WIB
const nadia = testUser('u-nadia', { nim: '13525045', angkatan: 2025 });
const raka = testUser('u-raka', { nim: '13524045', angkatan: 2024 });
const exception = testUser('u-daffa', {
  nim: ELIGIBLE_SPARTA_NIM_OVERRIDES[0],
  angkatan: 2024,
});

test('SPARTA is for angkatan 2025 and the three listed NIMs', () => {
  assert.equal(isSpartaEligible(nadia), true);
  assert.equal(isSpartaEligible(raka), false);
  assert.equal(isSpartaEligible(exception), true);
});

test('the window closed at 23.59 WIB on 23 August 2026, with no known opening', () => {
  assert.equal(SPARTA_WINDOW.closesAt.toISOString(), deadline.toISOString());
  assert.equal(SPARTA_WINDOW.opensAt, null);
  assert.equal(spartaWindowFor(nadia, deadline.getTime() - 1).status, 'open');
  assert.equal(spartaWindowFor(nadia, deadline).status, 'closed');
  assert.deepEqual(spartaWindowFor(raka, deadline), {
    opensAt: null,
    closesAt: deadline,
    status: 'closed',
    eligible: false,
  });
  // Next season, once its dates are set.
  assert.equal(
    spartaWindowFor(nadia, new Date('2027-08-01T00:00:00Z'), {
      opensAt: new Date('2027-07-01T00:00:00Z'),
      closesAt: new Date('2027-08-23T16:59:00Z'),
    }).status,
    'open',
  );
});

const full = {
  kelas: 'K01',
  idLine: 'nadia.p',
  kesibukan: [],
  choices: [1, 2, 3, 4].map((n) => ({
    divisionId: `div-${n}`,
    priorityOrder: n,
    answers: [],
  })),
};

test('a draft may be partial: empty Kelas and ID Line, 0 to 4 choices', () => {
  assert.equal(
    DraftInternshipSubmissionSchema.safeParse({
      kelas: '',
      idLine: '',
      choices: [],
    }).success,
    true,
  );
  assert.equal(
    DraftInternshipSubmissionSchema.safeParse({
      ...full,
      choices: full.choices.slice(0, 2),
    }).success,
    true,
  );
  assert.equal(DraftInternshipSubmissionSchema.safeParse(full).success, true);
  // The strict schema refuses what a draft allows.
  assert.equal(
    UpsertInternshipSubmissionSchema.safeParse({
      kelas: '',
      idLine: '',
      choices: [],
    }).success,
    false,
  );
});

test('a draft still refuses a fifth choice, a division twice, a priority twice or out of 1–4', () => {
  const bad = [
    {
      ...full,
      choices: [
        ...full.choices,
        { divisionId: 'div-5', priorityOrder: 4, answers: [] },
      ],
    },
    {
      ...full,
      choices: [full.choices[0], { ...full.choices[1], divisionId: 'div-1' }],
    },
    {
      ...full,
      choices: [full.choices[0], { ...full.choices[1], priorityOrder: 1 }],
    },
    { ...full, choices: [{ ...full.choices[0], priorityOrder: 5 }] },
    { ...full, choices: [{ ...full.choices[0], priorityOrder: 0 }] },
  ];
  for (const draft of bad)
    assert.equal(
      DraftInternshipSubmissionSchema.safeParse(draft).success,
      false,
    );
});

// --- the routes, storage and clock faked ---

let createInternshipRouter: typeof import('../src/controllers/internship.controller').createInternshipRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createInternshipRouter } =
    await import('../src/controllers/internship.controller'));
});

function world(now: Date) {
  const writes: Array<{ submit: boolean; data: unknown }> = [];
  const deps: InternshipDeps = {
    getSubmissionByUserId: async () => undefined,
    upsertSubmission: async (_user, data, submit) => {
      writes.push({ submit, data });
      return { id: 'sub-1', ...data } as never;
    },
    now: () => now,
  };
  return { router: createInternshipRouter(deps), writes };
}

const OCT_8 = new Date('2026-10-08T06:35:00.000Z');

test('GET /internship/window answers every member, eligible or not', async () => {
  const { router } = world(OCT_8);
  const forNadia = await callRouter(router, nadia, 'GET', '/internship/window');
  assert.equal(forNadia.status, 200);
  assert.deepEqual(forNadia.body, {
    opensAt: null,
    closesAt: deadline.toISOString(),
    status: 'closed',
    eligible: true,
  });
  const forRaka = await callRouter(router, raka, 'GET', '/internship/window');
  assert.equal(forRaka.status, 200);
  assert.equal(forRaka.body.eligible, false);
});

// Regression: SPARTA stayed editable after its deadline; only the client stopped it.
test('after the deadline, saving and sending are refused with 403 and nothing is written', async () => {
  const { router, writes } = world(deadline);
  assert.equal(
    (await callRouter(router, nadia, 'PUT', '/internship/submission', full))
      .status,
    403,
  );
  assert.equal(
    (
      await callRouter(
        router,
        nadia,
        'POST',
        '/internship/submission/submit',
        full,
      )
    ).status,
    403,
  );
  assert.deepEqual(writes, []);
  // Reading stays open.
  const read = await callRouter(router, nadia, 'GET', '/internship/submission');
  assert.equal(read.status, 200);
  assert.equal(read.body, null);
});

test('inside the window: a partial draft saves, a partial send is refused, a full one locks', async () => {
  const { router, writes } = world(new Date(deadline.getTime() - 60_000));
  const draft = { kelas: '', idLine: '', choices: [full.choices[0]] };
  assert.equal(
    (await callRouter(router, nadia, 'PUT', '/internship/submission', draft))
      .status,
    200,
  );
  assert.equal(
    (
      await callRouter(
        router,
        nadia,
        'POST',
        '/internship/submission/submit',
        draft,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await callRouter(
        router,
        nadia,
        'POST',
        '/internship/submission/submit',
        full,
      )
    ).status,
    200,
  );
  assert.deepEqual(
    writes.map((w) => w.submit),
    [false, true],
  );
});

test('members who are not eligible keep getting 401 from the submission routes', async () => {
  const { router } = world(new Date(deadline.getTime() - 60_000));
  assert.equal(
    (await callRouter(router, raka, 'GET', '/internship/submission')).status,
    401,
  );
  assert.equal(
    (await callRouter(router, raka, 'PUT', '/internship/submission', full))
      .status,
    401,
  );
});
