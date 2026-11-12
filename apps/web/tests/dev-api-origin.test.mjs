import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
// The config reads .env files from the working directory. An empty one keeps a developer's own untracked
// .env.*.local files out of what these tests check.
const emptyDir = mkdtempSync(path.join(tmpdir(), 'dev-api-origin-'));
const startDir = process.cwd();
process.chdir(emptyDir);
after(() => {
  process.chdir(startDir);
  rmSync(emptyDir, { recursive: true, force: true });
});

async function proxy() {
  const { config } = await loadConfigFromFile(
    { mode: 'development', command: 'serve' },
    configFile,
    emptyDir,
  );
  return config.server.proxy;
}

function targets(p) {
  return [p['/api'].target, p['/socket.io'].target, p['/swagger'], p['/doc']];
}

test('the dev server proxies the API to 127.0.0.1:5000 by default, or to DEV_API_ORIGIN', async () => {
  const previous = process.env.DEV_API_ORIGIN;
  try {
    delete process.env.DEV_API_ORIGIN;
    assert.deepEqual(
      targets(await proxy()),
      Array(4).fill('http://127.0.0.1:5000'),
    );

    process.env.DEV_API_ORIGIN = 'http://127.0.0.1:5100';
    const p = await proxy();
    assert.deepEqual(targets(p), Array(4).fill('http://127.0.0.1:5100'));
    assert.equal(p['/socket.io'].ws, true);
    // The browser's host reaches the API (X-Forwarded-Host), so it knows the app's writes and socket as its own
    // origin (apps/api/src/lib/origin.ts).
    assert.equal(p['/api'].xfwd, true);
    assert.equal(p['/api'].changeOrigin, true);
    assert.equal(p['/socket.io'].xfwd, true);
  } finally {
    if (previous === undefined) delete process.env.DEV_API_ORIGIN;
    else process.env.DEV_API_ORIGIN = previous;
  }
});

test('DEV_API_ORIGIN never reaches the bundle', async () => {
  process.env.DEV_API_ORIGIN = 'http://127.0.0.1:5100';
  try {
    const { config } = await loadConfigFromFile(
      { mode: 'production', command: 'build' },
      configFile,
      emptyDir,
    );
    assert.equal(JSON.stringify(config.define).includes('5100'), false);
    assert.equal(config.envPrefix, undefined);
  } finally {
    delete process.env.DEV_API_ORIGIN;
  }
});
