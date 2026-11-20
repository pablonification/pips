// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// The form builder's tables and queries (migration 0035): forms made before the builder count as published; short
// names are unique; sharing is one row per person; deleting a member or a form takes what hangs on it; Data diri is
// one row per member; a breaking edit strips answers in one go; the responses one by one keep their numbers.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;

function throwawayUrl(): string {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required: a throwaway local database named pips_test*',
    );
  }
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (
    !name.startsWith('pips_test') ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error(
      'TEST_DATABASE_URL must be a local database named pips_test*',
    );
  }
  return url;
}

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;
let schema: typeof import('../../src/db/schema');
let repo: typeof import('../../src/repositories/form.repo');

const USERS = [
  ['fb-dimas', '13523905', 2023],
  ['fb-aulia', '13524905', 2024],
  ['fb-nadia', '13525905', 2025],
  ['fb-bima', '13525906', 2025],
] as const;
const SLUGS = ['fb-old-form', 'fb-makrab', 'fb-taken', 'fb-gone'];

const sections = [
  {
    id: 's1',
    title: '',
    questions: [
      {
        id: 'q1',
        label: 'Bisa ikut?',
        type: 'radio' as const,
        options: ['Ya', 'Tidak'],
      },
      { id: 'q2', label: 'Jam berapa?', type: 'time' as const },
    ],
  },
];

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray } = await import('drizzle-orm');
  schema = await import('../../src/db/schema');
  repo = await import('../../src/repositories/form.repo');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.delete(schema.forms).where(inArray(schema.forms.slug, SLUGS));
  await db.delete(schema.users).where(
    inArray(
      schema.users.id,
      USERS.map(([id]) => id),
    ),
  );
  for (const year of [2023, 2024, 2025])
    await db
      .insert(schema.angkatan)
      .values({ year, name: `fb-${year}` })
      .onConflictDoNothing();
  await db.insert(schema.users).values(
    USERS.map(([id, nim, year]) => ({
      id,
      nim,
      email: `${nim}@std.stei.itb.ac.id`,
      fullName: id,
      major: 'IF' as const,
      region: 'Ganesha' as const,
      angkatan: year,
      gender: 'F' as const,
      membershipStatus: 'anggota',
    })),
  );
  await db.insert(schema.userRoles).values([
    { userId: 'fb-dimas', role: 'akademik' },
    { userId: 'fb-aulia', role: 'cnb' },
  ]);
});

after(async () => {
  await client?.end();
});

test('a form made before the builder is published when it was made, and one added outside the builder is published', async () => {
  const createdAt = new Date('2025-08-01T00:00:00Z');
  await db.insert(schema.forms).values({
    slug: 'fb-old-form',
    title: 'Form lama',
    sections,
    opensAt: createdAt,
    createdAt,
  });
  // As the migration found it: the column's default gave it the time of the migration.
  const migration = readFileSync(
    path.resolve(import.meta.dirname, '../../drizzle/0035_forms_builder.sql'),
    'utf8',
  );
  const backfill = migration
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .find((s) => s.includes('UPDATE "forms" SET "published_at"'));
  const [before] = await client<{ published_at: Date }[]>`
    select published_at from forms where slug = 'fb-old-form'`;
  assert.notEqual(
    new Date(before.published_at).toISOString(),
    createdAt.toISOString(),
  );
  assert.ok(backfill, 'the migration backfills published_at');
  await client.unsafe(backfill);
  const [row] = await client<
    {
      published_at: Date;
      owner_id: string | null;
      requested_fields: string[];
    }[]
  >`select published_at, owner_id, requested_fields from forms where slug = 'fb-old-form'`;
  assert.equal(
    new Date(row.published_at).toISOString(),
    createdAt.toISOString(),
  );
  assert.equal(row.owner_id, null);
  assert.deepEqual(row.requested_fields, []);
  // Members still see it; a draft (no opening time, no publishing time) is never listed.
  const draft = await repo.createForm(db, {
    slug: 'fb-makrab',
    title: 'Daftar Makrab',
    sections,
    ownerId: 'fb-dimas',
    opensAt: null,
    isActive: false,
    publishedAt: null,
  });
  const active = (await repo.getActiveForms(db)).map((f) => f.slug);
  assert.ok(active.includes('fb-old-form'));
  assert.ok(!active.includes('fb-makrab'));
  assert.equal(draft.opensAt, null);
  assert.equal(draft.publishedAt, null);
});

