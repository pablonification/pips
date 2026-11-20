// The form builder's routes and the member's new form routes, with storage kept in memory: who may do what (anggota,
// the owner, Edit, Lihat jawaban, another pengurus, admin), publishing, breaking edits, short names, sharing, the
// agreement step, Ubah jawaban, the link and Data diri.
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, mock, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { Form } from '../src/db/schema';
import type { FormManageDeps } from '../src/controllers/form-manage.controller';
import type { FormDeps } from '../src/controllers/form.controller';
import {
  OTHER_ANSWER,
  type FormSection,
  type SavedDetails,
} from '../src/lib/form-model';
import type { CollaboratorRole } from '../src/lib/form-model';
import { storedFileCheck } from '../src/lib/form-model';
import { EMPTY_DETAILS } from '../src/lib/member-details';
import postgres from 'postgres';
import { callRouter } from './support/router';
import { testUser, type TestUser } from './support/session';

const NOW = new Date('2026-10-08T06:35:00.000Z');
const STORE = 'https://media.example.com';

const people = {
  nadia: testUser('u-nadia', {
    fullName: 'Nadia Putri',
    nim: '13525945',
    angkatan: 2025,
  }),
  bima: testUser('u-bima', {
    fullName: 'Bima Santoso',
    nim: '13525971',
    angkatan: 2025,
  }),
  dimas: testUser('u-dimas', {
    fullName: 'Dimas Aditya',
    nim: '13523944',
    angkatan: 2023,
  }),
  aulia: testUser('u-aulia', {
    fullName: 'Aulia Rahma',
    nim: '13524910',
    angkatan: 2024,
  }),
  salsa: testUser('u-salsa', {
    fullName: 'Salsabila Rahman',
    nim: '18224931',
    angkatan: 2024,
  }),
  kevin: testUser('u-kevin', {
    fullName: 'Kevin Wijaya',
    nim: '18223962',
    angkatan: 2023,
  }),
  raka: testUser('u-raka', {
    fullName: 'Raka Pratama',
    nim: '13524987',
    angkatan: 2024,
  }),
};
const roles: Record<string, string[]> = {
  'u-dimas': ['akademik'],
  'u-aulia': ['cnb'],
  'u-salsa': ['people'],
  'u-kevin': ['techdev'],
  'u-raka': ['akademik', 'admin'],
};

const sections = (): FormSection[] => [
  {
    id: 's1',
    title: '',
    questions: [
      {
        id: 'q1',
        label: 'Bisa ikut?',
        type: 'radio',
        options: ['Ya', 'Tidak'],
      },
      {
        id: 'q2',
        label: 'Jam berapa?',
        type: 'time',
        dependsOn: { questionId: 'q1', value: 'Ya' },
      },
      {
        id: 'q3',
        label: 'Kegiatan',
        type: 'checkbox',
        options: ['Api unggun', 'Games'],
        other: true,
      },
      { id: 'q4', label: 'Bukti', type: 'file', optional: true },
    ],
  },
];

/** What the database throws on a second response by the same member (the unique key on form and member). */
function uniqueViolation() {
  const err = Object.create(postgres.PostgresError.prototype);
  err.code = '23505';
  return err;
}

interface Store {
  forms: Map<string, Form>;
  collaborators: Array<{
    formId: string;
    userId: string;
    role: CollaboratorRole;
  }>;
  responses: Array<{
    id: string;
    formId: string;
    userId: string;
    answers: any[];
    profile: Record<string, string>;
    submittedAt: Date;
    updatedAt: Date | null;
  }>;
  details: Map<string, SavedDetails>;
  announced: unknown[];
}
let store: Store;
let n = 0;

function form(over: Partial<Form> = {}): Form {
  return {
    id: `f${++n}`,
    slug: `form-${n}`,
    title: 'Daftar Makrab HMIF 2026',
    description: 'Malam keakraban angkatan 2025.',
    eligibleAngkatan: [2025],
    sections: sections(),
    opensAt: new Date('2026-10-05T03:00:00Z'),
    closesAt: new Date('2026-10-18T16:59:00Z'),
    isActive: true,
    order: 0,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    ownerId: 'u-dimas',
    publishedAt: new Date('2026-10-01T00:00:00Z'),
    requestedFields: ['fullName', 'nim'],
    allowEdit: false,
    thanks: null,
    slugCustom: false,
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  };
}

const person = (id: string) => {
  const p = Object.values(people).find((x) => x.id === id);
  return p
    ? { id: p.id, fullName: p.fullName, nim: p.nim, picture: p.picture }
    : null;
};
const relation = (f: Pick<Form, 'id' | 'ownerId'>, userId: string) =>
  f.ownerId === userId
    ? ('owner' as const)
    : (store.collaborators.find((c) => c.formId === f.id && c.userId === userId)
        ?.role ?? null);
