// Runs against a real, throwaway PostgreSQL, as info-audience.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// Tandai semua dibaca: one statement marks read exactly what the member's feed shows (its groups and
// angkatan rules), leaves other members' read marks alone, and counts only what it marked now.
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
  ['ra-raka', '13524911', 2024],
  ['ra-nadia', '13525911', 2025],
  ['ra-dimas', '13523911', 2023],
] as const;
const POSTS = ['ra-all', 'ra-pixel', 'ra-akademik', 'ra-old'];

async function cleanUp() {
  const schema = await import('../../src/db/schema');
  const { inArray } = await import('drizzle-orm');
  await db.delete(schema.infos).where(inArray(schema.infos.id, POSTS));
  await db.delete(schema.users).where(
    inArray(
      schema.users.id,
      USERS.map(([id]) => id),
    ),
  );
}

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await cleanUp();
  for (const [year, name] of [
    [2023, 'ra-2023'],
    [2024, 'ra-2024'],
    [2025, 'ra-PIXEL'],
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
  await db
    .insert(schema.userRoles)
    .values({ userId: 'ra-raka', role: 'akademik' });
  const years = await db.select().from(schema.angkatan);
  const idOf = (year: number) => years.find((a) => a.year === year)!.id;
  const post = (id: string, forAngkatan = false, forGroups = false) => ({
    id,
    creatorId: 'ra-raka',
    title: id,
    content: id,
    isForAngkatan: forAngkatan,
    isForGroups: forGroups,
  });
  // For everyone; for PIXEL (2025) only; for akademik only; and one Nadia has already read.
  await db
    .insert(schema.infos)
    .values([
      post('ra-all'),
      post('ra-pixel', true),
      post('ra-akademik', false, true),
      post('ra-old'),
    ]);
  await db
    .insert(schema.infoAngkatan)
    .values({ infoId: 'ra-pixel', angkatanId: idOf(2025) });
  await db
    .insert(schema.infoGroups)
    .values({ infoId: 'ra-akademik', role: 'akademik' });
  await db
    .insert(schema.userReadInfos)
    .values({ userId: 'ra-nadia', infoId: 'ra-old' });
});

after(async () => {
  if (db) await cleanUp();
  await client?.end();
});

async function readBy(userId: string) {
  const schema = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');
  return (
    await db
      .select({ infoId: schema.userReadInfos.infoId })
      .from(schema.userReadInfos)
      .where(eq(schema.userReadInfos.userId, userId))
  )
    .map((r) => r.infoId)
    .filter((id) => POSTS.includes(id))
    .sort();
}

async function unreadFeed(userId: string, year: number) {
  const { getListInfos } = await import('../../src/repositories/info.repo');
  const { ListInfoParamsSchema } = await import('../../src/types/info.types');
  return (
    await getListInfos(
      db,
      ListInfoParamsSchema.parse({ unread: 'true' }),
      userId,
      year,
    )
  )
    .map((i) => i.id)
    .filter((id) => POSTS.includes(id))
    .sort();
}

test('marks what Nadia’s feed shows, not the akademik-only post, and counts only the new marks', async () => {
  const { markAllInfosRead } = await import('../../src/repositories/info.repo');
  assert.deepEqual(await unreadFeed('ra-nadia', 2025), ['ra-all', 'ra-pixel']);
  const marked = await markAllInfosRead(db, 'ra-nadia', 2025);
  assert.ok(marked >= 2, `marked ${marked}`);
  assert.deepEqual(await readBy('ra-nadia'), ['ra-all', 'ra-old', 'ra-pixel']);
  // The feed and the count agree: nothing unread is left.
  assert.deepEqual(await unreadFeed('ra-nadia', 2025), []);
  // Again: nothing new to mark.
  assert.equal(await markAllInfosRead(db, 'ra-nadia', 2025), 0);
});

test('other members keep their own read state', async () => {
  assert.deepEqual(await readBy('ra-dimas'), []);
  assert.deepEqual(await readBy('ra-raka'), []);
});

test('Dimas (2023) gets neither PIXEL’s post nor the akademik one; Raka (akademik) gets his group’s', async () => {
  const { markAllInfosRead } = await import('../../src/repositories/info.repo');
  await markAllInfosRead(db, 'ra-dimas', 2023);
  assert.deepEqual(await readBy('ra-dimas'), ['ra-all', 'ra-old']);
  await markAllInfosRead(db, 'ra-raka', 2024);
  // His own post for PIXEL too: an author sees what they posted.
  assert.deepEqual(await readBy('ra-raka'), [
    'ra-akademik',
    'ra-all',
    'ra-old',
    'ra-pixel',
  ]);
});
