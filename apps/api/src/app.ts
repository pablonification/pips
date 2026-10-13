import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import * as Sentry from '@sentry/node';
import fs from 'fs';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { requestId, type RequestIdVariables } from 'hono/request-id';
import { getPath, getQueryStrings } from 'hono/utils/url';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { env } from './configs/env.config';
import { apiRouter } from './controllers/api.controller';
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

/**
 * Builds the HTTP app: middleware, every route and the OpenAPI document. It opens no port, starts no cron job
 * and no socket server (`index.ts` does), and touches no database until a request needs one, so tests and the
 * web client's generator (`scripts/openapi.ts`) can use it without a running server.
 */
export function createApp() {
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
    const params = getQueryStrings(c.req.url);

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
  app.get('/', (c) => c.json({ message: 'Server runs successfully' }));
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
  app.doc('/doc', {
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
  });
  app.get('/swagger', swaggerUI({ url: '/doc' }));

  return app;
}