const getRoles = async (userId: string) => (roles[userId] ?? []) as any;
const responsesOf = (formId: string) =>
  store.responses.filter((r) => r.formId === formId);

const manageDeps: FormManageDeps = {
  getUserRoles: getRoles,
  getFormById: async (id) => store.forms.get(id),
  getFormRelation: async (f, userId) => relation(f, userId),
  listManagedForms: async (userId, scope) =>
    [...store.forms.values()]
      .filter((f) => scope === 'all' || relation(f, userId) !== null)
      .map((f) => ({
        form: f,
        owner: f.ownerId ? person(f.ownerId) : null,
        relation: relation(f, userId),
        responseCount: responsesOf(f.id).length,
      })),
  createForm: async (values) => {
    const f = form({
      ...values,
      id: `f${++n}`,
      publishedAt: null,
      closesAt: null,
      description: null,
    } as Partial<Form>);
    store.forms.set(f.id, f);
    return f;
  },
  updateForm: async (id, patch) => {
    const f = { ...store.forms.get(id)!, ...patch, updatedAt: NOW } as Form;
    store.forms.set(id, f);
    return f;
  },
  updateFormDroppingAnswers: async (id, patch, lost) => {
    for (const r of responsesOf(id))
      r.answers = r.answers.filter((a) => !lost.includes(a.questionId));
    return manageDeps.updateForm(id, patch);
  },
  deleteForm: async (id) => {
    store.forms.delete(id);
    store.responses = store.responses.filter((r) => r.formId !== id);
  },
  slugTaken: async (slug, except) =>
    [...store.forms.values()].some((f) => f.slug === slug && f.id !== except),
  getPerson: async (id) => person(id),
  getFormResponsesCount: async (id) => responsesOf(id).length,
  countAudience: async (angkatan) =>
    Object.values(people).filter((p) => angkatan.includes(p.angkatan)).length,
  listCollaborators: async (formId) =>
    store.collaborators
      .filter((c) => c.formId === formId)
      .map((c) => ({ person: person(c.userId)!, role: c.role })),
  setCollaborator: async (formId, userId, role) => {
    const c = store.collaborators.find(
      (x) => x.formId === formId && x.userId === userId,
    );
    if (c) c.role = role;
    else store.collaborators.push({ formId, userId, role });
  },
  removeCollaborator: async (formId, userId) => {
    const before = store.collaborators.length;
    store.collaborators = store.collaborators.filter(
      (c) => !(c.formId === formId && c.userId === userId),
    );
    return store.collaborators.length < before;
  },
  isPengurus: async (id) => (roles[id] ?? []).length > 0,
  searchPeople: async (q) =>
    Object.values(people)
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q.toLowerCase()) ||
          p.nim.includes(q),
      )
      .map((p) => ({
        ...person(p.id)!,
        isPengurus: (roles[p.id] ?? []).length > 0,
      })),
  getResponsesForSummary: async (id) => responsesOf(id),
  getResponsesPage: async (id, page, limit) => ({
    responses: responsesOf(id)
      .map((r, i) => ({ ...r, number: i + 1 }))
      .slice((page - 1) * limit, page * limit)
      .map(({ id, number, submittedAt, updatedAt, profile, answers }) => ({
        id,
        number,
        submittedAt,
        updatedAt,
        profile,
        answers,
      })),
    total: responsesOf(id).length,
  }),
};

const memberDeps: FormDeps = {
  getActiveForms: async () =>
    [...store.forms.values()].filter((f) => f.isActive && f.publishedAt),
  getFormById: async (id) => store.forms.get(id),
  getFormBySlug: async (slug) =>
    [...store.forms.values()].find((f) => f.slug === slug),
  getFormRelation: async (f, userId) => relation(f, userId),
  getOwnerName: async (id) => {
    const p = person(id);
    return p && { fullName: p.fullName };
  },
  getResponseByUserId: async (formId, userId) =>
    store.responses.find((r) => r.formId === formId && r.userId === userId),
  createFormResponse: async (formId, userId, data) => {
    if (
      store.responses.some((r) => r.formId === formId && r.userId === userId)
    ) {
      throw uniqueViolation();
    }
    const r = {
      id: `r${++n}`,
      formId,
      userId,
      answers: data.answers,
      profile: data.profile ?? {},
      submittedAt: NOW,
      updatedAt: null,
    };
    store.responses.push(r);
    return r;
  },
  updateFormResponse: async (id, data) => {
    const r = store.responses.find((x) => x.id === id)!;
    Object.assign(r, data, { updatedAt: NOW });
    return r;
  },
  getFormResponsesCount: async (id) => responsesOf(id).length,
  getFormResponsesList: async () => ({ responses: [], total: 0 }),
  getFormResponsesForAnalytics: async () => [],
  getMemberDetails: async (id) => store.details.get(id) ?? { ...EMPTY_DETAILS },
  saveMemberDetails: async (id, change) => {
    store.details.set(id, {
      ...(store.details.get(id) ?? EMPTY_DETAILS),
      ...change,
    });
  },
  getUserRoles: getRoles,
  isStoredFile: storedFileCheck((url) => url.startsWith(`${STORE}/`)),
  announceResponse: (_id, event) => store.announced.push(event),
};

