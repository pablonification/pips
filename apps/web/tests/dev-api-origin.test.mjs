import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfigFromFile } from 'vite';

async function proxy() {
  const { config } = await loadConfigFromFile({
    mode: 'development',
    command: 'serve',
  });
  return config.server.proxy;
}

function targets(p) {
  return [p['/api'], p['/socket.io'].target, p['/swagger'], p['/doc']];
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
  } finally {
    if (previous === undefined) delete process.env.DEV_API_ORIGIN;
    else process.env.DEV_API_ORIGIN = previous;
  }
});

test('DEV_API_ORIGIN never reaches the bundle', async () => {
  process.env.DEV_API_ORIGIN = 'http://127.0.0.1:5100';
  try {
    const { config } = await loadConfigFromFile({
      mode: 'production',
      command: 'build',
    });
    assert.equal(JSON.stringify(config.define).includes('5100'), false);
    assert.equal(config.envPrefix, undefined);
  } finally {
    delete process.env.DEV_API_ORIGIN;
  }
});
