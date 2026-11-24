// The e2e harness answers the form builder's routes and the member's new form routes as the API does
// (apps/api/src/controllers/form.controller.ts, form-manage.controller.ts), from the prototype's sample forms.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type {
  AccessCandidates,
  BreakingEdit,
  FormAccessList,
  FormAnswers,
  FormDetail,
  FormLink,
  FormListItem,
  FormResponse,
  FormSummary,
  ManageForm,
  ManageFormListItem,
  MissingFields,
  MyDetails,
  PublishProblems,
  SlugCheck,
} from '../src/api/generated';
import { buildDb, type Db } from '../e2e/fixtures/api';
import { defaultHandlers } from '../e2e/support/handlers';
import type { MockRequest } from '../e2e/support/mock';
import * as writes from '../e2e/support/writes';

interface Options {
  params?: Record<string, string>;
  query?: string;
  body?: unknown;
}
interface Answered {
  status: number;
  body: unknown;
  kind: string;
}

/** The handler's answer: a reply's status and body, or a plain object as a 200 JSON answer. */
async function call(
  handler: (req: MockRequest) => unknown,
  db: Db,
  { params = {}, query = '', body }: Options = {},
): Promise<Answered> {
  const out = await handler({
    db,
    params,
    query: new URLSearchParams(query),
    body,
  } as unknown as MockRequest);
  const reply = out as Partial<Answered>;
  return typeof reply.kind === 'string'
    ? (reply as Answered)
    : { status: 200, body: out, kind: 'json' };
}
/** The body of an answer, typed as the generated client types it. */
async function read<T>(
  handler: (req: MockRequest) => unknown,
  db: Db,
  options?: Options,
): Promise<T> {
  return (await call(handler, db, options)).body as T;
}
/** The byte-order mark the CSV starts with, so Excel reads it as UTF-8. */
const BOM = String.fromCharCode(0xfeff);
const get = (route: string) => defaultHandlers[`GET ${route}`];
const statusOf = async (
  handler: (req: MockRequest) => unknown,
  db: Db,
  options?: Options,
) => (await call(handler, db, options)).status;

test('Kelola › Form for Raka (admin): his forms and those shared with him, then every form', async () => {
  const db = buildDb('pengurus');
  const mine = await read<{ forms: ManageFormListItem[] }>(
    get('/api/form/manage/list'),
    db,
  );
  assert.deepEqual(
    mine.forms.map((f) => [f.id, f.access.role, f.status]).sort(),
    [
      ['belajar', 'edit', 'scheduled'],
      ['makrab', 'owner', 'open'],
      ['welpar', 'view', 'closed'],
      ['wisuda', 'owner', 'draft'],
    ],
  );
  // Admin may edit a form shared with him for Lihat jawaban: "Bisa edit".
  assert.equal(mine.forms.find((f) => f.id === 'welpar')?.access.canEdit, true);
  const all = await read<{ forms: ManageFormListItem[] }>(
    get('/api/form/manage/list'),
    db,
    { query: 'scope=all' },
  );
  assert.equal(all.forms.length, 7);
  assert.equal(all.forms.find((f) => f.id === 'pixel')?.owner, null);
});

test('without the admin role: the shared form is Lihat jawaban, and every form is refused', async () => {
  const db = buildDb('pengurus', { only: ['akademik'] });
  const welpar = await read<ManageForm>(get('/api/form/:formId/manage'), db, {
    params: { formId: 'welpar' },
  });
  assert.deepEqual(welpar.access, {
    role: 'view',
    canView: true,
    canEdit: false,
    asAdmin: false,
  });
  assert.equal(
    await statusOf(get('/api/form/manage/list'), db, { query: 'scope=all' }),
    403,
  );
  assert.equal(
    await statusOf(get('/api/form/:formId/manage'), db, {
      params: { formId: 'suara' },
    }),
    404,
  );
  assert.equal(
    await statusOf(writes.updateForm, db, {
      params: { formId: 'welpar' },
      body: { title: 'x' },
    }),
    403,
  );
});