let manage: {
  request: (p: string, i?: RequestInit) => Response | Promise<Response>;
};
let member: typeof manage;
before(async () => {
  usePlaceholderEnv();
  const { createFormManageRouter } =
    await import('../src/controllers/form-manage.controller');
  const { createFormRouter } =
    await import('../src/controllers/form.controller');
  manage = createFormManageRouter(manageDeps);
  member = createFormRouter(memberDeps);
  mock.timers.enable({ apis: ['Date'], now: NOW });
});
after(() => mock.timers.reset());

let makrab: Form;
beforeEach(() => {
  store = {
    forms: new Map(),
    collaborators: [],
    responses: [],
    details: new Map(),
    announced: [],
  };
  makrab = form({ slug: 'makrab-2026' });
  store.forms.set(makrab.id, makrab);
  store.collaborators.push(
    { formId: makrab.id, userId: 'u-aulia', role: 'edit' },
    { formId: makrab.id, userId: 'u-salsa', role: 'view' },
  );
});

const as = (who: TestUser, method: string, path: string, body?: unknown) =>
  callRouter(manage, who, method, path, body);
const asMember = (
  who: TestUser,
  method: string,
  path: string,
  body?: unknown,
) => callRouter(member, who, method, path, body);

test('who sees a form in the builder: owner, Edit, Lihat jawaban, admin; not another pengurus; not anggota', async () => {
  const path = `/form/${makrab.id}/manage`;
  const res = (who: TestUser) => as(who, 'GET', path);
  const owner = await res(people.dimas);
  assert.equal(owner.status, 200);
  assert.deepEqual(owner.body.access, {
    role: 'owner',
    canView: true,
    canEdit: true,
    asAdmin: false,
  });
  assert.equal(owner.body.owner.fullName, 'Dimas Aditya');
  assert.equal(owner.body.audience, 2);
  assert.equal(owner.body.status, 'open');
  assert.equal((await res(people.aulia)).body.access.canEdit, true);
  const viewer = await res(people.salsa);
  assert.equal(viewer.status, 200);
  assert.equal(viewer.body.access.canEdit, false);
  const admin = await res(people.raka);
  assert.deepEqual(admin.body.access, {
    role: null,
    canView: true,
    canEdit: true,
    asAdmin: true,
  });
  assert.equal((await res(people.kevin)).status, 404);
  assert.equal((await res(people.nadia)).status, 401);
});

test('Kelola › Form: mine and shared, and every form only for admin', async () => {
  const other = form({ ownerId: 'u-kevin', slug: 'kevin-form' });
  store.forms.set(other.id, other);
  const list = (who: TestUser, scope = 'mine') =>
    as(who, 'GET', `/form/manage/list?scope=${scope}`);
  const salsa = await list(people.salsa);
  assert.deepEqual(
    salsa.body.forms.map((f: any) => [f.id, f.access.role, f.owner.fullName]),
    [[makrab.id, 'view', 'Dimas Aditya']],
  );
  assert.equal((await list(people.kevin)).body.forms.length, 1);
  assert.equal((await list(people.kevin, 'all')).status, 403);
  const all = await list(people.raka, 'all');
  assert.equal(all.body.forms.length, 2);
  assert.equal(all.body.forms[0].access.canEdit, true);
  assert.equal((await list(people.nadia)).status, 401);
});

test('editing: owner, Edit and admin save; Lihat jawaban gets 403; another pengurus 404', async () => {
  const path = `/form/${makrab.id}`;
  for (const who of [people.dimas, people.aulia, people.raka]) {
    const res = await as(who, 'PATCH', path, { title: `Oleh ${who.fullName}` });
    assert.equal(res.status, 200, who.id);
  }
  assert.equal(store.forms.get(makrab.id)!.title, 'Oleh Raka Pratama');
  assert.equal(
    (await as(people.salsa, 'PATCH', path, { title: 'x' })).status,
    403,
  );
  assert.equal(
    (await as(people.kevin, 'PATCH', path, { title: 'x' })).status,
    404,
  );
  assert.equal(
    (await as(people.nadia, 'PATCH', path, { title: 'x' })).status,
    401,
  );
});

