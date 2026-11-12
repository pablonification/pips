// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// A post for other angkatan must stay out of the feed and also not open by its link, as the composer promises:
// "Pengumuman ini hanya terlihat oleh mereka".
import { strict as assert } from 'node:assert';
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

const USERS = [
  ['ia-raka', '13524901', 2024],
  ['ia-nadia', '13525901', 2025],
  ['ia-dimas', '13523901', 2023],
] as const;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray } = await import('drizzle-orm');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.delete(schema.users).where(
    inArray(
      schema.users.id,
      USERS.map(([id]) => id),
    ),
  );
  for (const [year, name] of [
    [2023, 'ia-2023'],
    [2024, 'ia-2024'],
    [2025, 'ia-PIXEL'],
  ] as const)
    await db
      .insert(schema.angkatan)
      .values({ year, name })
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
      gender: 'M' as const,
      membershipStatus: 'anggota',
    })),
  );
  const years = await db.select().from(schema.angkatan);
  const idOf = (year: number) => years.find((a) => a.year === year)!.id;
  // Raka (2024) posts for PIXEL (2025) only, and once for everyone.
  await db.insert(schema.infos).values([
    {
      id: 'ia-pixel',
      creatorId: 'ia-raka',
      title: 'Untuk PIXEL',
      content: 'Hanya untuk angkatan 2025.',
      isForAngkatan: true,
      isForGroups: false,
    },
    {
      id: 'ia-dpp',
      creatorId: 'ia-raka',
      title: 'Untuk DPP',
      content: 'Hanya untuk DPP.',
      isForAngkatan: false,
      isForGroups: true,
    },
    {
      id: 'ia-all',
      creatorId: 'ia-raka',
      title: 'Untuk semua',
      content: 'Untuk semua anggota.',
      isForAngkatan: false,
      isForGroups: false,
    },
  ]);
  await db
    .insert(schema.infoAngkatan)
    .values({ infoId: 'ia-pixel', angkatanId: idOf(2025) });
  await db.insert(schema.infoGroups).values({ infoId: 'ia-dpp', role: 'dpp' });
  await db.insert(schema.comments).values([
    {
      id: 'ia-pixel-comment',
      repliedInfoId: 'ia-pixel',
      creatorId: 'ia-nadia',
      content: 'Komentar untuk PIXEL.',
    },
    {
      id: 'ia-dpp-comment',
      repliedInfoId: 'ia-dpp',
      creatorId: 'ia-raka',
      content: 'Komentar untuk DPP.',
    },
  ]);
  await db.insert(schema.reactions).values([
    { infoId: 'ia-pixel', creatorId: 'ia-nadia', reaction: 'haha' },
    { commentId: 'ia-pixel-comment', creatorId: 'ia-raka', reaction: 'haha' },
  ]);
});

after(async () => {
  if (db) {
    const schema = await import('../../src/db/schema');
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.users).where(
      inArray(
        schema.users.id,
        USERS.map(([id]) => id),
      ),
    );
  }
  await client?.end();
  await (await import('../../src/db/drizzle')).closeDatabase();
});

test('a post for one angkatan opens for that angkatan and its author, not for another angkatan', async () => {
  const { getInfoById } = await import('../../src/repositories/info.repo');
  const open = async (user: string, year: number | undefined) =>
    (await getInfoById(db, 'ia-pixel', user, year))?.id ?? null;
  assert.equal(await open('ia-nadia', 2025), 'ia-pixel');
  assert.equal(await open('ia-raka', 2024), 'ia-pixel');
  assert.equal(await open('ia-dimas', 2023), null);
  assert.equal(await open('ia-dimas', undefined), null);
});

test('a post for everyone still opens for every angkatan', async () => {
  const { getInfoById } = await import('../../src/repositories/info.repo');
  for (const [user, , year] of USERS)
    assert.equal((await getInfoById(db, 'ia-all', user, year))?.id, 'ia-all');
});

test('the feed and the link agree: another angkatan sees the post in neither', async () => {
  const { getListInfos } = await import('../../src/repositories/info.repo');
  const { ListInfoParamsSchema } = await import('../../src/types/info.types');
  const feed = async (user: string, year: number) =>
    (await getListInfos(db, ListInfoParamsSchema.parse({}), user, year))
      .map((i) => i.id)
      .filter((id) => id.startsWith('ia-'))
      .sort();
  assert.deepEqual(await feed('ia-nadia', 2025), ['ia-all', 'ia-pixel']);
  assert.deepEqual(await feed('ia-raka', 2024), ['ia-all', 'ia-pixel']);
  assert.deepEqual(await feed('ia-dimas', 2023), ['ia-all']);
});

test("a post's comments and reactions follow its audience: 404 for another angkatan, as the post itself", async () => {
  const { createApp } = await import('../../src/app');
  const { sessionCookie, testUser } = await import('../support/session');
  const app = createApp();
  const as =
    (id: string, nim: string, angkatan: number) =>
    async (method: string, path: string, body?: unknown) =>
      (
        await app.request(`/api${path}`, {
          method,
          headers: {
            Origin: 'http://localhost:5173',
            Cookie: await sessionCookie(testUser(id, { nim, angkatan })),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        })
      ).status;
  const dimas = as('ia-dimas', '13523901', 2023);
  const nadia = as('ia-nadia', '13525901', 2025);

  const calls: Array<[string, string, unknown?]> = [
    ['GET', '/info/ia-pixel'],
    ['GET', '/comments?infoId=ia-pixel'],
    ['GET', '/comment/ia-pixel-comment'],
    ['GET', '/reaction?infoId=ia-pixel'],
    ['GET', '/reaction?commentId=ia-pixel-comment'],
    ['POST', '/comment', { repliedInfoId: 'ia-pixel', content: 'Halo' }],
    ['PUT', '/reaction', { infoId: 'ia-pixel', reaction: 'fire' }],
    ['PUT', '/reaction', { commentId: 'ia-pixel-comment', reaction: 'fire' }],
  ];
  // A post for a group the member isn't in: the same.
  const forGroup: Array<[string, string, unknown?]> = [
    ['GET', '/info/ia-dpp'],
    ['GET', '/comments?infoId=ia-dpp'],
    ['GET', '/comment/ia-dpp-comment'],
    ['GET', '/reaction?infoId=ia-dpp'],
    ['POST', '/comment', { repliedInfoId: 'ia-dpp', content: 'Halo' }],
    ['PUT', '/reaction', { infoId: 'ia-dpp', reaction: 'fire' }],
  ];
  for (const [method, path, body] of forGroup)
    assert.equal(await nadia(method, path, body), 404, `${method} ${path}`);
  for (const [method, path, body] of calls)
    assert.equal(await dimas(method, path, body), 404, `${method} ${path}`);
  const { eq } = await import('drizzle-orm');
  const schema = await import('../../src/db/schema');
  assert.equal(
    (
      await db
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.creatorId, 'ia-dimas'))
    ).length,
    0,
    'nothing saved',
  );
  assert.equal(
    (
      await db
        .select()
        .from(schema.reactions)
        .where(eq(schema.reactions.creatorId, 'ia-dimas'))
    ).length,
    0,
    'nothing saved',
  );

  // The post's own audience still gets everything.
  for (const [method, path, body] of calls)
    assert.ok(
      [200, 201].includes(await nadia(method, path, body)),
      `${method} ${path}`,
    );
});
