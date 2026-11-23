// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// An app connects through OAuth and calls MCP tools against the real routes and SQL: single-use codes and refresh
// rotation hold in the database, a post for another angkatan never reaches the tool, and revoking or removing the
// member closes access.
import { strict as assert } from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
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

const API = 'https://api.example.test';
const REDIRECT = 'https://client.example.com/callback';
const USERS = [
  ['oa-nadia', '13525911', 2025],
  ['oa-dimas', '13523911', 2023],
  ['oa-gone', '13525912', 2025],
] as const;

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;
let app: ReturnType<typeof import('../../src/app').createApp>;
let schema: typeof import('../../src/db/schema');

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl, API_PUBLIC_URL: API });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray, like } = await import('drizzle-orm');
  schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.delete(schema.users).where(
    inArray(
      schema.users.id,
      USERS.map(([id]) => id),
    ),
  );
  await db
    .delete(schema.oauthClients)
    .where(like(schema.oauthClients.name, 'oa-%'));
  for (const [year, name] of [
    [2023, 'oa-2023'],
    [2025, 'oa-2025'],
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
      gender: 'F' as const,
      membershipStatus: 'anggota',
    })),
  );
  const years = await db.select().from(schema.angkatan);
  await db.insert(schema.infos).values({
    id: 'oa-post-2025',
    creatorId: 'oa-nadia',
    title: 'oa untuk 2025',
    content: 'Hanya untuk angkatan 2025.',
    isForAngkatan: true,
    isForGroups: false,
  });
  await db.insert(schema.infoAngkatan).values({
    infoId: 'oa-post-2025',
    angkatanId: years.find((a) => a.year === 2025)!.id,
  });
  const { createApp } = await import('../../src/app');
  app = createApp();
});

after(async () => {
  if (db) {
    const { inArray, like } = await import('drizzle-orm');
    await db.delete(schema.users).where(
      inArray(
        schema.users.id,
        USERS.map(([id]) => id),
      ),
    );
    await db
      .delete(schema.oauthClients)
      .where(like(schema.oauthClients.name, 'oa-%'));
  }
  await client?.end();
  await (await import('../../src/db/drizzle')).closeDatabase();
});

async function cookieFor(id: string) {
  const { sessionCookie, testUser } = await import('../support/session');
  const [, nim, angkatan] = USERS.find(([u]) => u === id)!;
  return await sessionCookie(testUser(id, { nim, angkatan }));
}

async function token(params: Record<string, string>) {
  const res = await app.request('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, body: (await res.json()) as any };
}

/** Registers an app named `name`, and runs the whole sign-in as `userId`: the code and the client. */
async function signIn(name: string, userId: string, scopes?: string[]) {
  const reg = (await (
    await app.request('/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: name, redirect_uris: [REDIRECT] }),
    })
  ).json()) as any;
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const q = new URLSearchParams({
    client_id: reg.client_id,
    redirect_uri: REDIRECT,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'pips.read pips.write',
    state: 'st',
    resource: `${API}/mcp`,
  });
  const auth = await app.request(`/oauth/authorize?${q}`);
  assert.equal(auth.status, 302);
  const requestId = new URL(auth.headers.get('location')!).searchParams.get(
    'permintaan',
  )!;
  const approve = await app.request(
    `/api/oauth/requests/${requestId}/approve`,
    {
      method: 'POST',
      headers: {
        Cookie: await cookieFor(userId),
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scopes ? { scopes } : {}),
    },
  );
  assert.equal(approve.status, 200);
  const code = new URL(
    ((await approve.json()) as any).redirectTo,
  ).searchParams.get('code')!;
  return {
    clientId: reg.client_id as string,
    exchange: async () =>
      await token({
        grant_type: 'authorization_code',
        code,
        client_id: reg.client_id,
        redirect_uri: REDIRECT,
        code_verifier: verifier,
      }),
  };
}

async function mcpClient(accessToken: string) {
  const c = new Client({ name: 'test', version: '1.0.0' });
  await c.connect(
    new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
      fetch: async (u, init) =>
        await app.request(String(u), init as RequestInit),
    }),
  );
  return c;
}

const textOf = (r: any) => (r.content as Array<{ text: string }>)[0].text;