test('a definition that does not fit is refused with 400 and nothing changes', async () => {
  const bad = sections();
  bad[0].questions[1].dependsOn = { questionId: 'q3', value: 'Games' };
  const res = await as(people.dimas, 'PATCH', `/form/${makrab.id}`, {
    sections: bad,
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /earlier/);
  assert.deepEqual(store.forms.get(makrab.id)!.sections, sections());
});

test('a breaking edit on a form with answers asks first, then drops those answers for good', async () => {
  store.responses.push({
    id: 'r-old',
    formId: makrab.id,
    userId: 'u-nadia',
    answers: [
      { questionId: 'q1', answer: 'Ya' },
      { questionId: 'q2', answer: '19:30' },
      { questionId: 'q3', answer: ['Games'] },
    ],
    profile: {},
    submittedAt: NOW,
    updatedAt: null,
  });
  const next = sections();
  next[0].questions.splice(1, 1); // q2 removed
  next[0].questions[0].type = 'dropdown'; // keeps answers
  const asked = await as(people.aulia, 'PATCH', `/form/${makrab.id}`, {
    sections: next,
  });
  assert.equal(asked.status, 409);
  assert.deepEqual(asked.body.breaking, [
    { questionId: 'q2', label: 'Jam berapa?', change: 'removed' },
  ]);
  assert.equal(asked.body.responseCount, 1);
  assert.equal(store.forms.get(makrab.id)!.sections[0].questions.length, 4);

  const done = await as(people.aulia, 'PATCH', `/form/${makrab.id}`, {
    sections: next,
    confirmBreaking: true,
  });
  assert.equal(done.status, 200);
  assert.deepEqual(
    store.responses[0].answers.map((a) => a.questionId),
    ['q1', 'q3'],
  );
});

test('wording and compatible kinds go through without asking, answers or not', async () => {
  store.responses.push({
    id: 'r',
    formId: makrab.id,
    userId: 'u-nadia',
    answers: [],
    profile: {},
    submittedAt: NOW,
    updatedAt: null,
  });
  const next = sections();
  next[0].questions[0].label = 'Bisa ikut dua hari?';
  next[0].questions[0].type = 'checkbox';
  assert.equal(
    (await as(people.dimas, 'PATCH', `/form/${makrab.id}`, { sections: next }))
      .status,
    200,
  );
});

test('a new form: a draft owned by its maker, Nama and NIM ticked, one question ready; any pengurus, never anggota', async () => {
  const res = await as(people.kevin, 'POST', '/form', {});
  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'draft');
  assert.equal(res.body.owner.id, 'u-kevin');
  assert.deepEqual(res.body.requestedFields, ['fullName', 'nim']);
  assert.equal(res.body.sections[0].questions.length, 1);
  assert.equal(res.body.slug, 'form-baru');
  assert.equal(
    store.forms.get(res.body.id)!.isActive,
    false,
    'old apps list active forms; a draft is not',
  );
  assert.equal((await as(people.nadia, 'POST', '/form', {})).status, 401);
  // A second untitled draft gets the next free name.
  assert.equal(
    (await as(people.kevin, 'POST', '/form', {})).body.slug,
    'form-baru-2',
  );
});

test("a draft's short name follows its title until someone chooses one", async () => {
  const draft = (await as(people.kevin, 'POST', '/form', {})).body;
  const titled = await as(people.kevin, 'PATCH', `/form/${draft.id}`, {
    title: 'Daftar panitia Wisuda Oktober',
  });
  assert.equal(titled.body.slug, 'daftar-panitia-wisuda-oktober');
  await as(people.kevin, 'PUT', `/form/${draft.id}/slug`, {
    slug: 'wisuda-okt',
  });
  const retitled = await as(people.kevin, 'PATCH', `/form/${draft.id}`, {
    title: 'Panitia Wisuda',
  });
  assert.equal(retitled.body.slug, 'wisuda-okt');
});

test('publishing: what stops it, then open now with its name', async () => {
  const draft = (await as(people.kevin, 'POST', '/form', {})).body;
  const notYet = await as(people.kevin, 'POST', `/form/${draft.id}/publish`);
  assert.equal(notYet.status, 400);
  assert.deepEqual(notYet.body.problems, [
    'no_title',
    'unwritten_question',
    'one_option',
    'no_angkatan',
  ]);
  await as(people.kevin, 'PATCH', `/form/${draft.id}`, {
    title: 'Daftar Makrab HMIF 2026',
    sections: sections(),
    eligibleAngkatan: [2025],
  });
  const published = await as(people.kevin, 'POST', `/form/${draft.id}/publish`);
  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'open');
  assert.equal(published.body.opensAt, NOW.toISOString());
  assert.equal(published.body.isActive, true);
  assert.equal(published.body.slug, 'daftar-makrab-hmif-2026');
  assert.equal(
    (await as(people.kevin, 'POST', `/form/${draft.id}/publish`)).status,
    409,
  );
  const viewerTry = await as(
    people.salsa,
    'POST',
    `/form/${makrab.id}/publish`,
  );
  assert.equal(viewerTry.status, 403);
});

