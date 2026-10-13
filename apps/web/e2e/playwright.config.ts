/**
 * PIPS! browser harness. See e2e/README.md.
 *
 * Projects:
 * - journeys:  phone-light, phone-dark, tablet-light, tablet-dark, desktop-light, desktop-dark (e2e/journeys)
 * - captures:  capture-phone-light … capture-desktop-dark (e2e/capture; used by e2e:before and e2e:compare-before)
 * - visual:    visual-phone-light … visual-desktop-dark (e2e/visual; reference screenshots, empty until the redesign)
 * - fidelity:  fidelity-<phone|tablet|desk>-<light|dark> (e2e/fidelity), at the locked prototype screens' sizes
 * - review (F1, run only by `pnpm --filter web review`, never by `e2e` or CI): review-<phone|tablet|desktop>-<theme>
 *   and review-narrow320-light (the recorded flows, e2e/review/flows), review-stills-<layout>-<theme>,
 *   review-sweep-<width>-<theme>, review-lab-phone and review-package. See e2e/review/README.md.
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
/** The tablet layout (P0-C): 834 × 1112, touch, device scale 2. Today's screens show their phone layout here. */
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

const JOURNEY_SIZES = { phone: PHONE, tablet: TABLET, desktop: DESKTOP };

const projects: Project[] = [
  ...(['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
    THEMES.map((theme) => ({
      name: `${size}-${theme}`,
      testDir: './journeys',
      // Tag a journey @phone-only or @desktop-only when only one layout has the feature. Tablets are touch layouts
      // below 1024 px, where today's screens show their phone layout, so they run the @phone-only journeys too.
      grepInvert: size === 'desktop' ? /@phone-only/ : /@desktop-only/,
      use: { ...JOURNEY_SIZES[size], colorScheme: theme },
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
  ...reviewProjects(),
];

/**
 * F1's review projects. The flows record a video at the viewport's size with the pointer drawn on each action, and
 * keep the app's own motion (`motion: 'on'`, no reduced motion). `REVIEW_VIDEO=off` runs the same flows as plain
 * tests (part 1, and any check without recording); `REVIEW_ACTIONS=off` drops the action annotations and
 * `REVIEW_STEP_TITLES=on` adds the step titles over the video (only if the pilot shows they cover nothing).
 */
function reviewProjects(): Project[] {
  const video = (viewport: { width: number; height: number }) =>
    process.env.REVIEW_VIDEO === 'off'
      ? ('off' as const)
      : {
          mode: 'on' as const,
          size: viewport,
          show: {
            ...(process.env.REVIEW_ACTIONS === 'off'
              ? {}
              : {
                  actions: {
                    cursor: 'pointer' as const,
                    duration: 500,
                    position: 'top-right' as const,
                    fontSize: 14,
                  },
                }),
            ...(process.env.REVIEW_STEP_TITLES === 'on'
              ? {
                  test: {
                    level: 'step' as const,
                    position: 'bottom' as const,
                    fontSize: 14,
                  },
                }
              : {}),
          },
        };
  const NARROW320 = { ...PHONE, viewport: { width: 320, height: 844 } };
  const sizes = { phone: PHONE, tablet: TABLET, desktop: DESKTOP };
  const flows = [
    ...(['phone', 'tablet', 'desktop'] as const).flatMap((layout) =>
      THEMES.map((theme) => ({
        name: `review-${layout}-${theme}`,
        size: sizes[layout],
        theme,
      })),
    ),
    {
      name: 'review-narrow320-light',
      size: NARROW320,
      theme: 'light' as const,
    },
  ].map(({ name, size, theme }): Project => ({
    name,
    testDir: './review/flows',
    testMatch: /\.flow\.ts$/,
    use: {
      ...size,
      colorScheme: theme,
      reducedMotion: 'no-preference',
      video: video(size.viewport),
      motion: 'on',
    } as Project['use'],
  }));
  const stills = (['phone', 'tablet', 'desktop'] as const).flatMap((layout) =>
    THEMES.map((theme): Project => ({
      name: `review-stills-${layout}-${theme}`,
      testDir: './review',
      testMatch: /stills\.spec\.ts$/,
      use: { ...sizes[layout], colorScheme: theme },
    })),
  );
  // The sweep's widths (SPEC story 146): touch below 1024 px; 200 % zoom on a 1440 × 900 window is 720 × 450 CSS px.
  const SWEEP = {
    '320': { ...PHONE, viewport: { width: 320, height: 844 } },
    '390': PHONE,
    '768': { ...TABLET, viewport: { width: 768, height: 1024 } },
    '1024': { ...DESKTOP, viewport: { width: 1024, height: 768 } },
    '1440': DESKTOP,
    zoom200: {
      ...DESKTOP,
      viewport: { width: 720, height: 450 },
      deviceScaleFactor: 2,
    },
  };
  const sweep = Object.entries(SWEEP).flatMap(([width, size]) =>
    THEMES.map((theme): Project => ({
      name: `review-sweep-${width}-${theme}`,
      testDir: './review',
      testMatch: /sweep\.spec\.ts$/,
      use: { ...size, colorScheme: theme },
    })),
  );
  return [
    ...flows,
    ...stills,
    ...sweep,
    {
      // SPEC's lab phone (lab.spec.ts throttles CPU and network itself), one browser at a time, a cold cache.
      name: 'review-lab-phone',
      testDir: './review',
      testMatch: /lab\.spec\.ts$/,
      fullyParallel: false,
      use: { ...PHONE, colorScheme: 'light' },
    },
    {
      // The built package opened from the file system (package.spec.ts); it needs no app server.
      name: 'review-package',
      testDir: './review',
      testMatch: /package\.spec\.ts$/,
      use: { ...DESKTOP, colorScheme: 'light' },
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
  // Two workers by default (CI too); on the shared Mac use at most E2E_WORKERS=3.
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
