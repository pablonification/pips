// Runs against a real, throwaway PostgreSQL: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// It migrates that database from empty and writes to it, so it refuses any database not named pips_test*.
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

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 10, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.delete(schema.chatrooms);
  await db.delete(schema.users);
  await db.delete(schema.angkatan);
  await db.insert(schema.angkatan).values({ year: 2025, name: 'PIXEL' });
  await db.insert(schema.users).values({
    id: 'u-nadia',
    nim: '13525001',
    email: 'nadia@example.com',
    fullName: 'Nadia',
    major: 'IF',
    region: 'Ganesha',
    angkatan: 2025,
    gender: 'F',
    membershipStatus: 'anggota',
  });
});

after(async () => {
  await client?.end();
});

// Regression (C4, review M1): the count and the insert were separate steps, so ten creates sent together all read
// a count of 0 and all ten rooms were made.
test('ten creates sent together leave exactly three rooms', async () => {
  const { createChatroomWithinLimit } =
    await import('../../src/repositories/chatroom.repo');
  const { chatrooms } = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createChatroomWithinLimit(db, { title: `room ${i}`, userId: 'u-nadia' }),
    ),
  );
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal(results.filter((r) => r === null).length, 7);
  const rows = await db
    .select()
    .from(chatrooms)
    .where(eq(chatrooms.userId, 'u-nadia'));
  assert.equal(rows.length, 3);
});
