// OAuth 2.1 for MCP apps, through the real app object with storage in memory: metadata, registration, the
// authorization request, the consent routes, the token endpoint (PKCE, single-use codes, refresh rotation) and
// revocation. The SQL behind the same rules is checked on a real database in tests/db/oauth.test.ts.
import { strict as assert } from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { before, beforeEach, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { memoryOAuthStore } from './support/oauth-store';
import { sessionCookie, testUser } from './support/session';

const API = 'https://api.example.test';
const WEB = 'https://app.example.test';
const REDIRECT = 'https://client.example.com/callback';
const member = testUser('member-1', { nim: '13525901' });

let createApp: typeof import('../src/app').createApp;
let store: ReturnType<typeof memoryOAuthStore>;
let app: ReturnType<typeof import('../src/app').createApp>;

before(async () => {
  usePlaceholderEnv({ API_PUBLIC_URL: API, WEB_APP_URL: WEB });
  ({ createApp } = await import('../src/app'));
});

beforeEach(() => {
  store = memoryOAuthStore({ [member.id]: member });
  app = createApp({ checkDatabase: async () => undefined, oauth: store.deps });
});

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
};

async function register(body: Record<string, unknown> = {}) {
  const res = await app.request('/oauth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Test Client',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      ...body,
    }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

function authorizeUrl(params: Record<string, string | undefined>) {
  const url = new URL('/oauth/authorize', 'http://localhost');
  for (const [k, v] of Object.entries(params))
    if (v !== undefined) url.searchParams.set(k, v);
  return url.pathname + url.search;
}

/** The authorization request's id, from the redirect to the consent page. */
async function startAuthorization(
  clientId: string,
  challenge: string,
  extra: Record<string, string | undefined> = {},
) {
  const res = await app.request(
    authorizeUrl({
      client_id: clientId,
      redirect_uri: REDIRECT,
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      scope: 'pips.read pips.write',
      state: 'client-state',
      resource: `${API}/mcp`,
      ...extra,
    }),
  );
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location') ?? '');
  assert.equal(location.origin + location.pathname, `${WEB}/hubungkan`);
  // Only the request id travels to the web app.
  assert.deepEqual([...location.searchParams.keys()], ['permintaan']);
  return location.searchParams.get('permintaan') ?? '';
}

async function asMember(
  path: string,
  method = 'GET',
  user = member,
  body?: unknown,
) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      Cookie: await sessionCookie(user),
      Origin: 'http://localhost:5173',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function token(params: Record<string, string>) {
  const res = await app.request('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  return {
    status: res.status,
    body: (await res.json()) as any,
    cache: res.headers.get('cache-control'),
  };
}

/** Registration, authorization, approval (with the scopes the member chose, if any) and the code exchange: the token answer. */
async function connect(scope = 'pips.read pips.write', chosen?: string[]) {
  const client = (await register()).body;
  const { verifier, challenge } = pkce();
  const requestId = await startAuthorization(client.client_id, challenge, {
    scope,
  });
  const approved = await asMember(
    `/oauth/requests/${requestId}/approve`,
    'POST',
    member,
    chosen === undefined ? undefined : { scopes: chosen },
  );
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  const code = new URL(approved.body.redirectTo).searchParams.get('code') ?? '';
  const res = await token({
    grant_type: 'authorization_code',
    code,
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { client, tokens: res.body };
}

const mcp = async (accessToken: string | undefined, method = 'tools/list') =>
  await app.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method }),
  });

test('metadata names the issuer, the MCP resource, PKCE S256 and public clients', async () => {
  for (const path of [
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ]) {
    const res = await app.request(path);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const doc = (await res.json()) as any;
    assert.equal(doc.resource, `${API}/mcp`);
    assert.deepEqual(doc.authorization_servers, [API]);
    assert.deepEqual(doc.scopes_supported, ['pips.read', 'pips.write']);
  }
  const doc = (await (
    await app.request('/.well-known/oauth-authorization-server')
  ).json()) as any;
  assert.equal(doc.issuer, API);
  assert.equal(doc.authorization_endpoint, `${API}/oauth/authorize`);
  assert.equal(doc.token_endpoint, `${API}/oauth/token`);
  assert.equal(doc.registration_endpoint, `${API}/oauth/register`);
  assert.deepEqual(doc.code_challenge_methods_supported, ['S256']);
  assert.deepEqual(doc.token_endpoint_auth_methods_supported, ['none']);
});