test('a published form keeps an angkatan and an opening time, and closes after it opens', async () => {
  const path = `/form/${makrab.id}`;
  assert.equal(
    (await as(people.dimas, 'PATCH', path, { eligibleAngkatan: [] })).status,
    400,
  );
  assert.equal(
    (await as(people.dimas, 'PATCH', path, { opensAt: null })).status,
    400,
  );
  assert.equal(
    (
      await as(people.dimas, 'PATCH', path, {
        closesAt: '2026-10-04T00:00:00Z',
      })
    ).status,
    400,
  );
  // Tutup form sekarang.
  const closed = await as(people.dimas, 'PATCH', path, {
    closesAt: NOW.toISOString(),
  });
  assert.equal(closed.body.status, 'closed');
});

test('renaming the link: rules, taken names, who may; the old name is let go', async () => {
  const other = form({ ownerId: 'u-kevin', slug: 'kevin-form' });
  store.forms.set(other.id, other);
  const path = `/form/${makrab.id}/slug`;
  assert.deepEqual(
    (await as(people.dimas, 'PUT', path, { slug: 'ab' })).body.problem,
    'too_short',
  );
  assert.equal(
    (await as(people.dimas, 'PUT', path, { slug: 'mak--rab' })).status,
    400,
  );
  const taken = await as(people.dimas, 'PUT', path, { slug: 'kevin-form' });
  assert.equal(taken.status, 409);
  assert.equal(taken.body.problem, 'taken');
  assert.equal(
    (await as(people.salsa, 'PUT', path, { slug: 'makrab-seru' })).status,
    403,
  );
  const renamed = await as(people.aulia, 'PUT', path, { slug: 'Makrab Seru' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.slug, 'makrab-seru');
  assert.equal(renamed.body.slugCustom, true);
  // The old link finds nothing now; another form may take the name.
  assert.equal(
    (await asMember(people.nadia, 'GET', '/form-link/makrab-2026')).status,
    404,
  );
  assert.equal(
    (
      await as(
        people.kevin,
        'GET',
        `/form/${other.id}/slug-check?slug=makrab-2026`,
      )
    ).body.available,
    true,
  );
  const check = await as(
    people.kevin,
    'GET',
    `/form/${other.id}/slug-check?slug=Makrab Seru`,
  );
  assert.deepEqual(check.body, {
    slug: 'makrab-seru',
    available: false,
    problem: 'taken',
  });
  assert.equal(
    (await as(people.salsa, 'GET', `/form/${makrab.id}/slug-check?slug=abc`))
      .status,
    403,
  );
});

test('sharing: only pengurus are added, editors share too, nobody touches the owner', async () => {
  const path = (u: string) => `/form/${makrab.id}/access/${u}`;
  const added = await as(people.aulia, 'PUT', path('u-kevin'), {
    role: 'view',
  });
  assert.equal(added.status, 200);
  assert.deepEqual(
    added.body.people.map((p: any) => [p.person.id, p.role]),
    [
      ['u-aulia', 'edit'],
      ['u-salsa', 'view'],
      ['u-kevin', 'view'],
    ],
  );
  assert.equal(added.body.owner.id, 'u-dimas');
  assert.equal(
    (await as(people.dimas, 'PUT', path('u-nadia'), { role: 'view' })).status,
    400,
  );
  assert.equal(
    (await as(people.raka, 'PUT', path('u-dimas'), { role: 'view' })).status,
    400,
  );
  assert.equal((await as(people.raka, 'DELETE', path('u-dimas'))).status, 400);
  assert.equal(
    (await as(people.salsa, 'PUT', path('u-kevin'), { role: 'edit' })).status,
    403,
  );
  assert.equal((await as(people.salsa, 'DELETE', path('u-kevin'))).status, 403);
  const promoted = await as(people.dimas, 'PUT', path('u-kevin'), {
    role: 'edit',
  });
  assert.equal(promoted.body.people.at(-1).role, 'edit');
  const removed = await as(people.raka, 'DELETE', path('u-kevin'));
  assert.equal(removed.body.people.length, 2);
  assert.equal(
    (await as(people.dimas, 'PUT', path('u-nobody'), { role: 'view' })).status,
    404,
  );
});

test("Bagikan's search says who is pengurus and who already has access", async () => {
  const res = await as(
    people.dimas,
    'GET',
    `/form/${makrab.id}/access/search?search=a`,
  );
  assert.equal(res.status, 400, 'three characters at least');
  const found = await as(
    people.dimas,
    'GET',
    `/form/${makrab.id}/access/search?search=13525`,
  );
  assert.deepEqual(
    found.body.people.map((p: any) => [
      p.person.fullName,
      p.isPengurus,
      p.role,
    ]),
    [
      ['Nadia Putri', false, null],
      ['Bima Santoso', false, null],
    ],
  );
  const dim = await as(
    people.aulia,
    'GET',
    `/form/${makrab.id}/access/search?search=Dimas`,
  );
  assert.equal(dim.body.people[0].role, 'owner');
  assert.equal(
    (
      await as(
        people.salsa,
        'GET',
        `/form/${makrab.id}/access/search?search=Dimas`,
      )
    ).status,
    403,
  );
  assert.equal(
    (await as(people.salsa, 'GET', `/form/${makrab.id}/access`)).status,
    200,
  );
});

test('deleting a form: owner, Edit or admin; never Lihat jawaban', async () => {
  assert.equal(
    (await as(people.salsa, 'DELETE', `/form/${makrab.id}`)).status,
    403,
  );
  assert.equal(
    (await as(people.kevin, 'DELETE', `/form/${makrab.id}`)).status,
    404,
  );
  assert.equal(
    (await as(people.raka, 'DELETE', `/form/${makrab.id}`)).status,
    204,
  );
  assert.equal(store.forms.has(makrab.id), false);
});

const send = (who: TestUser, body: object, method = 'POST') =>
  asMember(who, method, `/form/${makrab.id}/response`, body);
const answers = [
  { questionId: 'q1', answer: 'Tidak' },
  { questionId: 'q3', answer: ['Games', OTHER_ANSWER], other: 'Main musik' },
];

test('the agreement step: requested fields go along only when agreed, and are kept as sent', async () => {
  assert.equal((await send(people.nadia, { answers })).status, 400);
  const res = await send(people.nadia, { answers, agreed: true });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.profile, {
    fullName: 'Nadia Putri',
    nim: '13525945',
  });
  // The live count tells the maker the name and NIM only because the form requests them.
  assert.deepEqual(store.announced, [
    { total: 1, submittedAt: NOW, nim: '13525945', fullName: 'Nadia Putri' },
  ]);
});

