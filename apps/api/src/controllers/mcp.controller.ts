import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { env } from '~/configs/env.config';
import { runInBackground } from '~/lib/background';
import { LIFETIMES, oauthUrls, scopeIncludes, WRITE_SCOPE } from '~/lib/oauth';
import type { createRateLimiter } from '~/lib/rate-limit';
import { SESSION_COOKIE } from '~/lib/session-cookie';
import { signSessionToken } from '~/lib/session-token';
import { registerTools, type ApiCall } from '~/mcp/tools';
import { JWTPayloadSchema } from '~/types/login.types';
import {
  databaseOAuthDeps,
  verifyAccessToken,
  type OAuthDeps,
} from './oauth.controller';

const SERVER_INFO = { name: 'PIPS!', version: '1.0.0' };

const INSTRUCTIONS =
  'PIPS! is the members app of HMIF ITB. Every tool acts as the signed-in member, with their own access: a route ' +
  'refuses what their angkatan or roles do not allow, and the tool returns that refusal. Curhat Yuk! is not ' +
  'available here. Times are ISO; members read them in WIB (UTC+7).';

/**
 * `/mcp`: the MCP endpoint (Streamable HTTP, stateless). Each request checks the access token, reads the member
 * again, and mints a short session the way sign-in does, so every tool calls the API's own routes as that member
 * (`dispatch`, in this process) and their checks decide (docs/adr/0021-*).
 */
export function createMcpRouter(options: {
  /** Sends a request to the API app in this process. */
  dispatch: (request: Request) => Response | Promise<Response>;
  deps?: Pick<
    OAuthDeps,
    'findActiveAccessToken' | 'findUserById' | 'touchToken' | 'now'
  >;
  urls?: ReturnType<typeof oauthUrls>;
  /** Per member, after the token is checked. */
  limiter?: ReturnType<typeof createRateLimiter>;
}) {
  const {
    dispatch,
    deps = databaseOAuthDeps,
    urls = oauthUrls(env),
    limiter,
  } = options;
  const router = new Hono();

  const unauthorized = (c: Context, hadToken: boolean) => {
    c.header(
      'WWW-Authenticate',
      `Bearer resource_metadata="${urls.resourceMetadata}"` +
        (hadToken ? ', error="invalid_token"' : ''),
    );
    return c.json({ error: hadToken ? 'invalid_token' : 'Unauthorized' }, 401);
  };

  const handle = async (c: Context) => {
    const authorization = c.req.header('authorization');
    const access = await verifyAccessToken(
      {
        ...deps,
        // Recording the use must never hold up or fail the request.
        touchToken: async (id, now) => {
          runInBackground('MCP token use', deps.touchToken(id, now));
        },
      },
      authorization,
    );
    if (!access) return unauthorized(c, authorization !== undefined);

    if (limiter) {
      const { ok, retryAfter } = limiter.hit(`mcp:${access.user.id}`);
      if (!ok) {
        c.header('Retry-After', String(retryAfter));
        return c.json({ error: 'Too many requests' }, 429);
      }
    }

    if (c.req.method !== 'POST') {
      // Stateless: no stream to resume and no session to end.
      c.header('Allow', 'POST');
      return c.json({ error: 'Method not allowed' }, 405);
    }

    const session = await signSessionToken(
      JWTPayloadSchema.parse(access.user),
      {
        expiresIn: LIFETIMES.mcpSession,
      },
    );
    const api: ApiCall = async (method, path, { query, body } = {}) => {
      const url = new URL(`http://pips.internal/api${path}`);
      for (const [k, v] of Object.entries(query ?? {})) {
        if (v === undefined) continue;
        for (const item of Array.isArray(v) ? v : [v])
          url.searchParams.append(k, String(item));
      }
      // The session as the browser sends it, and no Origin: the request comes from this process, not a page.
      const headers: Record<string, string> = {
        Cookie: `${SESSION_COOKIE}=${session}`,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await dispatch(
        new Request(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      );
      const raw = await res.text();
      let parsed: unknown = raw;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        // Kept as text: some refusals ("Unauthorized") are plain text.
      }
      return { status: res.status, body: parsed };
    };

    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
    registerTools(server, api, scopeIncludes(access.scope, WRITE_SCOPE));
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      await server.close();
    }
  };

  router.post('/mcp', handle);
  router.get('/mcp', handle);
  router.delete('/mcp', handle);
  return router;
}
