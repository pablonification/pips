// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// Regression (owner, 2026-11-03; OPEN-QUESTIONS C1): a post for other angkatan stayed out of the feed but opened by
// its link, while the composer says "Pengumuman ini hanya terlihat oleh mereka".
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