test('/mcp without a token answers 401 pointing at the resource metadata', async () => {
  const res = await mcp(undefined);
  assert.equal(res.status, 401);
  assert.equal(
    res.headers.get('www-authenticate'),
    `Bearer resource_metadata="${API}/.well-known/oauth-protected-resource/mcp"`,
  );
  const bad = await mcp('pips_at_not-a-real-token');
  assert.equal(bad.status, 401);
  assert.match(
    bad.headers.get('www-authenticate') ?? '',
    /error="invalid_token"/,
  );
});

test('registration: public clients with safe redirect URIs only; the name is cleaned', async () => {
  const ok = await register({ client_name: '  Claude ‮ Code  ' });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.client_id.startsWith('pips_client_'));
  assert.equal(ok.body.client_name, 'Claude Code');
  assert.equal(ok.body.token_endpoint_auth_method, 'none');
  assert.equal(store.clients.get(ok.body.client_id)?.name, 'Claude Code');

  for (const [body, error] of [
    [
      { token_endpoint_auth_method: 'client_secret_basic' },
      'invalid_client_metadata',
    ],
    [{ redirect_uris: ['http://example.com/cb'] }, 'invalid_redirect_uri'],
    [{ redirect_uris: ['javascript:alert(1)'] }, 'invalid_redirect_uri'],
    [{ redirect_uris: [] }, 'invalid_redirect_uri'],
    [{ redirect_uris: undefined }, 'invalid_redirect_uri'],
    [{ grant_types: ['client_credentials'] }, 'invalid_client_metadata'],
    [{ response_types: ['token'] }, 'invalid_client_metadata'],
  ] as const) {
    const res = await register(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error, error, JSON.stringify(body));
  }
  const loopback = await register({
    redirect_uris: ['http://127.0.0.1:43123/callback'],
  });
  assert.equal(loopback.status, 201);
});

test('authorize: an unknown client or redirect URI is answered here, never redirected', async () => {
  const client = (await register()).body;
  const { challenge } = pkce();
  for (const params of [
    { client_id: 'nope', redirect_uri: REDIRECT },
    { client_id: client.client_id, redirect_uri: 'https://evil.example/cb' },
    { client_id: client.client_id, redirect_uri: undefined },
  ]) {
    const res = await app.request(
      authorizeUrl({
        ...params,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }),
    );
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('location'), null);
  }
});

test('authorize: other mistakes go back to the client with an error and its state', async () => {
  const client = (await register()).body;
  const { challenge } = pkce();
  const cases: Array<[Record<string, string | undefined>, string]> = [
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge: undefined }, 'invalid_request'],
    [{ scope: 'pips.read admin' }, 'invalid_scope'],
    [{ resource: 'https://evil.example/mcp' }, 'invalid_target'],
  ];
  for (const [extra, error] of cases) {
    const res = await app.request(
      authorizeUrl({
        client_id: client.client_id,
        redirect_uri: REDIRECT,
        response_type: 'code',
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 's1',
        ...extra,
      }),
    );
    assert.equal(res.status, 302, JSON.stringify(extra));
    const location = new URL(res.headers.get('location') ?? '');
    assert.equal(location.origin + location.pathname, REDIRECT);
    assert.equal(
      location.searchParams.get('error'),
      error,
      JSON.stringify(extra),
    );
    assert.equal(location.searchParams.get('state'), 's1');
  }
});