test('a form that requests nothing has no agreement, and tells its watchers nothing about who', async () => {
  store.forms.set(makrab.id, { ...makrab, requestedFields: [] });
  const res = await send(people.nadia, { answers });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.profile, {});
  assert.deepEqual(store.announced, [{ total: 1, submittedAt: NOW }]);
});

test('a requested saved detail never given: refused until filled at the agreement step, then kept in Data diri', async () => {
  store.forms.set(makrab.id, {
    ...makrab,
    requestedFields: ['fullName', 'whatsapp', 'emergencyContact'],
  });
  const missing = await send(people.nadia, { answers, agreed: true });
  assert.equal(missing.status, 400);
  assert.deepEqual(missing.body.missing, ['whatsapp', 'emergencyContact']);
  const badPhone = await send(people.nadia, {
    answers,
    agreed: true,
    details: {
      whatsapp: '0812',
      emergencyContact: {
        name: 'Ratna Dewi',
        relation: 'Ibu',
        phone: '0813-5550-0911',
      },
    },
  });
  assert.equal(badPhone.status, 400);
  assert.deepEqual(badPhone.body.problems, { whatsapp: 'phone' });
  assert.equal(
    store.details.has('u-nadia'),
    false,
    'nothing saved from a refused send',
  );
  const ok = await send(people.nadia, {
    answers,
    agreed: true,
    details: {
      whatsapp: ' 0812-5550-0945 ',
      emergencyContact: {
        name: 'Ratna Dewi',
        relation: 'Ibu',
        phone: '0813-5550-0911',
      },
    },
  });
  assert.equal(ok.status, 201);
  assert.deepEqual(ok.body.profile, {
    fullName: 'Nadia Putri',
    whatsapp: '0812-5550-0945',
    emergencyContact: 'Ratna Dewi (ibu) · 0813-5550-0911',
  });
  const mine = await asMember(people.nadia, 'GET', '/user/details');
  assert.equal(mine.body.saved.whatsapp, '0812-5550-0945');
});

