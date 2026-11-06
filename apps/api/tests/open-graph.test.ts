import { strict as assert } from 'node:assert';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import { testUser } from './support/session';
import { callRouter } from './support/router';

// Pages served on 127.0.0.1 (a port the OS picks). The real guard refuses them; tests that need a page widen the
// guard to this one server and nothing else.
let fetchPage: typeof import('../src/lib/safe-fetch').fetchPage;
let isPublicAddress: typeof import('../src/lib/safe-fetch').isPublicAddress;
let UnsafeAddressError: typeof import('../src/lib/safe-fetch').UnsafeAddressError;
let createOpenGraphRouter: typeof import('../src/controllers/open-graph.controller').createOpenGraphRouter;
let createApp: typeof import('../src/app').createApp;
before(async () => {
  usePlaceholderEnv();
  ({ fetchPage, isPublicAddress, UnsafeAddressError } =
    await import('../src/lib/safe-fetch'));
  ({ createOpenGraphRouter } =
    await import('../src/controllers/open-graph.controller'));
  ({ createApp } = await import('../src/app'));
});

let server: Server;
let port: number;
let hits: string[] = [];
before(async () => {
  server = createServer((req, res) => {
    // Only this test's requests (they all carry a path): other software on a shared machine may probe the port.
    if (req.url !== '/') hits.push(req.url ?? '');
    const at = new URL(req.url ?? '/', 'http://x');
    if (at.pathname === '/page') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(
        '<html><head><title>Lomba</title><meta property="og:title" content="Gemastik 2026"></head></html>',
      );
    } else if (at.pathname === '/to') {
      res.writeHead(302, { Location: at.searchParams.get('u') ?? '/' });
      res.end();
    } else if (at.pathname === '/big') {
      res.setHeader('Content-Type', 'text/html');
      res.write(
        '<html><head><meta property="og:title" content="Besar"></head><body>',
      );
      const chunk = 'x'.repeat(64 * 1024);
      let sent = 0;
      const pump = () => {
        while (sent < 8 * 1024 * 1024) {
          sent += chunk.length;
          if (!res.write(chunk)) return res.once('drain', pump);
        }
        res.end('</body></html>');
      };
      pump();
    } else if (at.pathname === '/slow') {
      // Never answers.
    } else if (at.pathname === '/pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.end('%PDF-1.4');
    } else {
      res.statusCode = 404;
      res.end('no');
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  port = (server.address() as AddressInfo).port;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

const thisServerOnly = () => ({
  isAllowedAddress: (ip: string) => ip === '127.0.0.1',
  ports: [port],
});
const local = (path: string) => `http://127.0.0.1:${port}${path}`;

test('isPublicAddress refuses loopback, private, link-local, metadata and reserved addresses', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    '::ffff:169.254.169.254',
    'fd00::1',
    'fe80::1',
    '64:ff9b::a00:1',
    '2002:a00:1::',
    'not-an-ip',
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
  for (const ip of [
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '2606:4700:4700::1111',
  ]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test('fetchPage refuses internal addresses before connecting, by IP or by name', async () => {
  for (const url of [
    local('/page'), // loopback (and a port other than 80/443)
    'http://127.0.0.1/page',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://localhost/',
    'http://0x7f000001/',
    'http://2130706433/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'http://user:pass@example.com/',
  ]) {
    await assert.rejects(fetchPage(url), UnsafeAddressError, url);
  }
  // A name that resolves to loopback is refused at connect time, on the address really used.
  await assert.rejects(
    fetchPage(`http://localhost:${port}/page`, { ports: [port] }),
    UnsafeAddressError,
  );
  assert.deepEqual(hits, []);
});

test('fetchPage checks every redirect the same way', async () => {
  hits = [];
  for (const target of [
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    `http://localhost:${port}/page`, // resolves to loopback (::1 too), not to this one allowed address
    'file:///etc/passwd',
  ]) {
    await assert.rejects(
      fetchPage(local(`/to?u=${encodeURIComponent(target)}`), thisServerOnly()),
      UnsafeAddressError,
      target,
    );
  }
  assert.ok(
    hits.every((h) => h.startsWith('/to')),
    hits.join(),
  );
  // An allowed redirect is followed.
  const page = await fetchPage(
    local(`/to?u=${encodeURIComponent('/page')}`),
    thisServerOnly(),
  );
  assert.equal(page.url, local('/page'));
  assert.match(page.body.toString(), /Gemastik/);
});

test('fetchPage stops at a size and a time limit', async () => {
  const big = await fetchPage(local('/big'), {
    ...thisServerOnly(),
    maxBytes: 100_000,
  });
  assert.ok(big.body.length <= 100_000);
  assert.match(big.body.toString(), /Besar/);

  const start = Date.now();
  await assert.rejects(
    fetchPage(local('/slow'), { ...thisServerOnly(), timeoutMs: 300 }),
    /timeout/,
  );
  assert.ok(Date.now() - start < 2000);
});

const nadia = testUser('u-nadia');

test('previews need a session', async () => {
  const app = createApp();
  const res = await app.request(
    `/api/open-graph?url=${encodeURIComponent('https://example.com/')}`,
  );
  assert.equal(res.status, 401);
});

test('a preview of an internal address is refused with 400, without a request', async () => {
  hits = [];
  const router = createOpenGraphRouter();
  for (const url of [
    local('/page'),
    'http://169.254.169.254/latest/meta-data/',
  ]) {
    const res = await callRouter(
      router,
      nadia,
      'GET',
      `/open-graph?url=${encodeURIComponent(url)}`,
    );
    assert.equal(res.status, 400, url);
    assert.equal(res.body.success, false);
  }
  assert.deepEqual(hits, []);
});

test('a public page still gets its preview, as before', async () => {
  const router = createOpenGraphRouter(thisServerOnly());
  const ok = await callRouter(
    router,
    nadia,
    'GET',
    `/open-graph?url=${encodeURIComponent(local('/page'))}`,
  );
  assert.equal(ok.status, 200);
  assert.equal(ok.body.ogTitle, 'Gemastik 2026');
  assert.equal(ok.body.success, true);
  assert.equal(ok.body.requestUrl, local('/page'));

  const missing = await callRouter(
    router,
    nadia,
    'GET',
    `/open-graph?url=${encodeURIComponent(local('/nope'))}`,
  );
  assert.equal(missing.status, 400);
  assert.equal(missing.body.error, '404 Not Found');

  const pdf = await callRouter(
    router,
    nadia,
    'GET',
    `/open-graph?url=${encodeURIComponent(local('/pdf'))}`,
  );
  assert.equal(pdf.status, 400);
});