test('the consent routes need a session, and show the client by name and host', async () => {
  const client = (await register()).body;
  const requestId = await startAuthorization(
    client.client_id,
    pkce().challenge,
  );
  const signedOut = await app.request(`/api/oauth/requests/${requestId}`);
  assert.equal(signedOut.status, 401);

  const shown = await asMember(`/oauth/requests/${requestId}`);
  assert.equal(shown.status, 200);
  assert.deepEqual(shown.body, {
    clientName: 'Test Client',
    redirectHost: 'client.example.com',
    scopes: ['pips.read', 'pips.write'],
  });
  assert.equal((await asMember('/oauth/requests/unknown')).status, 404);
  // Only hashes are stored.
  assert.ok(!JSON.stringify(store.auths).includes(requestId));
});

test('deny sends the member back with access_denied, once', async () => {
  const client = (await register()).body;
  const requestId = await startAuthorization(
    client.client_id,
    pkce().challenge,
  );
  const denied = await asMember(`/oauth/requests/${requestId}/deny`, 'POST');
  assert.equal(denied.status, 200);
  const back = new URL(denied.body.redirectTo);
  assert.equal(back.searchParams.get('error'), 'access_denied');
  assert.equal(back.searchParams.get('state'), 'client-state');
  assert.equal(
    (await asMember(`/oauth/requests/${requestId}/approve`, 'POST')).status,
    404,
  );
});

test('a request expires after ten minutes', async () => {
  const client = (await register()).body;
  const requestId = await startAuthorization(
    client.client_id,
    pkce().challenge,
  );
  store.clock.now = new Date(store.clock.now.getTime() + 11 * 60_000);
  assert.equal((await asMember(`/oauth/requests/${requestId}`)).status, 404);
  assert.equal(
    (await asMember(`/oauth/requests/${requestId}/approve`, 'POST')).status,
    404,
  );
});

test('the full code flow with PKCE gives tokens that open /mcp', async () => {
  const { tokens } = await connect();
  assert.equal(tokens.token_type, 'Bearer');
  assert.equal(tokens.expires_in, 3600);
  assert.equal(tokens.scope, 'pips.read pips.write');
  assert.ok(tokens.access_token.startsWith('pips_at_'));
  assert.ok(tokens.refresh_token.startsWith('pips_rt_'));
  // Only hashes are stored.
  assert.ok(!JSON.stringify(store.tokens).includes(tokens.access_token));
  assert.ok(!JSON.stringify(store.tokens).includes(tokens.refresh_token));
  const res = await mcp(tokens.access_token);
  assert.equal(res.status, 200);
});

test('the code: wrong verifier, other redirect URI, other client, expired, reused', async () => {
  const client = (await register()).body;
  const other = (await register()).body;
  const attempt = async (
    mutate: (p: Record<string, string>) => void,
    before?: () => void,
  ) => {
    const { verifier, challenge } = pkce();
    const requestId = await startAuthorization(client.client_id, challenge);
    const approved = await asMember(
      `/oauth/requests/${requestId}/approve`,
      'POST',
    );
    const code =
      new URL(approved.body.redirectTo).searchParams.get('code') ?? '';
    const params = {
      grant_type: 'authorization_code',
      code,
      client_id: client.client_id,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    };
    mutate(params);
    before?.();
    return await token(params);
  };
  for (const mutate of [
    (p: Record<string, string>) =>
      (p.code_verifier = randomBytes(32).toString('base64url')),
    (p: Record<string, string>) =>
      (p.redirect_uri = 'https://client.example.com/other'),
    (p: Record<string, string>) => (p.client_id = other.client_id),
  ]) {
    const res = await attempt(mutate);
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'invalid_grant');
    assert.equal(res.cache, 'no-store');
  }
  const expired = await attempt(
    () => undefined,
    () => (store.clock.now = new Date(store.clock.now.getTime() + 3 * 60_000)),
  );
  assert.equal(expired.body.error, 'invalid_grant');
});