test('answers: conditions, "Lainnya", files only from the app’s storage, hidden answers dropped', async () => {
  const hiddenKept = await send(people.nadia, {
    answers: [...answers, { questionId: 'q2', answer: '19:30' }],
    agreed: true,
  });
  assert.equal(hiddenKept.status, 201);
  assert.equal(
    hiddenKept.body.answers.some((a: any) => a.questionId === 'q2'),
    false,
  );
  const needsTime = await send(people.bima, {
    answers: [{ questionId: 'q1', answer: 'Ya' }, answers[1]],
    agreed: true,
  });
  assert.equal(needsTime.status, 400);
  assert.match(needsTime.body.error, /Jam berapa/);
  const outsideFile = await send(people.bima, {
    answers: [
      ...answers,
      { questionId: 'q4', answer: 'https://evil.example.com/x-a.pdf' },
    ],
    agreed: true,
  });
  assert.equal(outsideFile.status, 400);
});

test('one response per member; a closed form, a draft and another angkatan refuse', async () => {
  await send(people.nadia, { answers, agreed: true });
  assert.equal(
    (await send(people.nadia, { answers, agreed: true })).status,
    409,
  );
  assert.equal(
    (await send(people.dimas, { answers, agreed: true })).status,
    403,
  );
  store.forms.set(makrab.id, { ...makrab, closesAt: NOW });
  assert.equal(
    (await send(people.bima, { answers, agreed: true })).status,
    403,
  );
  store.forms.set(makrab.id, { ...makrab, publishedAt: null });
  assert.equal(
    (await send(people.bima, { answers, agreed: true })).status,
    404,
  );
  assert.equal(
    (await asMember(people.bima, 'GET', `/form/${makrab.id}`)).status,
    404,
  );
});

test('Ubah jawaban: only when the maker allows it, while open, and the response is replaced', async () => {
  await send(people.nadia, { answers, agreed: true });
  const change = {
    answers: [
      { questionId: 'q1', answer: 'Ya' },
      { questionId: 'q2', answer: '20:00' },
      answers[1],
    ],
    agreed: true,
  };
  assert.equal((await send(people.nadia, change, 'PUT')).status, 403);
  store.forms.set(makrab.id, { ...makrab, allowEdit: true });
  const detail = await asMember(people.nadia, 'GET', `/form/${makrab.id}`);
  assert.equal(detail.body.canChange, true);
  assert.equal(detail.body.status, 'already_responded');
  assert.deepEqual(detail.body.owner, { fullName: 'Dimas Aditya' });
  const changed = await send(people.nadia, change, 'PUT');
  assert.equal(changed.status, 200);
  assert.equal(changed.body.updatedAt, NOW.toISOString());
  assert.equal(store.responses.length, 1);
  assert.equal(
    (await send(people.bima, change, 'PUT')).status,
    404,
    'nothing to change',
  );
  store.forms.set(makrab.id, { ...makrab, allowEdit: true, closesAt: NOW });
  assert.equal((await send(people.nadia, change, 'PUT')).status, 403);
  assert.equal(
    (await asMember(people.nadia, 'GET', `/form/${makrab.id}`)).body.canChange,
    false,
  );
});

test('opening a link: the form, not for your angkatan, a draft only for its managers, unknown names', async () => {
  const open = (who: TestUser, name: string) =>
    asMember(who, 'GET', `/form-link/${name}`);
  assert.deepEqual((await open(people.nadia, 'makrab-2026')).body, {
    state: 'form',
    formId: makrab.id,
    title: makrab.title,
    eligibleAngkatan: [2025],
    canManage: false,
  });
  const other = await open(people.kevin, 'makrab-2026');
  assert.equal(other.body.state, 'not_for_you');
  assert.equal(other.body.canManage, false);
  assert.equal((await open(people.dimas, 'makrab-2026')).body.canManage, true);
  assert.equal((await open(people.raka, 'Makrab-2026')).body.canManage, true);
  assert.equal((await open(people.nadia, 'tidak-ada')).status, 404);
  store.forms.set(makrab.id, { ...makrab, publishedAt: null });
  assert.equal((await open(people.nadia, 'makrab-2026')).status, 404);
  assert.equal((await open(people.dimas, 'makrab-2026')).body.state, 'draft');
  // Shared once, no longer pengurus: a draft is not found.
  roles['u-salsa'] = [];
  assert.equal((await open(people.salsa, 'makrab-2026')).status, 404);
  roles['u-salsa'] = ['people'];
});

