import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { getPath } from 'hono/utils/url';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { env } from './configs/env.config';
import { apiRouter } from './controllers/api.controller';
import { db } from './db/drizzle';
import { MAX_BODY_BYTES, RATE_LIMITS, RATE_WINDOW_MS } from './lib/limits';
import { isAllowedOrigin, SAFE_METHODS } from './lib/origin';
import {
  clientAddress,
  createRateLimiter,
  rateLimit,
  sessionUserId,
} from './lib/rate-limit';
import { redactedQuery } from './lib/redact';
import { isShuttingDown } from './lib/shutdown';
import { logger } from './logger';
import {
  CurhatJoinAckSchema,
  CurhatJoinPayloadSchema,
  CurhatMessageAckSchema,
  CurhatMessagePayloadSchema,
  CurhatReplyEventSchema,
  CurhatSocketErrorSchema,
  CurhatSocketMessageSchema,
} from './types/curhat.types';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(dirname, '../package.json'), 'utf-8'),
);

const OPENAPI_CONFIG = {
  openapi: '3.1.0',
  info: {
    version: packageJson.version,
    title: packageJson.displayName,
  },
  tags: [
    { name: 'push', description: 'Push event API' },
    { name: 'auth', description: 'Auth API' },
    { name: 'media', description: 'Media API' },
    { name: 'info', description: 'Info API' },
    { name: 'course', description: 'Course API' },
    { name: 'comment', description: 'Comment API' },
    { name: 'reaction', description: 'Comment API' },
    { name: 'open-graph', description: 'Scrape Open Graph API' },
    { name: 'category', description: 'Category API' },
    { name: 'unsubscribe', description: 'Unsubscribe API' },
    { name: 'calendar', description: 'Calendar API' },
    { name: 'testimoni', description: 'Testimoni API' },
    { name: 'user-profile', description: 'User Profile API' },
    { name: 'user-finder', description: 'User Finder API' },
    { name: 'competitions', description: 'Competitions API' },
    { name: 'markdown', description: 'Markdown API' },
    { name: 'recommendation', description: 'Recommendations API' },
    { name: 'curhat', description: 'Curhat API' },
    { name: 'internship', description: 'Internship API' },
    { name: 'form', description: 'Form API' },
    { name: 'programme-window', description: 'Programme windows API' },
  ],
};

/** Every way to sign in: limited per client address. */
const SIGN_IN_PATHS = new Set([
  '/api/login',
  '/api/auth/login/accesstoken',
  '/api/auth/login/dev',
  '/api/auth/login/bypass',
  '/api/auth/google/callback',
]);

export function isDevelopmentOrStaging(config: { APP_ENV?: string }) {
  return config.APP_ENV === 'development' || config.APP_ENV === 'staging';
}

/**
 * The OpenAPI document of `app`, as `/doc` serves it on development and staging. The web client's generator
 * (`scripts/openapi.ts`) reads it here, so it never depends on where the API runs.
 */
export function openApiDocument(app: ReturnType<typeof createApp>) {
  return app.getOpenAPIDocument(OPENAPI_CONFIG);
}

/**
 * Builds the HTTP app: middleware, every route and the OpenAPI document. It opens no port, starts no cron job
 * and no socket server (`index.ts` does), and touches no database until a request needs one, so tests and the
 * web client's generator (`scripts/openapi.ts`) can use it without a running server.
 */
export interface AppOptions {
  /** Per-minute limits instead of the defaults (tests). */
  rateLimits?: Partial<typeof RATE_LIMITS>;
  /** Rejects when the database can't answer; `/health` reports it. */
  checkDatabase?: () => Promise<unknown>;
}

/** Health checks give up on the database after this long, so a stuck pool reads as down, not as a hung check. */
const HEALTH_DB_TIMEOUT_MS = 2000;