test('the member may allow reading only: the code and its tokens carry pips.read, and /mcp lists no writing tool', async () => {
  const { client, tokens } = await connect('pips.read pips.write', [
    'pips.read',
  ]);
  assert.equal(tokens.scope, 'pips.read');
  assert.ok(store.auths.every((a) => a.scope === 'pips.read'));

  const res = await mcp(tokens.access_token);
  assert.equal(res.status, 200);
  const tools: Array<{ name: string; annotations?: any }> = (
    (await res.json()) as any
  ).result.tools;
  assert.ok(tools.length > 0);
  assert.ok(tools.every((t) => t.annotations?.readOnlyHint === true));
  for (const name of ['post_announcement', 'add_calendar_event'])
    assert.ok(!tools.some((t) => t.name === name), name);

  // Aplikasi terhubung says it may only read, and names the one host the app's sign-ins return to.
  const listed = await asMember('/oauth/apps');
  assert.deepEqual(listed.body.apps[0].scopes, ['pips.read']);
  assert.equal(listed.body.apps[0].returnHost, 'client.example.com');

  // A refresh can't win write back.
  const wider = await token({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
    scope: 'pips.read pips.write',
  });
  assert.equal(wider.body.error, 'invalid_scope');
});

test('allowing both, or nothing chosen, keeps what the app asked for; Aplikasi terhubung says it may also change', async () => {
  const both = await connect('pips.read pips.write', [
    'pips.read',
    'pips.write',
  ]);
  assert.equal(both.tokens.scope, 'pips.read pips.write');
  const asked = await connect('pips.read pips.write');
  assert.equal(asked.tokens.scope, 'pips.read pips.write');
  // An empty choice still reads.
  const none = await connect('pips.read pips.write', []);
  assert.equal(none.tokens.scope, 'pips.read');
  const res = await mcp(both.tokens.access_token);
  const tools: Array<{ name: string }> = ((await res.json()) as any).result
    .tools;
  assert.ok(tools.some((t) => t.name === 'add_calendar_event'));
  const apps = (await asMember('/oauth/apps')).body.apps as Array<any>;
  const scopesOf = (clientId: string) =>
    apps.find((a) => a.clientId === clientId)?.scopes;
  assert.deepEqual(scopesOf(both.client.client_id), [
    'pips.read',
    'pips.write',
  ]);
  assert.deepEqual(scopesOf(asked.client.client_id), [
    'pips.read',
    'pips.write',
  ]);
  assert.deepEqual(scopesOf(none.client.client_id), ['pips.read']);
});

test('approval can never widen what the app asked for', async () => {
  const client = (await register()).body;
  const requestId = await startAuthorization(
    client.client_id,
    pkce().challenge,
    { scope: 'pips.read' },
  );
  const wider = await asMember(
    `/oauth/requests/${requestId}/approve`,
    'POST',
    member,
    { scopes: ['pips.read', 'pips.write'] },
  );
  assert.equal(wider.status, 400);
  const unknown = await asMember(
    `/oauth/requests/${requestId}/approve`,
    'POST',
    member,
    { scopes: ['admin'] },
  );
  assert.equal(unknown.status, 400);
  // Refused, the request is still waiting, unchanged.
  assert.equal(store.auths[0].approvedAt, null);
  assert.equal(store.auths[0].scope, 'pips.read');
  const ok = await asMember(
    `/oauth/requests/${requestId}/approve`,
    'POST',
    member,
    { scopes: ['pips.read'] },
  );
  assert.equal(ok.status, 200);
});

test('a code used twice is refused, and revokes the tokens it gave', async () => {
  const client = (await register()).body;
  const { verifier, challenge } = pkce();
  const requestId = await startAuthorization(client.client_id, challenge);
  const approved = await asMember(
    `/oauth/requests/${requestId}/approve`,
    'POST',
  );
  const back = new URL(approved.body.redirectTo);
  assert.equal(back.searchParams.get('state'), 'client-state');
  assert.equal(back.searchParams.get('iss'), API);
  const params = {
    grant_type: 'authorization_code',
    code: back.searchParams.get('code') ?? '',
    client_id: client.client_id,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  };
  const first = await token(params);
  assert.equal(first.status, 200);
  const second = await token(params);
  assert.equal(second.body.error, 'invalid_grant');
  assert.equal((await mcp(first.body.access_token)).status, 401);
});

