import { strict as assert } from 'node:assert';
import { createServer, type Server as HttpServer } from 'node:http';
import { after, before, test } from 'node:test';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { isAllowedOrigin } from '../src/lib/origin';

// A real socket.io server (ports 4510–4519 by default, `API_ORIGIN_TEST_PORT` to move it) with the API's options.
const PORT = Number(process.env.API_ORIGIN_TEST_PORT ?? 4512);
const APP = 'https://app.example.test';
const EVIL = 'https://evil.example.test';

let app: Awaited<ReturnType<typeof load>>['app'];
let socketServerOptions: Awaited<
  ReturnType<typeof load>
>['socketServerOptions'];
async function load() {
  usePlaceholderEnv({ ALLOWED_ORIGINS: JSON.stringify([APP]) });
  const { createApp } = await import('../src/app');
  const { socketServerOptions } = await import('../src/websocket/setup');
  return { app: createApp(), socketServerOptions };
}

let http: HttpServer;
let io: Server;
const clients: ClientSocket[] = [];
before(async () => {
  ({ app, socketServerOptions } = await load());
  http = createServer();
  io = new Server(http, socketServerOptions([APP]));
  io.on('connection', (socket) => {
    socket.on('ping', (ack: (x: string) => void) => ack('pong'));
  });
  await new Promise<void>((resolve) => http.listen(PORT, '127.0.0.1', resolve));
});
after(async () => {
  for (const c of clients) c.disconnect();
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

test("isAllowedOrigin: the allowed origins and the API's own address only", () => {
  const allowed = [APP];
  const host = 'api.example.test';
  assert.equal(isAllowedOrigin({ origin: APP, host }, allowed), true);
  assert.equal(isAllowedOrigin({ origin: `${APP}/`, host }, allowed), true);
  assert.equal(isAllowedOrigin({ origin: EVIL, host }, allowed), false);
  assert.equal(isAllowedOrigin({ origin: 'null', host }, allowed), false);
  assert.equal(
    isAllowedOrigin(
      { origin: 'https://app.example.test.evil.test', host },
      allowed,
    ),
    false,
  );
  assert.equal(
    isAllowedOrigin({ origin: 'http://app.example.test', host }, allowed),
    false,
  );
  // One origin with the API (staging and local development through Vite's proxy).
  assert.equal(
    isAllowedOrigin({ origin: 'https://api.example.test', host }, allowed),
    true,
  );
  assert.equal(
    isAllowedOrigin(
      {
        origin: 'https://staging.example.test',
        host: '127.0.0.1:5000',
        forwardedHost: 'staging.example.test',
      },
      allowed,
    ),
    true,
  );
  // Without Origin, the Referer decides; with neither, it isn't a browser acting for another site.
  assert.equal(
    isAllowedOrigin({ referer: `${APP}/pengumuman`, host }, allowed),
    true,
  );
  assert.equal(isAllowedOrigin({ referer: `${EVIL}/x`, host }, allowed), false);
  assert.equal(isAllowedOrigin({ host }, allowed), true);
});

async function post(headers: Record<string, string>, method = 'POST') {
  return await app.request('http://api.example.test/api/logout', {
    method,
    headers,
  });
}

test('a write from another website is refused with 403 before anything else', async () => {
  for (const headers of <Array<Record<string, string>>>[
    { Origin: EVIL },
    { Origin: 'null' },
    { Referer: `${EVIL}/page` },
  ]) {
    const res = await post(headers);
    assert.equal(res.status, 403, JSON.stringify(headers));
    assert.deepEqual(await res.json(), { error: 'Forbidden origin' });
  }
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal((await post({ Origin: EVIL }, method)).status, 403, method);
  }
});

test("the app's own writes go through (here to the session check: 401 signed out)", async () => {
  for (const headers of <Array<Record<string, string>>>[
    { Origin: APP },
    { Referer: `${APP}/profil` },
    { Origin: 'http://api.example.test' },
    {},
  ]) {
    assert.equal((await post(headers)).status, 401, JSON.stringify(headers));
  }
});

test('reads are never refused for their origin', async () => {
  const res = await app.request('http://api.example.test/api/me', {
    headers: { Origin: EVIL },
  });
  assert.equal(res.status, 401);
});

async function socket(
  origin: string | undefined,
  transport: 'websocket' | 'polling',
) {
  const s = connect(`http://127.0.0.1:${PORT}`, {
    transports: [transport],
    extraHeaders: origin ? { Origin: origin } : {},
    forceNew: true,
    reconnection: false,
    timeout: 3000,
  });
  clients.push(s);
  return await new Promise<'connected' | 'refused'>((resolve) => {
    s.once('connect', () => resolve('connected'));
    s.once('connect_error', () => resolve('refused'));
  });
}

test('the socket refuses another website on every transport', async () => {
  for (const transport of ['websocket', 'polling'] as const) {
    assert.equal(await socket(EVIL, transport), 'refused', transport);
    assert.equal(await socket('null', transport), 'refused', transport);
  }
  assert.equal(io.engine.clientsCount, 0);
});

test("the socket accepts the app's origin, its own address, and clients without an origin", async () => {
  for (const transport of ['websocket', 'polling'] as const) {
    assert.equal(await socket(APP, transport), 'connected', transport);
    assert.equal(
      await socket(`http://127.0.0.1:${PORT}`, transport),
      'connected',
      transport,
    );
    assert.equal(await socket(undefined, transport), 'connected', transport);
  }
  const s = clients.at(-1)!;
  assert.equal(await s.timeout(2000).emitWithAck('ping'), 'pong');
});
