import { randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { env } from '~/configs/env.config';
import {
  bearerToken,
  cleanClientName,
  hashSecret,
  inSeconds,
  isAllowedRedirectUri,
  isOurResource,
  isS256Challenge,
  LIFETIMES,
  matchesRegisteredRedirect,
  MAX_REDIRECT_URIS,
  MAX_STATE_LENGTH,
  narrowScope,
  newSecret,
  oauthUrls,
  parseScope,
  redirectHost,
  redirectWith,
  SCOPES,
  verifyPkce,
} from '~/lib/oauth';
import { findUserById } from '~/repositories/auth.repo';
import {
  approveRequest,
  redeemCode,
  createAuthorizationRequest,
  createClient,
  denyRequest,
  findActiveAccessToken,
  findClient,
  findPendingRequest,
  listConnectedApps,
  revokeApp,
  refreshTokens,
  type Exchange,
  type NewToken,
  touchToken,
} from '~/repositories/oauth.repo';
import {
  approveOAuthRequestRoute,
  denyOAuthRequestRoute,
  getOAuthRequestRoute,
  listConnectedAppsRoute,
  revokeConnectedAppRoute,
} from '~/routes/oauth.route';
import { withDb, type WithoutDb } from './deps';
import { createAuthRouter } from './router-factory';

/** What the OAuth routes need from storage, passed in so their tests run without a database. */
export interface OAuthDeps {
  createClient: WithoutDb<typeof createClient>;
  findClient: WithoutDb<typeof findClient>;
  createAuthorizationRequest: WithoutDb<typeof createAuthorizationRequest>;
  findPendingRequest: WithoutDb<typeof findPendingRequest>;
  approveRequest: WithoutDb<typeof approveRequest>;
  denyRequest: WithoutDb<typeof denyRequest>;
  redeemCode: WithoutDb<typeof redeemCode>;
  findActiveAccessToken: WithoutDb<typeof findActiveAccessToken>;
  refreshTokens: WithoutDb<typeof refreshTokens>;
  touchToken: WithoutDb<typeof touchToken>;
  listConnectedApps: WithoutDb<typeof listConnectedApps>;
  revokeApp: WithoutDb<typeof revokeApp>;
  findUserById: WithoutDb<typeof findUserById>;
  /** The server's clock (tests move it). */
  now: () => Date;
}

export const databaseOAuthDeps: OAuthDeps = {
  createClient: withDb(createClient),
  findClient: withDb(findClient),
  createAuthorizationRequest: withDb(createAuthorizationRequest),
  findPendingRequest: withDb(findPendingRequest),
  approveRequest: withDb(approveRequest),
  denyRequest: withDb(denyRequest),
  redeemCode: withDb(redeemCode),
  findActiveAccessToken: withDb(findActiveAccessToken),
  refreshTokens: withDb(refreshTokens),
  touchToken: withDb(touchToken),
  listConnectedApps: withDb(listConnectedApps),
  revokeApp: withDb(revokeApp),
  findUserById: withDb(findUserById),
  now: () => new Date(),
};

type Urls = ReturnType<typeof oauthUrls>;

/** An OAuth error answer (RFC 6749 5.2), never cached. */
function oauthError(
  c: Context,
  error: string,
  description: string,
  status: 400 | 401 = 400,
) {
  c.header('Cache-Control', 'no-store');
  return c.json({ error, error_description: description }, status);
}

/** The request's parameters from a form body (as RFC 6749 sends them) or, from lenient clients, a JSON body. */
async function bodyParams(c: Context): Promise<Record<string, string>> {
  const type = c.req.header('content-type') ?? '';
  try {
    if (type.includes('application/json')) {
      const json: unknown = await c.req.json();
      if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
      return Object.fromEntries(
        Object.entries(json).filter(
          (e): e is [string, string] => typeof e[1] === 'string',
        ),
      );
    }
    const form = await c.req.parseBody();
    return Object.fromEntries(
      Object.entries(form).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

const GRANT_TYPES = ['authorization_code', 'refresh_token'];

/**
 * The public side of OAuth 2.1 for MCP apps: metadata (RFC 9728, RFC 8414), dynamic client registration (RFC 7591),
 * the authorization endpoint (PKCE S256 required) and the token endpoint (code and refresh, with rotation).
 */
export function createOAuthRouter(
  deps: OAuthDeps = databaseOAuthDeps,
  urls: Urls = oauthUrls(env),
) {
  const router = new Hono();

  const protectedResource = (c: Context) =>
    c.json({
      resource: urls.resource,
      authorization_servers: [urls.issuer],
      scopes_supported: SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'PIPS!',
    });
  router.get('/.well-known/oauth-protected-resource', protectedResource);
  router.get('/.well-known/oauth-protected-resource/mcp', protectedResource);

  router.get('/.well-known/oauth-authorization-server', (c) =>
    c.json({
      issuer: urls.issuer,
      authorization_endpoint: `${urls.issuer}/oauth/authorize`,
      token_endpoint: `${urls.issuer}/oauth/token`,
      registration_endpoint: `${urls.issuer}/oauth/register`,
      scopes_supported: SCOPES,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: GRANT_TYPES,
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
      authorization_response_iss_parameter_supported: true,
    }),
  );

  router.post('/oauth/register', async (c) => {
    let body: Record<string, unknown>;
    try {
      const json: unknown = await c.req.json();
      if (!json || typeof json !== 'object' || Array.isArray(json))
        throw new Error('not an object');
      body = json as Record<string, unknown>;
    } catch {
      return oauthError(
        c,
        'invalid_client_metadata',
        'The body must be a JSON object',
      );
    }
    const method = body.token_endpoint_auth_method ?? 'none';
    if (method !== 'none') {
      return oauthError(
        c,
        'invalid_client_metadata',
        'Only public clients may register: token_endpoint_auth_method must be "none"',
      );
    }
    const grantTypes = body.grant_types ?? ['authorization_code'];
    if (
      !Array.isArray(grantTypes) ||
      !grantTypes.every((g) => GRANT_TYPES.includes(g))
    ) {
      return oauthError(
        c,
        'invalid_client_metadata',
        'grant_types may be authorization_code and refresh_token',
      );
    }
    const responseTypes = body.response_types ?? ['code'];
    if (
      !Array.isArray(responseTypes) ||
      !responseTypes.every((r) => r === 'code')
    ) {
      return oauthError(
        c,
        'invalid_client_metadata',
        'response_types may only be code',
      );
    }
    const redirectUris = body.redirect_uris;
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      redirectUris.length > MAX_REDIRECT_URIS ||
      !redirectUris.every(
        (u): u is string => typeof u === 'string' && isAllowedRedirectUri(u),
      )
    ) {
      return oauthError(
        c,
        'invalid_redirect_uri',
        `1 to ${MAX_REDIRECT_URIS} redirect URIs, each https:, or http: on 127.0.0.1, [::1] or localhost`,
      );
    }
    const client = {
      id: newSecret('pips_client_'),
      name: cleanClientName(body.client_name),
      redirectUris: [...new Set(redirectUris)],
    };
    await deps.createClient(client);
    c.header('Cache-Control', 'no-store');
    return c.json(
      {
        client_id: client.id,
        client_id_issued_at: Math.floor(deps.now().getTime() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: grantTypes,
        response_types: ['code'],
      },
      201,
    );
  });

  router.get('/oauth/authorize', async (c) => {
    const q = c.req.query();
    // Until the client and its redirect URI are known good, an error is shown here and never sent anywhere.
    const client = q.client_id ? await deps.findClient(q.client_id) : undefined;
    if (!client) {
      return oauthError(c, 'invalid_client', 'Unknown client_id');
    }
    // Always named, so the token request can be held to the same one.
    const redirectUri = q.redirect_uri;
    if (
      !redirectUri ||
      !matchesRegisteredRedirect(redirectUri, client.redirectUris)
    ) {
      return oauthError(
        c,
        'invalid_request',
        'redirect_uri is required and must be one this client registered',
      );
    }
    const back = (error: string, description: string) =>
      c.redirect(
        redirectWith(redirectUri, {
          error,
          error_description: description,
          state: q.state,
          iss: urls.issuer,
        }),
        302,
      );
    if (q.response_type !== 'code') {
      return back('unsupported_response_type', 'response_type must be code');
    }
    if (
      q.code_challenge_method !== 'S256' ||
      !q.code_challenge ||
      !isS256Challenge(q.code_challenge)
    ) {
      return back(
        'invalid_request',
        'PKCE with code_challenge_method=S256 is required',
      );
    }
    const scopes = parseScope(q.scope);
    if (!scopes) {
      return back('invalid_scope', `Scopes are ${SCOPES.join(' and ')}`);
    }
    if (!isOurResource(q.resource, urls.resource)) {
      return back('invalid_target', `The resource is ${urls.resource}`);
    }
    if (q.state && q.state.length > MAX_STATE_LENGTH) {
      return back('invalid_request', 'state is too long');
    }
    const requestId = newSecret();
    const now = deps.now();
    await deps.createAuthorizationRequest(
      {
        requestHash: hashSecret(requestId),
        clientId: client.id,
        redirectUri,
        scope: scopes.join(' '),
        state: q.state ?? null,
        codeChallenge: q.code_challenge,
        expiresAt: inSeconds(LIFETIMES.request, now),
      },
      now,
    );
    const consent = new URL(urls.consentPage);
    consent.searchParams.set('permintaan', requestId);
    return c.redirect(consent.toString(), 302);
  });

  router.post('/oauth/token', async (c) => {
    const p = await bodyParams(c);
    const now = deps.now();
    // Made first, so the token can be written in the same transaction that spends the code or refresh token.
    const access = newSecret('pips_at_');
    const refresh = newSecret('pips_rt_');
    let scope = '';
    const token = (input: {
      family: string;
      clientId: string;
      userId: string;
      scope: string;
    }): NewToken => {
      scope = input.scope;
      return {
        ...input,
        accessHash: hashSecret(access),
        accessExpiresAt: inSeconds(LIFETIMES.access, now),
        refreshHash: hashSecret(refresh),
        refreshExpiresAt: inSeconds(LIFETIMES.refresh, now),
      };
    };
    const answer = (result: Exchange, invalid: string) => {
      if (result.status === 'ok') {
        c.header('Cache-Control', 'no-store');
        c.header('Pragma', 'no-cache');
        return c.json(
          {
            access_token: access,
            token_type: 'Bearer',
            expires_in: LIFETIMES.access,
            refresh_token: refresh,
            scope,
          },
          200,
        );
      }
      if (result.status === 'refused' && result.reason === 'invalid_scope') {
        return oauthError(c, 'invalid_scope', 'A refresh cannot add scopes');
      }
      return oauthError(c, 'invalid_grant', invalid);
    };

    if (p.grant_type === 'authorization_code') {
      if (!p.code || !p.client_id || !p.code_verifier || !p.redirect_uri) {
        return oauthError(
          c,
          'invalid_request',
          'code, client_id, redirect_uri and code_verifier are required',
        );
      }
      const family = randomUUID();
      const result = await deps.redeemCode(
        hashSecret(p.code),
        family,
        now,
        async (a) => {
          const valid =
            a.codeExpiresAt !== null &&
            a.codeExpiresAt > now &&
            a.clientId === p.client_id &&
            a.redirectUri === p.redirect_uri &&
            verifyPkce(p.code_verifier, a.codeChallenge);
          if (!valid || !a.userId || !(await deps.findUserById(a.userId)))
            return { refuse: 'invalid_grant' };
          return token({
            family,
            clientId: a.clientId,
            userId: a.userId,
            scope: a.scope,
          });
        },
      );
      return answer(result, 'The code is not valid');
    }

    if (p.grant_type === 'refresh_token') {
      if (!p.refresh_token || !p.client_id) {
        return oauthError(
          c,
          'invalid_request',
          'refresh_token and client_id are required',
        );
      }
      const result = await deps.refreshTokens(
        hashSecret(p.refresh_token),
        now,
        async (old) => {
          if (
            old.clientId !== p.client_id ||
            !(await deps.findUserById(old.userId))
          )
            return { refuse: 'invalid_grant' };
          // A refresh may narrow the scopes, never widen them.
          let narrowed = old.scope;
          if (p.scope) {
            const asked = parseScope(p.scope);
            const had = old.scope.split(' ');
            if (!asked || !asked.every((x) => had.includes(x)))
              return { refuse: 'invalid_scope' };
            narrowed = asked.join(' ');
          }
          return token({
            family: old.family,
            clientId: old.clientId,
            userId: old.userId,
            scope: narrowed,
          });
        },
      );
      return answer(result, 'The refresh token is not valid');
    }

    return oauthError(
      c,
      'unsupported_grant_type',
      'grant_type is authorization_code or refresh_token',
    );
  });

  return router;
}

/**
 * The member and scopes an access token stands for, while it is current and its member still exists; undefined
 * otherwise. Records the use for Profil's "Aplikasi terhubung".
 */
export async function verifyAccessToken(
  deps: Pick<
    OAuthDeps,
    'findActiveAccessToken' | 'findUserById' | 'touchToken' | 'now'
  >,
  authorization: string | undefined,
) {
  const token = bearerToken(authorization);
  if (!token) return undefined;
  const now = deps.now();
  const row = await deps.findActiveAccessToken(hashSecret(token), now);
  if (!row) return undefined;
  const user = await deps.findUserById(row.userId);
  if (!user) return undefined;
  await deps.touchToken(row.id, now);
  return { user, scope: row.scope, clientId: row.clientId };
}

/** The consent page's and Profil's routes: ordinary member routes under `/api`, with the session cookie. */
export function createOAuthConsentRouter(
  deps: OAuthDeps = databaseOAuthDeps,
  urls: Urls = oauthUrls(env),
) {
  const router = createAuthRouter();

  router.openapi(getOAuthRequestRoute, async (c) => {
    const { requestId } = c.req.valid('param');
    const request = await deps.findPendingRequest(
      hashSecret(requestId),
      deps.now(),
    );
    if (!request) return c.json({ error: 'Request not found' }, 404);
    return c.json(
      {
        clientName: request.clientName,
        redirectHost: redirectHost(request.redirectUri),
        scopes: request.scope.split(' ') as Array<(typeof SCOPES)[number]>,
      },
      200,
    );
  });

  router.openapi(approveOAuthRequestRoute, async (c) => {
    const { requestId } = c.req.valid('param');
    const { scopes } = c.req.valid('json') ?? {};
    const now = deps.now();
    const requestHash = hashSecret(requestId);
    const request = await deps.findPendingRequest(requestHash, now);
    if (!request) return c.json({ error: 'Request not found' }, 404);
    const scope = narrowScope(request.scope, scopes);
    if (!scope) return c.json({ error: 'Only scopes the app asked for' }, 400);
    const code = newSecret();
    const approved = await deps.approveRequest(
      {
        requestHash,
        userId: c.var.user.id,
        scope,
        codeHash: hashSecret(code),
        codeExpiresAt: inSeconds(LIFETIMES.code, now),
      },
      now,
    );
    if (!approved) return c.json({ error: 'Request not found' }, 404);
    return c.json(
      {
        redirectTo: redirectWith(approved.redirectUri, {
          code,
          state: approved.state,
          iss: urls.issuer,
        }),
      },
      200,
    );
  });

  router.openapi(denyOAuthRequestRoute, async (c) => {
    const { requestId } = c.req.valid('param');
    const denied = await deps.denyRequest(hashSecret(requestId), deps.now());
    if (!denied) return c.json({ error: 'Request not found' }, 404);
    return c.json(
      {
        redirectTo: redirectWith(denied.redirectUri, {
          error: 'access_denied',
          state: denied.state,
          iss: urls.issuer,
        }),
      },
      200,
    );
  });

  router.openapi(listConnectedAppsRoute, async (c) => {
    const apps = await deps.listConnectedApps(c.var.user.id, deps.now());
    return c.json({ apps }, 200);
  });

  router.openapi(revokeConnectedAppRoute, async (c) => {
    const { clientId } = c.req.valid('param');
    const revoked = await deps.revokeApp(c.var.user.id, clientId, deps.now());
    if (revoked === 0) return c.json({ error: 'App not connected' }, 404);
    return c.json({}, 200);
  });

  return router;
}