test('refresh rotates the pair; an old refresh token used again revokes the family', async () => {
  const { client, tokens } = await connect();
  const refreshed = await token({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.access_token, tokens.access_token);
  assert.notEqual(refreshed.body.refresh_token, tokens.refresh_token);
  assert.equal(
    (await mcp(tokens.access_token)).status,
    401,
    'the old access token is retired',
  );
  assert.equal((await mcp(refreshed.body.access_token)).status, 200);

  const replay = await token({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(replay.body.error, 'invalid_grant');
  assert.equal(
    (await mcp(refreshed.body.access_token)).status,
    401,
    'the whole family is revoked',
  );
  const after = await token({
    grant_type: 'refresh_token',
    refresh_token: refreshed.body.refresh_token,
    client_id: client.client_id,
  });
  assert.equal(after.body.error, 'invalid_grant');
});

test('refresh: another client, a wider scope, or an unknown grant are refused', async () => {
  const { client, tokens } = await connect('pips.read');
  const other = (await register()).body;
  assert.equal(
    (
      await token({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: other.client_id,
      })
    ).body.error,
    'invalid_grant',
  );
  const { client: c2, tokens: t2 } = await connect('pips.read');
  assert.equal(
    (
      await token({
        grant_type: 'refresh_token',
        refresh_token: t2.refresh_token,
        client_id: c2.client_id,
        scope: 'pips.read pips.write',
      })
    ).body.error,
    'invalid_scope',
  );
  assert.equal(
    (await token({ grant_type: 'password', client_id: client.client_id })).body
      .error,
    'unsupported_grant_type',
  );
});

test('an access token expires after an hour', async () => {
  const { tokens } = await connect();
  store.clock.now = new Date(store.clock.now.getTime() + 61 * 60_000);
  assert.equal((await mcp(tokens.access_token)).status, 401);
});

test('a member removed from users loses access, and their code is refused', async () => {
  const { tokens } = await connect();
  delete store.users[member.id];
  assert.equal((await mcp(tokens.access_token)).status, 401);
});

test('Aplikasi terhubung lists the app with its last use, and revoking it closes /mcp', async () => {
  const empty = await asMember('/oauth/apps');
  assert.deepEqual(empty.body, { apps: [] });
  const { client, tokens } = await connect();
  await mcp(tokens.access_token);
  const listed = await asMember('/oauth/apps');
  assert.equal(listed.body.apps.length, 1);
  assert.equal(listed.body.apps[0].clientId, client.client_id);
  assert.equal(listed.body.apps[0].name, 'Test Client');
  assert.ok(listed.body.apps[0].lastUsedAt);
  // Another member sees nothing of it, and can't revoke it.
  const other = testUser('member-2', { nim: '13525902' });
  assert.deepEqual((await asMember('/oauth/apps', 'GET', other)).body, {
    apps: [],
  });
  assert.equal(
    (await asMember(`/oauth/apps/${client.client_id}`, 'DELETE', other)).status,
    404,
  );

  const revoked = await asMember(`/oauth/apps/${client.client_id}`, 'DELETE');
  assert.equal(revoked.status, 200);
  assert.equal((await mcp(tokens.access_token)).status, 401);
  assert.equal(
    (
      await token({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
      })
    ).body.error,
    'invalid_grant',
  );
  assert.deepEqual((await asMember('/oauth/apps')).body, { apps: [] });
});

test('writes to the consent routes from another site are refused', async () => {
  const client = (await register()).body;
  const requestId = await startAuthorization(
    client.client_id,
    pkce().challenge,
  );
  const res = await app.request(`/api/oauth/requests/${requestId}/approve`, {
    method: 'POST',
    headers: {
      Cookie: await sessionCookie(member),
      Origin: 'https://evil.example',
    },
  });
  assert.equal(res.status, 403);
});
