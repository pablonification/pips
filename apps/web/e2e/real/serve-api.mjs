/**
 * Migrates and seeds the database in E2E_REAL_DATABASE_URL, then runs the real API on it with made-up settings.
 * Playwright starts this as a web server for `e2e:real`. Run from apps/web.
 *
 * The database must be local and named pips_…: the journeys write to it. Nothing here is a real secret: the session
 * key and the login bypass key are fixed strings that only this throwaway API knows, the push key pair is made on the
 * spot, and Google, file storage and Sentry lead nowhere.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REAL_API_PORT, REAL_WEB_URL } from './ports.mjs';
import { REAL_BYPASS_KEY } from './secrets.mjs';

const apiDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../api',
);

const url = process.env.E2E_REAL_DATABASE_URL;
if (!url) {
  console.error(
    'E2E_REAL_DATABASE_URL is required: a local PostgreSQL database named pips_… (docs/testing.md)',
  );
  process.exit(1);
}
const parsed = new URL(url);
if (
  !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
  !parsed.pathname.slice(1).startsWith('pips_')
) {
  console.error('E2E_REAL_DATABASE_URL must be a local database named pips_…');
  process.exit(1);
}

const webPush = createRequire(path.join(apiDir, 'package.json'))('web-push');
const vapid = webPush.generateVAPIDKeys();

/** @type {Record<string, string | undefined>} */
const env = {
  ...process.env,
  DOTENV_CONFIG_PATH: '/nonexistent/pips-e2e-real.env',
  DATABASE_URL: url,
  APP_ENV: 'development',
  NODE_ENV: 'development',
  ENABLE_TEST_LOGIN: 'false',
  PORT: String(REAL_API_PORT),
  LISTEN_HOST: '127.0.0.1',
  CLIENT_IP_HEADER: 'none',
  ALLOWED_ORIGINS: JSON.stringify([REAL_WEB_URL]),
  JWT_SECRET: 'e2e-real-api-session-key-not-a-secret-0123456789',
  TOKEN_EXPIRATION: '3600',
  LOGIN_BYPASS_KEY: REAL_BYPASS_KEY,
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_MAILTO: 'e2e@example.com',
  GOOGLE_CLIENT_ID: 'e2e-real-google-client-id',
  GOOGLE_CLIENT_SECRET: 'e2e-real',
  GOOGLE_CALLBACK_URL: 'http://127.0.0.1:9/callback',
  GOOGLE_CALENDAR_SECRET_PATH: '/nonexistent/google_credentials.json',
  R2_ENDPOINT: 'http://127.0.0.1:9',
  R2_PUBLIC_URL: 'http://127.0.0.1:9',
};
for (const key of [
  'SENTRY_DSN',
  'AXIOM_DATASET',
  'AXIOM_TOKEN',
  'DEV_LOGIN_EMAIL',
  'DEV_LOGIN_PASSWORD_HASH',
])
  delete env[key];

const tsx = ['--import', 'tsx'];
for (const script of ['src/db/migrate.ts', 'src/db/seed.ts']) {
  const run = spawnSync(process.execPath, [...tsx, script], {
    cwd: apiDir,
    env,
    stdio: 'inherit',
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}

const api = spawn(process.execPath, [...tsx, 'src/index.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
});
for (const signal of /** @type {const} */ (['SIGINT', 'SIGTERM']))
  process.on(signal, () => api.kill(signal));
api.on('exit', (code) => process.exit(code ?? 0));