test('the code is single use in the database, and a second use revokes what it gave', async () => {
  const { exchange } = await signIn('oa-code', 'oa-nadia');
  const first = await exchange();
  assert.equal(first.status, 200);
  const [again1, again2] = await Promise.all([exchange(), exchange()]);
  assert.equal(again1.body.error, 'invalid_grant');
  assert.equal(again2.body.error, 'invalid_grant');
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${first.body.access_token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(res.status, 401);
});

test('refresh rotation holds under two refreshes at once, and reuse revokes the family', async () => {
  const { clientId, exchange } = await signIn('oa-refresh', 'oa-nadia');
  const { body: tokens } = await exchange();
  const refresh = () =>
    token({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: clientId,
    });
  const results = await Promise.all([refresh(), refresh()]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  const winner = results.find((r) => r.status === 200)!.body;
  // The loser was a reuse: the family, the winner included, is revoked.
  const after = await token({
    grant_type: 'refresh_token',
    refresh_token: winner.refresh_token,
    client_id: clientId,
  });
  assert.equal(after.body.error, 'invalid_grant');
});

test('MCP tools read Pengumuman through the real route and SQL: another angkatan never sees the post', async () => {
  const nadia = await signIn('oa-nadia-app', 'oa-nadia');
  const nadiaTokens = (await nadia.exchange()).body;
  const dimas = await signIn('oa-dimas-app', 'oa-dimas');
  const dimasTokens = (await dimas.exchange()).body;

  const asNadia = await mcpClient(nadiaTokens.access_token);
  const nadiaFeed = JSON.parse(
    textOf(
      await asNadia.callTool({
        name: 'list_announcements',
        arguments: { search: 'oa' },
      }),
    ),
  ).map((p: { id: string }) => p.id);
  assert.ok(nadiaFeed.includes('oa-post-2025'));
  const me = JSON.parse(
    textOf(await asNadia.callTool({ name: 'get_my_profile', arguments: {} })),
  );
  assert.equal(me.id, 'oa-nadia');
  assert.equal(me.angkatan, 2025);
  await asNadia.close();

  const asDimas = await mcpClient(dimasTokens.access_token);
  const dimasFeed = JSON.parse(
    textOf(
      await asDimas.callTool({
        name: 'list_announcements',
        arguments: { search: 'oa' },
      }),
    ),
  ).map((p: { id: string }) => p.id);
  assert.ok(!dimasFeed.includes('oa-post-2025'));
  const opened = await asDimas.callTool({
    name: 'get_announcement',
    arguments: { announcementId: 'oa-post-2025' },
  });
  assert.equal(opened.isError, true);
  assert.match(textOf(opened), /^404 /);
  await asDimas.close();
});

test('Aplikasi terhubung lists the app; revoking it, or removing the member, closes access', async () => {
  const { clientId, exchange } = await signIn('oa-listed', 'oa-nadia');
  const { body: tokens } = await exchange();
  const c = await mcpClient(tokens.access_token);
  await c.callTool({ name: 'get_my_profile', arguments: {} });
  await c.close();
  // The use is recorded in the background.
  await new Promise((r) => setTimeout(r, 200));
  const headers = {
    Cookie: await cookieFor('oa-nadia'),
    Origin: 'http://localhost:5173',
  };
  const listed = (await (
    await app.request('/api/oauth/apps', { headers })
  ).json()) as any;
  const row = listed.apps.find(
    (a: { clientId: string }) => a.clientId === clientId,
  );
  assert.equal(row.name, 'oa-listed');
  assert.equal(row.returnHost, new URL(REDIRECT).hostname);
  assert.ok(row.connectedAt);
  assert.ok(row.lastUsedAt);

  const revoke = await app.request(`/api/oauth/apps/${clientId}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(revoke.status, 200);
  await assert.rejects(mcpClient(tokens.access_token));

  const gone = await signIn('oa-gone-app', 'oa-gone');
  const goneTokens = (await gone.exchange()).body;
  const { eq } = await import('drizzle-orm');
  await db.delete(schema.users).where(eq(schema.users.id, 'oa-gone'));
  await assert.rejects(mcpClient(goneTokens.access_token));
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.userId, 'oa-gone'));
  assert.equal(rows.length, 0, "a removed member's tokens go with them");
});

test('reading only: the stored request, the tokens and Aplikasi terhubung all say pips.read, and no writing tool is listed', async () => {
  const { clientId, exchange } = await signIn('oa-read-only', 'oa-nadia', [
    'pips.read',
  ]);
  const { body: tokens } = await exchange();
  assert.equal(tokens.scope, 'pips.read');
  const { eq } = await import('drizzle-orm');
  const stored = await db
    .select({ scope: schema.oauthTokens.scope })
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.clientId, clientId));
  assert.deepEqual(stored, [{ scope: 'pips.read' }]);

  const c = await mcpClient(tokens.access_token);
  const { tools } = await c.listTools();
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
  await c.close();

  const both = await signIn('oa-read-write', 'oa-nadia');
  await both.exchange();
  const listed = (await (
    await app.request('/api/oauth/apps', {
      headers: { Cookie: await cookieFor('oa-nadia') },
    })
  ).json()) as any;
  const scopesOf = (id: string) =>
    listed.apps.find((a: { clientId: string }) => a.clientId === id)?.scopes;
  assert.deepEqual(scopesOf(clientId), ['pips.read']);
  assert.deepEqual(scopesOf(both.clientId), ['pips.read', 'pips.write']);
});
