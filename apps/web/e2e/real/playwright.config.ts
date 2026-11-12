/**
 * Journeys against the real API (`pnpm --filter web e2e:real`): the production build talks to the API itself, on a
 * database seeded with the made-up HMIF (apps/api/src/db/seed/sample-hmif.ts), on the real clock. No pretend API.
 * They prove the two sides fit; the journey suite in e2e/journeys covers the screens. See docs/testing.md.
 *
 * Needs E2E_REAL_DATABASE_URL: a local PostgreSQL database named pips_…, which they migrate, seed and write to.
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHONE } from '../playwright.config';
import { REAL_API_URL, REAL_WEB_URL } from './ports.mjs';

const appDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export default defineConfig({
  testDir: '.',
  testMatch: /\.spec\.ts$/,
  outputDir: '../.results-real',
  // The journeys share one database and one API: run them one after another.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: '../.report-real', open: 'never' }]]
    : 'list',
  use: {
    ...PHONE,
    baseURL: REAL_WEB_URL,
    colorScheme: 'light',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node e2e/real/serve-api.mjs',
      cwd: appDir,
      url: `${REAL_API_URL}/`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'node e2e/real/serve-web.mjs',
      cwd: appDir,
      url: REAL_WEB_URL,
      timeout: 300_000,
      reuseExistingServer: false,
    },
  ],
});
