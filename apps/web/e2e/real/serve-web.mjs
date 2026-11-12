/**
 * Builds the app for production against the real API that serve-api.mjs runs, and serves it with `vite preview`.
 * Playwright starts this as a web server for `e2e:real`. Run from apps/web. E2E_REUSE_BUILD=1 reuses the last build.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { REAL_API_URL } from './ports.mjs';

const CONFIG = 'e2e/real/vite.config.ts';
const vite = 'node_modules/.bin/vite';

// Every value the app reads from import.meta.env, fixed. Empty means "not set".
Object.assign(process.env, {
  VITE_API_URL: REAL_API_URL,
  VITE_APP_NAME: 'PIPS!',
  VITE_GOOGLE_CLIENT_ID: 'e2e-real-google-client-id',
  VITE_VAPID_KEY: '',
  VITE_SENTRY_DSN: '',
  VITE_ANALYTICS_ID: '',
  VITE_ENABLE_TEST_LOGIN: 'false',
  VITE_MEDIA_URL: 'http://127.0.0.1:9',
});

if (
  process.env.E2E_REUSE_BUILD === '1' &&
  existsSync('e2e/.build-real/index.html')
) {
  console.log('[e2e:real] reusing the build in e2e/.build-real');
} else {
  console.log(
    '[e2e:real] building the app for production into e2e/.build-real',
  );
  const build = spawnSync(
    vite,
    ['build', '--config', CONFIG, '--mode', 'production', '--logLevel', 'warn'],
    { stdio: 'inherit' },
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const preview = spawn(
  vite,
  ['preview', '--config', CONFIG, '--mode', 'production'],
  { stdio: 'inherit' },
);
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM']))
  process.on(signal, () => preview.kill(signal));
preview.on('exit', (code) => process.exit(code ?? 0));
