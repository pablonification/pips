// Runs against a real, throwaway PostgreSQL, as info-audience.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// A session in use renews itself: GET /api/me with a token past half its life answers with a fresh cookie.
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { decode, sign } from 'hono/jwt';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';
import {
  PLACEHOLDER_JWT_SECRET,
  sessionCookie,
  testUser,
  type TestUser,
} from '../support/session';

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

const DAY = 24 * 3600;

let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
let closeDatabase: () => Promise<void>;
let setFullName: (fullName: string) => Promise<void>;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({
    DATABASE_URL: testUrl,
    TOKEN_EXPIRATION: String(LIFETIME),
  });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');
  const client = postgres(testUrl, { max: 1, onnotice: () => {} });
  const setup = drizzle(client, { schema });
  await migrate(setup, { migrationsFolder: './drizzle' });
  await setup.delete(schema.users).where(eq(schema.users.id, member.id));
  await setup
    .insert(schema.angkatan)
    .values({ year: member.angkatan, name: 'sr-PIXEL' })
    .onConflictDoNothing();
  await setup.insert(schema.users).values({
    id: member.id,
    nim: member.nim,
    email: member.email,
    fullName: member.fullName,
    major: member.major,
    region: member.region,
    angkatan: member.angkatan,
    gender: member.gender,
    membershipStatus: member.membershipStatus,
  });
  await client.end();
  setFullName = async (fullName) => {
    const own = postgres(testUrl, { max: 1, onnotice: () => {} });
    await drizzle(own, { schema })
      .update(schema.users)
      .set({ fullName })
      .where(eq(schema.users.id, member.id));
    await own.end();
  };
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
  assert.match(cookie, /Secure/);
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

/** A session cookie with a claim of when the member signed in, as the API issues it. */
const sessionSince = async (
  user: TestUser,
  signedInSecondsAgo: number,
  expiresIn: number,
) => {
  const now = Math.floor(Date.now() / 1000);
  const token = await sign(
    { ...user, since: now - signedInSecondsAgo, exp: now + expiresIn },
    PLACEHOLDER_JWT_SECRET,
    'HS256',
  );
  return `hmif-app.access-cookie=${token}`;
};

test('a renewed session carries the member as the database has them now', async () => {
  await setFullName('Nadia Baru');
  const res = await me(await sessionCookie(member, undefined, 60));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).fullName, 'Nadia Baru');
  const { payload } = decode(sessionToken(res)!);
  assert.equal(payload.fullName, 'Nadia Baru');
  await setFullName(member.fullName);
});

test('a session of someone no longer a member is not renewed: it ends, and the cookie goes', async () => {
  const gone = testUser('sr-gone', { nim: '13525913' });
  const res = await me(await sessionCookie(gone, undefined, 60));
  assert.equal(res.status, 401);
  assert.ok(!sessionToken(res), 'a fresh session for someone not in users');
  const cleared = res.headers
    .getSetCookie()
    .find((c) => c.startsWith('hmif-app.access-cookie=;'));
  assert.ok(cleared, 'the cookie is not cleared');
});

test('a renewed session remembers when the member signed in', async () => {
  const res = await me(await sessionSince(member, 40 * DAY, 60));
  const { payload } = decode(sessionToken(res)!);
  const now = Math.floor(Date.now() / 1000);
  assert.ok(Math.abs(Number(payload.since) - (now - 40 * DAY)) <= 5);
});

test('a session is not renewed past 180 days after sign-in: the member signs in again', async () => {
  const res = await me(await sessionSince(member, 181 * DAY, 60));
  assert.equal(res.status, 200);
  assert.ok(!sessionToken(res), 'renewed past the limit');
});