test('a member without a role is refused the builder (401), as the API answers', async () => {
  const db = buildDb('anggota');
  assert.equal(await statusOf(get('/api/form/manage/list'), db), 401);
  assert.equal(await statusOf(writes.createForm, db, { body: {} }), 401);
});

test('the builder: the makrab form with its counts, sharing, the summary, one by one and the export', async () => {
  const db = buildDb('pengurus');
  const makrab = { params: { formId: 'makrab' } };
  const form = await read<ManageForm>(
    get('/api/form/:formId/manage'),
    db,
    makrab,
  );
  assert.equal(form.responseCount, 87);
  assert.equal(form.audience, 132);
  assert.equal(form.slug, 'makrab-2026');
  const access = await read<FormAccessList>(
    get('/api/form/:formId/access'),
    db,
    makrab,
  );
  assert.equal(access.owner?.fullName, 'Raka Pratama');
  assert.deepEqual(
    access.people.map((p) => [p.person.fullName, p.role]),
    [
      ['Aulia Rahma', 'edit'],
      ['Dimas Aditya', 'view'],
    ],
  );
  const summary = await read<FormSummary>(
    get('/api/form/:formId/answers/summary'),
    db,
    makrab,
  );
  assert.equal(summary.total, 87);
  assert.equal(summary.questions.length, 9);
  assert.ok(
    summary.questions
      .find((q) => q.questionId === 'k5')
      ?.texts?.includes('Karaoke'),
  );
  const one = await read<FormAnswers>(get('/api/form/:formId/answers'), db, {
    ...makrab,
    query: 'page=4',
  });
  assert.equal(one.total, 87);
  assert.equal(one.responses[0].number, 4);
  assert.equal('userId' in one.responses[0], false);
  assert.deepEqual(Object.keys(one.responses[0].profile), [
    'fullName',
    'nim',
    'campus',
    'whatsapp',
    'emergencyContact',
    'health',
  ]);
  const xlsx = await call(get('/api/form/:formId/answers/export'), db, makrab);
  assert.equal(xlsx.kind, 'file');
  assert.equal((xlsx.body as Buffer).subarray(0, 2).toString(), 'PK');
  const csv = await call(get('/api/form/:formId/answers/export'), db, {
    ...makrab,
    query: 'format=csv',
  });
  assert.match(
    (csv.body as Buffer).toString(),
    new RegExp(`^${BOM}Waktu kirim,Diubah,Nama,NIM,Kampus`),
  );
});

test('Bagikan: search marks who is pengurus; only pengurus are added; the owner never changes', async () => {
  const db = buildDb('pengurus');
  const search = (q: string) =>
    read<AccessCandidates>(get('/api/form/:formId/access/search'), db, {
      params: { formId: 'makrab' },
      query: `search=${q}`,
    });
  const nadia = (await search('135')).people.find(
    (p) => p.person.fullName === 'Nadia Putri',
  )!;
  assert.equal(nadia.isPengurus, false);
  const kevin = (await search('Kevin')).people[0];
  assert.equal(kevin.isPengurus, true);
  const share = (userId: string, role: string) =>
    call(writes.setFormAccess, db, {
      params: { formId: 'makrab', userId },
      body: { role },
    });
  assert.equal((await share(nadia.person.id, 'view')).status, 400);
  const added = (await share(kevin.person.id, 'view')).body as FormAccessList;
  assert.equal(added.people.length, 3);
  const owner = db.formStore.find((f) => f.id === 'makrab')!.ownerId!;
  assert.equal((await share(owner, 'view')).status, 400);
  const remove = (userId: string) =>
    call(writes.removeFormAccess, db, {
      params: { formId: 'makrab', userId },
    });
  assert.equal((await remove(owner)).status, 400);
  assert.equal(
    ((await remove(kevin.person.id)).body as FormAccessList).people.length,
    2,
  );
});

