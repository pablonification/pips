/**
 * PIPS! browser harness. See e2e/README.md.
 *
 * Projects:
 * - journeys:  phone-light, phone-dark, desktop-light, desktop-dark (e2e/journeys)
 * - captures:  capture-phone-light … capture-desktop-dark (e2e/capture; used by e2e:before and e2e:compare-before)
 * - visual:    visual-phone-light … visual-desktop-dark (e2e/visual; reference screenshots, empty until the redesign)
 * - fidelity:  fidelity-<phone|tablet|desk>-<light|dark> (e2e/fidelity), at the locked prototype screens' sizes
 */
import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
  type Project,
} from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_PORT } from './port';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = `http://127.0.0.1:${E2E_PORT}`;

/** Sizes from SPEC "Testing Decisions": phone 390 × 844 (touch, device scale 2), desktop 1440 × 900. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
};
export const DESKTOP = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};
/** Sizes of the locked prototype screens (ops/ui-revamp-review/tools/garis-check.mjs). */
export const FIDELITY = {
  phone: { ...PHONE, viewport: { width: 390, height: 800 } },
  tablet: {
    viewport: { width: 834, height: 1068 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['Galaxy Tab S4'].userAgent,
  },
  desk: {
    viewport: { width: 1440, height: 956 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};
const THEMES = ['light', 'dark'] as const;

const projects: Project[] = [
  ...(['phone', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `${size}-${theme}`,
      testDir: './journeys',
      // Tag a journey @phone-only or @desktop-only when only one layout has the feature.
      grepInvert: size === 'phone' ? /@desktop-only/ : /@phone-only/,
      use: { ...(size === 'phone' ? PHONE : DESKTOP), colorScheme: theme },
    })),
  ),
  ...(['phone', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `capture-${size}-${theme}`,
      testDir: './capture',
      grepInvert: size === 'phone' ? /@desktop-only/ : /@phone-only/,
      use: { ...(size === 'phone' ? PHONE : DESKTOP), colorScheme: theme },
    })),
  ),
  ...(['phone', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `visual-${size}-${theme}`,
      testDir: './visual',
      grepInvert: size === 'phone' ? /@desktop-only/ : /@phone-only/,
      use: { ...(size === 'phone' ? PHONE : DESKTOP), colorScheme: theme },
    })),
  ),
  ...(['phone', 'tablet', 'desk'] as const).flatMap((layout) =>
    THEMES.map((theme) => ({
      name: `fidelity-${layout}-${theme}`,
      testDir: './fidelity',
      use: { ...FIDELITY[layout], colorScheme: theme },
    })),
  ),
];

const config: PlaywrightTestConfig = defineConfig({
  outputDir: './.results',
  // Generous: the shared host is often busy, and axe on a long page takes seconds.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Two workers by default: the host this runs on has four threads shared with other work.
  workers: Number(process.env.E2E_WORKERS ?? 2),
  reporter: [['list'], ['html', { outputFolder: './.report', open: 'never' }]],
  use: {
    baseURL,
    timezoneId: 'Asia/Jakarta',
    locale: 'id-ID',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node e2e/scripts/serve.mjs',
    cwd: appDir,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15 * 60_000,
    stdout: 'pipe',
  },
  projects,
});
export default config;