test('short names are unique: one form holds a name at a time', async () => {
  const taken = await repo.createForm(db, {
    slug: 'fb-taken',
    title: 'Ambil nama',
    sections,
    ownerId: 'fb-aulia',
    opensAt: null,
    isActive: false,
    publishedAt: null,
  });
  await assert.rejects(
    repo.updateForm(db, taken.id, { slug: 'fb-makrab' }),
    (e: { code?: string }) => e.code === '23505',
  );
  assert.equal(await repo.slugTaken(db, 'fb-makrab', taken.id), true);
  const makrab = await repo.getFormBySlug(db, 'fb-makrab');
  assert.equal(await repo.slugTaken(db, 'fb-makrab', makrab!.id), false);
  // Renamed: the old name is free for another form.
  await repo.updateForm(db, makrab!.id, { slug: 'fb-gone' });
  assert.equal(await repo.slugTaken(db, 'fb-makrab', null), false);
  await repo.updateForm(db, makrab!.id, { slug: 'fb-makrab' });
});

test('sharing: one row per person, a new role replaces the old, and the lists say who is who', async () => {
  const makrab = (await repo.getFormBySlug(db, 'fb-makrab'))!;
  await repo.setCollaborator(db, makrab.id, 'fb-aulia', 'view');
  await repo.setCollaborator(db, makrab.id, 'fb-aulia', 'edit');
  const list = await repo.listCollaborators(db, makrab.id);
  assert.deepEqual(
    list.map((p) => [p.person.id, p.role]),
    [['fb-aulia', 'edit']],
  );
  assert.equal(await repo.getFormRelation(db, makrab, 'fb-dimas'), 'owner');
  assert.equal(await repo.getFormRelation(db, makrab, 'fb-aulia'), 'edit');
  assert.equal(await repo.getFormRelation(db, makrab, 'fb-nadia'), null);
  const aulias = await repo.listManagedForms(db, 'fb-aulia', 'mine');
  assert.deepEqual(
    aulias.map((f) => [f.form.slug, f.relation, f.owner?.id]).sort(),
    [
      ['fb-makrab', 'edit', 'fb-dimas'],
      ['fb-taken', 'owner', 'fb-aulia'],
    ],
  );
  const all = await repo.listManagedForms(db, 'fb-nadia', 'all');
  assert.ok(all.some((f) => f.form.slug === 'fb-old-form' && f.owner === null));
  assert.equal(await repo.isPengurus(db, 'fb-aulia'), true);
  assert.equal(await repo.isPengurus(db, 'fb-nadia'), false);
  const found = await repo.searchPeople(db, '1352590');
  assert.deepEqual(
    found.map((p) => [p.id, p.isPengurus]),
    [
      ['fb-bima', false],
      ['fb-nadia', false],
    ],
  );
  assert.equal(await repo.removeCollaborator(db, makrab.id, 'fb-aulia'), true);
  assert.equal(await repo.removeCollaborator(db, makrab.id, 'fb-aulia'), false);
});

test('Data diri: one row per member; null clears, a missing key keeps', async () => {
  await repo.saveMemberDetails(db, 'fb-nadia', {
    whatsapp: '0812-5550-0945',
    emergencyContact: {
      name: 'Ratna',
      relation: 'Ibu',
      phone: '0813-5550-0911',
    },
    birthDate: '2007-03-14',
  });
  await repo.saveMemberDetails(db, 'fb-nadia', {
    whatsapp: null,
    line: 'nadia.id',
  });
  const d = await repo.getMemberDetails(db, 'fb-nadia');
  assert.equal(d.whatsapp, null);
  assert.equal(d.line, 'nadia.id');
  assert.equal(d.birthDate, '2007-03-14');
  assert.deepEqual(d.emergencyContact, {
    name: 'Ratna',
    relation: 'Ibu',
    phone: '0813-5550-0911',
  });
  await repo.saveMemberDetails(db, 'fb-nadia', { emergencyContact: null });
  assert.equal(
    (await repo.getMemberDetails(db, 'fb-nadia')).emergencyContact,
    null,
  );
  const [{ n }] = await client<{ n: number }[]>`
    select count(*)::int as n from member_details where user_id = 'fb-nadia'`;
  assert.equal(n, 1);
  assert.deepEqual(
    (await repo.getMemberDetails(db, 'fb-bima')).whatsapp,
    null,
    'a member who never saved anything',
  );
});