test('a new form, its title naming its link, publishing, renaming, and a breaking edit', async () => {
  const db = buildDb('pengurus');
  const created = await call(writes.createForm, db, { body: {} });
  assert.equal(created.status, 201);
  const draft = created.body as ManageForm;
  assert.equal(draft.status, 'draft');
  assert.deepEqual(draft.requestedFields, ['fullName', 'nim']);
  const id = { params: { formId: draft.id } };
  const notYet = await read<PublishProblems>(writes.publishForm, db, id);
  assert.deepEqual(notYet.problems, [
    'no_title',
    'unwritten_question',
    'one_option',
    'no_angkatan',
  ]);
  const makrab = db.formStore.find((f) => f.id === 'makrab')!;
  const titled = await read<ManageForm>(writes.updateForm, db, {
    ...id,
    body: {
      title: 'Daftar Makrab HMIF 2026',
      eligibleAngkatan: [2025],
      sections: makrab.sections,
    },
  });
  assert.equal(titled.slug, 'daftar-makrab-hmif-2026');
  const live = await read<ManageForm>(writes.publishForm, db, id);
  assert.equal(live.status, 'open');
  assert.equal(
    await statusOf(writes.renameFormSlug, db, {
      ...id,
      body: { slug: 'makrab-2026' },
    }),
    409,
  );
  assert.deepEqual(
    await read<SlugCheck>(get('/api/form/:formId/slug-check'), db, {
      ...id,
      query: 'slug=Makrab 2026',
    }),
    // Capitals stay as typed and are compared without them, as the API's shared names are.
    {
      slug: 'Makrab-2026',
      available: false,
      problem: 'taken',
      heldAs: 'makrab-2026',
      heldBy: 'form',
    },
  );

  // On a form with answers, removing a question asks first; then its answers go.
  const fewer = structuredClone(makrab.sections);
  fewer[2].questions = fewer[2].questions.filter((q) => q.id !== 'k8');
  const asked = await call(writes.updateForm, db, {
    params: { formId: 'makrab' },
    body: { sections: fewer },
  });
  assert.equal(asked.status, 409);
  assert.deepEqual((asked.body as BreakingEdit).breaking, [
    {
      questionId: 'k8',
      label: 'Mau ambil gelang peserta di sekre tanggal berapa?',
      change: 'removed',
    },
  ]);
  await call(writes.updateForm, db, {
    params: { formId: 'makrab' },
    body: { sections: fewer, confirmBreaking: true },
  });
  assert.equal(
    makrab.responses.some((r) => r.answers.some((a) => a.questionId === 'k8')),
    false,
  );
  // Hapus form: Lihat jawaban can't; the owner can, and its link then finds nothing.
  const asViewer = buildDb('pengurus', { only: ['akademik'] });
  assert.equal(
    await statusOf(writes.deleteForm, asViewer, {
      params: { formId: 'welpar' },
    }),
    403,
  );
  assert.equal(
    await statusOf(writes.deleteForm, db, { params: { formId: 'makrab' } }),
    204,
  );
  assert.equal(
    await statusOf(get('/api/form-link/:name'), db, {
      params: { name: 'makrab-2026' },
    }),
    404,
  );
});