test('the Jawaban tab: summary, one by one with only the requested fields, the export', async () => {
  await send(people.nadia, { answers, agreed: true });
  await send(people.bima, {
    answers: [
      { questionId: 'q1', answer: 'Ya' },
      { questionId: 'q2', answer: '21:00' },
      { questionId: 'q3', answer: ['Games'] },
    ],
    agreed: true,
  });
  for (const who of [people.dimas, people.aulia, people.salsa, people.raka]) {
    const s = await as(who, 'GET', `/form/${makrab.id}/answers/summary`);
    assert.equal(s.status, 200, who.id);
  }
  const s = await as(people.salsa, 'GET', `/form/${makrab.id}/answers/summary`);
  assert.equal(s.body.total, 2);
  assert.equal(s.body.audience, 2);
  assert.deepEqual(s.body.questions[0].counts, [
    { value: 'Ya', count: 1 },
    { value: 'Tidak', count: 1 },
  ]);
  assert.equal(
    (await as(people.kevin, 'GET', `/form/${makrab.id}/answers/summary`))
      .status,
    404,
  );

  const one = await as(
    people.salsa,
    'GET',
    `/form/${makrab.id}/answers?page=2`,
  );
  assert.equal(one.body.total, 2);
  assert.equal(one.body.responses.length, 1);
  assert.equal(one.body.responses[0].number, 2);
  assert.deepEqual(Object.keys(one.body.responses[0]).sort(), [
    'answers',
    'id',
    'number',
    'profile',
    'submittedAt',
    'updatedAt',
  ]);
  assert.deepEqual(one.body.responses[0].profile, {
    fullName: 'Bima Santoso',
    nim: '13525971',
  });

  const res = await manage.request(`/form/${makrab.id}/answers/export`, {
    headers: {
      Cookie: await (
        await import('./support/session')
      ).sessionCookie(people.salsa),
    },
  });
  assert.equal(res.status, 200);
  assert.equal(
    res.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  assert.match(
    res.headers.get('content-disposition')!,
    /makrab-2026-jawaban\.xlsx/,
  );
  assert.equal(
    Buffer.from(await res.arrayBuffer())
      .subarray(0, 2)
      .toString(),
    'PK',
  );
  const csv = await as(
    people.raka,
    'GET',
    `/form/${makrab.id}/answers/export?format=csv`,
  );
  assert.match(csv.body, /Waktu kirim,Diubah,Nama,NIM,Bisa ikut\?/);
  assert.equal(
    (await as(people.kevin, 'GET', `/form/${makrab.id}/answers/export`)).status,
    404,
  );
  assert.equal(
    (await as(people.nadia, 'GET', `/form/${makrab.id}/answers/export`)).status,
    401,
  );
});

test('Data diri: shown with the account facts, changed in place, refused when it does not fit', async () => {
  const empty = await asMember(people.nadia, 'GET', '/user/details');
  assert.deepEqual(empty.body.account, {
    fullName: 'Nadia Putri',
    nim: '13525945',
    major: 'Teknik Informatika',
    angkatan: '2025',
    campus: 'Ganesha',
    email: 'u-nadia@example.com',
  });
  assert.deepEqual(empty.body.saved, EMPTY_DETAILS);
  const set = await asMember(people.nadia, 'PATCH', '/user/details', {
    line: 'nadiaputri.id',
    birthDate: '2007-03-14',
    photo: `${STORE}/abc-foto-diri.jpg`,
  });
  assert.equal(set.status, 200);
  assert.equal(set.body.saved.birthDate, '2007-03-14');
  const removed = await asMember(people.nadia, 'PATCH', '/user/details', {
    line: null,
  });
  assert.equal(removed.body.saved.line, null);
  assert.equal(removed.body.saved.photo, `${STORE}/abc-foto-diri.jpg`);
  const bad = await asMember(people.nadia, 'PATCH', '/user/details', {
    birthDate: '2030-01-01',
  });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body.problems, { birthDate: 'date' });
  // A field not in Data diri (an account fact) is refused, not saved.
  assert.equal(
    (await asMember(people.nadia, 'PATCH', '/user/details', { fullName: 'x' }))
      .status,
    400,
  );
});

test('Live Counting & Rekap Form serve only forms made before the builder: a new form shows only what it requested', async () => {
  const pixel = form({ ownerId: null, slug: 'pixel', requestedFields: [] });
  store.forms.set(pixel.id, pixel);
  const list = await asMember(people.raka, 'GET', '/form/admin/list');
  assert.deepEqual(
    list.body.forms.map((f: { id: string }) => f.id),
    [pixel.id],
  );
  for (const path of ['responses', 'responses/count', 'analytics']) {
    const res = await asMember(
      people.raka,
      'GET',
      `/form/${makrab.id}/${path}`,
    );
    assert.equal(res.status, 404, path);
    const ok = await asMember(people.raka, 'GET', `/form/${pixel.id}/${path}`);
    assert.equal(ok.status, 200, path);
  }
});
