// Runs against a real, throwaway PostgreSQL, as info-audience.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// A session in use renews itself: GET /api/me with a token past half its life answers with a fresh cookie.
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { decode } from 'hono/jwt';
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

const LIFETIME = 3600;
const member = testUser('sr-nadia', { nim: '13525912' });

let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
let closeDatabase: () => Promise<void>;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({
    DATABASE_URL: testUrl,
    TOKEN_EXPIRATION: String(LIFETIME),
  });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
  const { createApp } = await import('../../src/app');
  ({ closeDatabase } = await import('../../src/db/drizzle'));
  app = createApp() as unknown as typeof app;
});

after(async () => {
  await closeDatabase();
});

const me = async (cookie: string) =>
  await app.request('http://api.example.test/api/me', {
    headers: { Cookie: cookie },
  });

const sessionToken = (res: Response) =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith('hmif-app.access-cookie='))
    ?.split(';')[0]
    .split('=')[1];

test('a session past half its life gets a fresh cookie with a new end time', async () => {
  const res = await me(await sessionCookie(member, undefined, 60));
  assert.equal(res.status, 200);
  const token = sessionToken(res);
  assert.ok(token, 'no fresh session cookie');
  const cookie = res.headers
    .getSetCookie()
    .find((c) => c.startsWith('hmif-app.access-cookie='))!;
  assert.match(cookie, new RegExp(`Max-Age=${LIFETIME}`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const { payload } = decode(token);
  const now = Math.floor(Date.now() / 1000);
  assert.ok(
    Math.abs(Number(payload.exp) - (now + LIFETIME)) <= 5,
    `exp ${payload.exp}`,
  );
  assert.equal(payload.id, member.id);
  assert.equal(payload.nim, member.nim);
  // The fresh token is a working session.
  const again = await me(`hmif-app.access-cookie=${token}`);
  assert.equal(again.status, 200);
  assert.equal((await again.json()).id, member.id);
});

test('a session in its first half is left as it is', async () => {
  const res = await me(await sessionCookie(member, undefined, LIFETIME - 60));
  assert.equal(res.status, 200);
  assert.ok(!sessionToken(res));
});

test('an ended session is not renewed', async () => {
  const res = await me(await sessionCookie(member, undefined, -60));
  assert.equal(res.status, 401);
  assert.ok(!sessionToken(res));
});