test('responses: one per member, the profile kept as sent, numbered oldest first, changed in place', async () => {
  const makrab = (await repo.getFormBySlug(db, 'fb-makrab'))!;
  const first = await repo.createFormResponse(db, makrab.id, 'fb-nadia', {
    answers: [
      { questionId: 'q1', answer: 'Ya' },
      { questionId: 'q2', answer: '19:30' },
    ],
    profile: { fullName: 'fb-nadia', nim: '13525905' },
  });
  await repo.createFormResponse(db, makrab.id, 'fb-bima', {
    answers: [{ questionId: 'q1', answer: 'Tidak' }],
    profile: { fullName: 'fb-bima' },
  });
  await assert.rejects(
    repo.createFormResponse(db, makrab.id, 'fb-nadia', { answers: [] }),
    (e: { code?: string }) => e.code === '23505',
  );
  const page = await repo.getResponsesPage(db, makrab.id, 2, 1);
  assert.equal(page.total, 2);
  assert.equal(page.responses[0].number, 2);
  assert.deepEqual(page.responses[0].profile, { fullName: 'fb-bima' });
  assert.equal('userId' in page.responses[0], false);
  const changed = await repo.updateFormResponse(db, first.id, {
    answers: [{ questionId: 'q1', answer: 'Tidak' }],
    profile: first.profile,
  });
  assert.ok(changed.updatedAt instanceof Date);
  assert.equal(
    (await repo.getResponsesPage(db, makrab.id, 1, 1)).responses[0].id,
    first.id,
    'a change keeps its place',
  );
  assert.equal(
    (await repo.getResponseCounts(db, [makrab.id])).get(makrab.id),
    2,
  );
  assert.equal((await repo.countAudience(db, [2025])) >= 2, true);
});

test('a confirmed breaking edit saves the form and strips the lost answers from every response at once', async () => {
  const makrab = (await repo.getFormBySlug(db, 'fb-makrab'))!;
  await repo.createFormResponse(db, makrab.id, 'fb-aulia', {
    answers: [
      { questionId: 'q1', answer: 'Ya' },
      { questionId: 'q2', answer: '20:00' },
    ],
  });
  await repo.updateFormDroppingAnswers(
    db,
    makrab.id,
    { sections: [{ ...sections[0], questions: [sections[0].questions[0]] }] },
    ['q2'],
  );
  const rows = await repo.getResponsesForSummary(db, makrab.id);
  assert.ok(rows.length >= 2);
  for (const r of rows)
    assert.deepEqual(
      r.answers.map((a) => a.questionId),
      ['q1'],
    );
});

test('deleting a member keeps their form (no owner) and drops their shares; deleting a form drops its answers', async () => {
  const taken = (await repo.getFormBySlug(db, 'fb-taken'))!;
  const makrab = (await repo.getFormBySlug(db, 'fb-makrab'))!;
  await repo.setCollaborator(db, makrab.id, 'fb-aulia', 'view');
  const { eq } = await import('drizzle-orm');
  await db.delete(schema.users).where(eq(schema.users.id, 'fb-aulia'));
  assert.equal((await repo.getFormById(db, taken.id))!.ownerId, null);
  assert.deepEqual(await repo.listCollaborators(db, makrab.id), []);
  await repo.deleteForm(db, makrab.id);
  assert.equal(await repo.getFormResponsesCount(db, makrab.id), 0);
  const [{ n }] = await client<{ n: number }[]>`
    select count(*)::int as n from form_responses where form_id = ${makrab.id}`;
  assert.equal(n, 0);
});