test("Nadia's forms: the link's states, the agreement step with a missing detail, Ubah jawaban", async () => {
  const db = buildDb('anggota');
  const link = (name: string) =>
    call(get('/api/form-link/:name'), db, { params: { name } });
  assert.equal(((await link('makrab-2026')).body as FormLink).state, 'form');
  assert.equal(
    ((await link('rencana-ta-2023')).body as FormLink).state,
    'not_for_you',
  );
  assert.equal(
    (await link('daftar-panitia-wisuda-oktober')).status,
    404,
    'a draft',
  );
  assert.equal((await link('tidak-ada')).status, 404);

  const detailOf = (formId: string) =>
    call(get('/api/form/:formId'), db, { params: { formId } });
  const detail = (await detailOf('makrab')).body as FormDetail;
  assert.equal(detail.status, 'open');
  assert.deepEqual(detail.owner, { fullName: 'Raka Pratama' });
  assert.equal(detail.sections?.length, 3);
  assert.equal(
    ((await detailOf('belajar')).body as FormDetail).status,
    'not_opened',
  );
  assert.equal((await detailOf('wisuda')).status, 404);

  const answers = [
    { questionId: 'k1', answer: 'Ya, dua hari penuh' },
    { questionId: 'k3', answer: 'Langsung ke lokasi' },
    { questionId: 'k4', answer: 'Nad' },
    { questionId: 'k5', answer: ['Api unggun'] },
    { questionId: 'k6', answer: '5' },
    { questionId: 'k7', answer: '/__e2e__/media/upload-1-bukti.svg' },
    { questionId: 'k8', answer: '2026-10-20' },
  ];
  const send = (body: object) =>
    call(writes.submitForm, db, { params: { formId: 'makrab' }, body });
  const missing = await send({ answers, agreed: true });
  assert.deepEqual((missing.body as MissingFields).missing, ['health']);
  const sent = await send({
    answers,
    agreed: true,
    details: { health: 'Asma ringan' },
  });
  assert.equal(sent.status, 201);
  assert.equal((sent.body as FormResponse).profile.health, 'Asma ringan');
  assert.equal(db.memberDetails.health, 'Asma ringan', 'kept in Data diri');
  assert.equal((await send({ answers, agreed: true })).status, 409);
  const after = (await detailOf('makrab')).body as FormDetail;
  assert.equal(after.status, 'already_responded');
  assert.equal(after.canChange, true);
  const changed = await read<FormResponse>(writes.changeFormResponse, db, {
    params: { formId: 'makrab' },
    body: {
      answers: [
        ...answers.slice(1),
        { questionId: 'k1', answer: 'Belum pasti' },
      ],
      agreed: true,
    },
  });
  assert.notEqual(changed.updatedAt, null);
  const mine = await read<FormResponse>(
    get('/api/form/:formId/my-response'),
    db,
    { params: { formId: 'makrab' } },
  );
  assert.equal(
    mine.answers.find((a) => a.questionId === 'k1')?.answer,
    'Belum pasti',
  );

  // A form that requests nothing needs no agreement.
  const suara = await call(writes.submitForm, db, {
    params: { formId: 'suara' },
    body: {
      answers: [
        { questionId: 'e1', answer: '4' },
        { questionId: 'e2', answer: ['Acara angkatan'] },
      ],
    },
  });
  assert.equal(suara.status, 201);
  assert.deepEqual((suara.body as FormResponse).profile, {});
});

test('the member list shows the builder’s forms only when a test asks for them', async () => {
  const db = buildDb('anggota');
  const list = async () =>
    (await read<{ forms: FormListItem[] }>(get('/api/form'), db)).forms;
  assert.deepEqual(
    (await list()).map((f) => f.id),
    ['pixel'],
  );
  db.listStoredForms = true;
  assert.deepEqual(
    (await list()).map((f) => [f.id, f.status]),
    [
      ['pixel', 'open'],
      ['makrab', 'open'],
      ['belajar', 'not_opened'],
      ['welpar', 'closed'],
      ['suara', 'open'],
    ],
  );
});

test('Data diri: Nadia’s saved details with her account, changed in place, refused when it does not fit', async () => {
  const db = buildDb('anggota');
  const mine = await read<MyDetails>(get('/api/user/details'), db);
  assert.equal(mine.account.major, 'Teknik Informatika');
  assert.equal(mine.saved.health, null);
  assert.equal(mine.saved.emergencyContact?.relation, 'Ibu');
  const bad = await call(writes.updateMyDetails, db, {
    body: { whatsapp: '0812' },
  });
  assert.deepEqual((bad.body as { problems: object }).problems, {
    whatsapp: 'phone',
  });
  const ok = await read<MyDetails>(writes.updateMyDetails, db, {
    body: { line: null, health: ' Tidak ada ' },
  });
  assert.equal(ok.saved.line, null);
  assert.equal(ok.saved.health, 'Tidak ada');
});
