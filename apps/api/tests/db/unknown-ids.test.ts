// Runs against a real, throwaway PostgreSQL, as info-audience.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// Ids that point at nothing answer 404 (or 400 for a year no date holds), never 500, on the real database.
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';
import { sessionCookie, testUser } from '../support/session';

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

const member = testUser('ui-nadia', { nim: '13525914' });

let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
let closeDatabase: () => Promise<void>;
let client: import('postgres').Sql;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db
    .insert(schema.angkatan)
    .values({ year: 2025, name: 'ui-2025' })
    .onConflictDoNothing();
  await db
    .insert(schema.users)
    .values({
      id: member.id,
      nim: member.nim,
      email: `${member.nim}@std.stei.itb.ac.id`,
      fullName: member.fullName,
      major: 'IF',
      region: 'Ganesha',
      angkatan: 2025,
      gender: 'F',
      membershipStatus: 'anggota',
    })
    .onConflictDoNothing();
  const { createApp } = await import('../../src/app');
  ({ closeDatabase } = await import('../../src/db/drizzle'));
  app = createApp() as unknown as typeof app;
});

after(async () => {
  await client.end();
  await closeDatabase();
});

const send = async (method: string, path: string, body?: unknown) =>
  await app.request(`http://api.example.test/api${path}`, {
    method,
    headers: {
      Cookie: await sessionCookie(member),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

test('marking a post that does not exist read answers 404', async () => {
  assert.equal((await send('POST', '/info/no-such-post/read', {})).status, 404);
});

test('reacting to a post or comment that does not exist answers 404', async () => {
  for (const body of [
    { infoId: 'no-such-post', reaction: 'fire' },
    { commentId: 'no-such-comment', reaction: 'fire' },
  ]) {
    assert.equal(
      (await send('PUT', '/reaction', body)).status,
      404,
      JSON.stringify(body),
    );
  }
});

test('a personal calendar for a year no date holds answers 400', async () => {
  assert.equal(
    (await send('GET', '/calendar/me?month=1&year=999999')).status,
    400,
  );
});
