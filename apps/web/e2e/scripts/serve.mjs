/**
 * Builds the app for production (unless E2E_REUSE_BUILD=1 and a build exists) and serves it with `vite preview`.
 * Playwright starts this as its web server. Run from apps/web.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const CONFIG = 'e2e/vite.e2e.config.ts';
const vite = 'node_modules/.bin/vite';

// Every value the app reads from import.meta.env, fixed. Empty means "not set".
Object.assign(process.env, {
  VITE_API_URL: '', // same origin: the mock layer answers /api/** and /socket.io/
  VITE_APP_NAME: 'PIPS!',
  VITE_GOOGLE_CLIENT_ID: 'e2e-google-client-id',
  VITE_VAPID_KEY: 'e2e-vapid-public-key', // P1-C: the push stub records the key it was given
  VITE_SENTRY_DSN: '',
  VITE_ANALYTICS_ID: '',
  VITE_FORCE_MOBILE: '',
  VITE_FORCE_IOS: '',
  VITE_ENABLE_TEST_LOGIN: 'false',
  VITE_MEDIA_URL: 'https://media.pips.test', // P3-A: the file storage; only files there link from a SPARTA answer
});

const reuse =
  process.env.E2E_REUSE_BUILD === '1' && existsSync('e2e/.build/index.html');
if (reuse) {
  console.log('[e2e] reusing the build in e2e/.build (E2E_REUSE_BUILD=1)');
} else {
  console.log('[e2e] building the app for production into e2e/.build');
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