export function createApp({
  rateLimits,
  checkDatabase = async () => await db.execute(sql`select 1`),
}: AppOptions = {}) {
  const limits = { ...RATE_LIMITS, ...rateLimits };
  const app = new OpenAPIHono<{
    Variables: RequestIdVariables;
  }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({ errors: result.error.flatten() }, 400);
      }
    },
  });
  app.use('*', requestId());

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // Get the custom response
      return err.getResponse();
    }

    Sentry.captureException(err);
    return c.json({ error: 'Something went wrong' }, 500);
  });

  app.use(async (c, next) => {
    const { method } = c.req;
    const path = getPath(c.req.raw);
    // Never a secret in the log: the bypass key, an OAuth code or state travel in the address.
    const params = redactedQuery(c.req.url);

    const start = performance.now();
    await next();
    const end = performance.now();
    logger.info({
      requestId: c.var.requestId,
      path,
      params,
      method,
      type: 'request',
      duration: end - start,
      userId: c.get('user' as any)?.id,
    });
  });

  app.use(
    '/api/*',
    cors({
      credentials: true,
      origin: env.ALLOWED_ORIGINS,
    }),
  );
  // Another website's page can't act with the member's session: every request that changes something must come
  // from the app (lib/origin.ts). CORS stops other sites reading answers, not sending forms or beacons.
  app.use('/api/*', async (c, next) => {
    if (
      !SAFE_METHODS.has(c.req.method) &&
      !isAllowedOrigin(
        {
          origin: c.req.header('origin'),
          referer: c.req.header('referer'),
          host: c.req.header('host') ?? new URL(c.req.url).host,
          forwardedHost: c.req.header('x-forwarded-host'),
        },
        env.ALLOWED_ORIGINS,
      )
    ) {
      return c.json({ error: 'Forbidden origin' }, 403);
    }
    await next();
  });
  app.use(
    '/api/*',
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json({ error: 'Request body too large' }, 413),
    }),
  );
  // In memory, per minute (one API instance). Generous enough that using the app never meets them.
  const window = { windowMs: RATE_WINDOW_MS };
  const signIn = createRateLimiter({ limit: limits.signIn, ...window });
  const writes = createRateLimiter({ limit: limits.writes, ...window });
  const previews = createRateLimiter({ limit: limits.previews, ...window });
  app.use(
    '/api/*',
    rateLimit(signIn, (c) =>
      SIGN_IN_PATHS.has(getPath(c.req.raw))
        ? clientAddress(c, env.CLIENT_IP_HEADER)
        : undefined,
    ),
  );
  app.use(
    '/api/*',
    rateLimit(writes, async (c) => {
      if (SAFE_METHODS.has(c.req.method)) return undefined;
      const userId = await sessionUserId(c, env.JWT_SECRET);
      return userId
        ? `user:${userId}`
        : `address:${clientAddress(c, env.CLIENT_IP_HEADER)}`;
    }),
  );
  app.use(
    '/api/open-graph',
    rateLimit(previews, async (c) => await sessionUserId(c, env.JWT_SECRET)),
  );
  app.get('/', (c) => c.json({ message: 'Server runs successfully' }));
  // For load balancers and monitoring: 200 while the API can reach its database, 503 when it can't or is shutting down.
  app.get('/health', async (c) => {
    if (isShuttingDown()) {
      return c.json({ status: 'shutting-down' }, 503);
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        checkDatabase(),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error('Database check timed out'));
          }, HEALTH_DB_TIMEOUT_MS);
        }),
      ]);
      return c.json({ status: 'ok', database: 'ok' }, 200);
    } catch (error) {
      logger.warn({ type: 'health', message: String(error) });
      return c.json({ status: 'unavailable', database: 'unreachable' }, 503);
    } finally {
      clearTimeout(timer);
    }
  });
  app.route('/api', apiRouter);
  // The chat socket's payloads (websocket/curhat.ts) aren't routes; listing them puts their types in the web client.
  for (const [name, schema] of Object.entries({
    CurhatMessagePayload: CurhatMessagePayloadSchema,
    CurhatJoinPayload: CurhatJoinPayloadSchema,
    CurhatSocketError: CurhatSocketErrorSchema,
    CurhatSocketMessage: CurhatSocketMessageSchema,
    CurhatMessageAck: CurhatMessageAckSchema,
    CurhatJoinAck: CurhatJoinAckSchema,
    CurhatReplyEvent: CurhatReplyEventSchema,
  })) {
    app.openAPIRegistry.register(name, schema);
  }
  // The document and its viewer are for development and staging; production doesn't publish its routes.
  if (isDevelopmentOrStaging(env)) {
    app.doc('/doc', OPENAPI_CONFIG);
    app.get('/swagger', swaggerUI({ url: '/doc' }));
  }

  return app;
}
