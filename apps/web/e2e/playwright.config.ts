/**
 * PIPS! browser harness. See e2e/README.md.
 *
 * Projects:
 * - journeys:  phone-light, phone-dark, tablet-light, tablet-dark, desktop-light, desktop-dark (e2e/journeys)
 * - solo:      solo-<phone|tablet|desktop>-<theme>: the journeys tagged @solo, alone (`e2e:solo`, one worker)
 * - visual:    visual-phone-light … visual-desktop-dark (e2e/visual; reference screenshots)
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

/** Test sizes: phone 390 × 844 (touch, device scale 2), desktop 1440 × 900. */
export const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Pixel 7'].userAgent,
};
/** The tablet layout: 834 × 1112, touch, device scale 2: the rail beside one column. */
export const TABLET = {
  viewport: { width: 834, height: 1112 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['Galaxy Tab S4'].userAgent,
};
export const DESKTOP = {
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};
const THEMES = ['light', 'dark'] as const;

const JOURNEY_SIZES = { phone: PHONE, tablet: TABLET, desktop: DESKTOP };

const projects: Project[] = [
  ...(['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `${size}-${theme}`,
      testDir: './journeys',
      // Tag a journey @phone-only or @desktop-only when only one layout has the feature. Tablets are touch layouts
      // below 1024 px, so they run the @phone-only journeys too. @solo journeys run in solo-* instead.
      grepInvert:
        size === 'desktop' ? /@phone-only|@solo/ : /@desktop-only|@solo/,
      use: { ...JOURNEY_SIZES[size], colorScheme: theme },
    })),
  ),
  // Journeys that time the main thread (@solo) run here, one test at a time with nothing beside them
  // (`e2e:solo`, --workers=1): on CI's runner a neighbouring test's CPU use alone breaks their budgets.
  ...(['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `solo-${size}-${theme}`,
      testDir: './journeys',
      grep: /@solo/,
      grepInvert: size === 'desktop' ? /@phone-only/ : /@desktop-only/,
      use: { ...JOURNEY_SIZES[size], colorScheme: theme },
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
  ...qaProjects(),
];

/**
 * Cross-cutting checks (e2e/qa, see its README). In CI's `e2e` script: qa-<layout>-<theme> (the fixed rules, the
 * Tab walk, errors, links and roles on every page), qa-reflow (400 % zoom), qa-motion (the app's own motion under
 * reduced motion), qa-sw (the service worker: the installed app offline, the share target) and qa-london (the
 * time-heavy journeys in another device time zone). qa-perf (a lab phone) runs by hand only.
 */
function qaProjects(): Project[] {
  const SPECIAL = /(reflow|motion|sw|perf)\.spec\.ts$/;
  return [
    ...(['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
      THEMES.map((theme) => ({
        name: `qa-${size}-${theme}`,
        testDir: './qa',
        testIgnore: SPECIAL,
        use: { ...JOURNEY_SIZES[size], colorScheme: theme },
      })),
    ),
    {
      // 400 % zoom: a 1280 × 1024 window at 400 % is 320 × 256 CSS px (WCAG reflow).
      name: 'qa-reflow',
      testDir: './qa',
      testMatch: /reflow\.spec\.ts$/,
      use: {
        ...PHONE,
        viewport: { width: 320, height: 256 },
        deviceScaleFactor: 4,
        colorScheme: 'light',
      },
    },
    {
      name: 'qa-motion',
      testDir: './qa',
      testMatch: /motion\.spec\.ts$/,
      use: { ...PHONE, colorScheme: 'light', motion: 'on' } as Project['use'],
    },
    {
      name: 'qa-sw',
      testDir: './qa',
      testMatch: /sw\.spec\.ts$/,
      use: { ...PHONE, colorScheme: 'light', serviceWorkers: 'allow' },
    },
    {
      name: 'qa-perf',
      testDir: './qa',
      testMatch: /perf\.spec\.ts$/,
      fullyParallel: false,
      use: { ...PHONE, colorScheme: 'light' },
    },
    {
      // Times must show in WIB whatever the device's zone.
      name: 'qa-london-phone-light',
      testDir: './journeys',
      testMatch:
        /(kalender|beranda|lomba|form|compose|announcements)\.spec\.ts$/,
      grepInvert: /@desktop-only/,
      use: { ...PHONE, colorScheme: 'light', timezoneId: 'Europe/London' },
    },
  ];
}

const config: PlaywrightTestConfig = defineConfig({
  outputDir: './.results',
  // Generous: the machine is shared with other work, and axe on a long page takes seconds.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Two workers by default (CI too): journeys are CPU-heavy and more workers make them flaky.
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
