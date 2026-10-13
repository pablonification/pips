/**
 * Lab speed (F1 brief, step 9) on SPEC's lab phone: 390 × 844, CPU slowed 4× (CDP Emulation.setCPUThrottlingRate),
 * about 1.6 Mbps down, 750 kbps up and 150 ms (CDP Network.emulateNetworkConditions), a cold cache (a new browser
 * context for every run), 3 runs per route. Measures, as ops/ui-revamp-review/reports/performance.md defines them:
 * FCP, LCP, CLS, TBT (the long tasks' time over 50 ms between FCP and 5 s after load), the longest task, the requests
 * and KiB before content, and for Beranda the tap to next paint of a tab switch (Event Timing).
 *
 * The mock layer answers requests inside Playwright, before the emulated network, so the first test checks whether
 * the throttle reaches them; when it doesn't, every /api/ answer here waits the profile's 150 ms itself.
 * Each run appends one line to REVIEW_LAB_OUT (JSON lines); `pnpm --filter web review lab` takes the medians.
 * The installed launch isn't measured: the harness blocks service workers (playwright.config.ts) and its mock
 * doesn't answer a service worker's own requests.
 */
import { appendFileSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from '../support/test';

const OUT = process.env.REVIEW_LAB_OUT;
test.skip(!OUT, 'Set REVIEW_LAB_OUT to run the lab profile.');
test.describe.configure({ mode: 'serial' });

export const PROFILE = {
  cpu: 4,
  latencyMs: 150,
  downKbps: 1600,
  upKbps: 750,
};
const RUNS = 3;

export const LAB_ROUTES = [
  { id: 'login', url: '/login', signedIn: false, ready: (p: Page) => p.getByRole('button', { name: 'Masuk dengan Google' }) },
  { id: 'beranda', url: '/', signedIn: true, ready: (p: Page) => p.getByRole('heading', { name: 'Halo, Nadia' }) },
  { id: 'pengumuman', url: '/pengumuman', signedIn: true, ready: (p: Page) => p.locator('[data-post-link]').first() },
  { id: 'kalender', url: '/kalender', signedIn: true, ready: (p: Page) => p.getByRole('main').getByText('Kuis 2').first() },
  { id: 'layanan', url: '/layanan', signedIn: true, ready: (p: Page) => p.getByRole('main').getByRole('heading', { name: 'Kuliah' }) },
];

async function throttle(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.cpu });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: PROFILE.latencyMs,
    downloadThroughput: (PROFILE.downKbps * 1000) / 8,
    uploadThroughput: (PROFILE.upKbps * 1000) / 8,
  });
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  return cdp;
}

/** Collects paint, LCP, layout shifts, long tasks and interactions from the first byte. */
const OBSERVE = () => {
  const w = window as unknown as { __lab: Record<string, unknown> };
  const lab = (w.__lab = { fcp: 0, lcp: 0, cls: 0, tasks: [] as { start: number; duration: number }[], events: [] as number[] });
  const po = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true, ...extra });
    } catch {
      // not supported
    }
  };
  po('paint', (e) => {
    if (e.name === 'first-contentful-paint') lab.fcp = e.startTime;
  });
  po('largest-contentful-paint', (e) => (lab.lcp = e.startTime));
  po('layout-shift', (e) => {
    const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
    if (!s.hadRecentInput) lab.cls += s.value;
  });
  po('longtask', (e) => lab.tasks.push({ start: e.startTime, duration: e.duration }));
  po('event', (e) => {
    if (e.name === 'click' || e.name === 'pointerup' || e.name === 'pointerdown') lab.events.push(e.duration);
  }, { durationThreshold: 16 });
};

test('the throttle reaches the mock’s answers, or the mock waits 150 ms itself', async ({ page }) => {
  await throttle(page);
  await page.goto('/login');
  const ms = await page.evaluate(async () => {
    const t = performance.now();
    await fetch('/api/me').catch(() => undefined);
    return performance.now() - t;
  });
  appendFileSync(OUT!, `${JSON.stringify({ kind: 'probe', apiMs: Math.round(ms), reaches: ms >= PROFILE.latencyMs * 0.9 })}\n`);
});

for (const r of LAB_ROUTES)
  for (let run = 1; run <= RUNS; run++)
    test.describe(`${r.id} run ${run}`, () => {
      test.use({ signedIn: r.signedIn, persona: r.signedIn ? 'anggota' : null });
      test(`${r.id}, run ${run}`, async ({ page }) => {
        await throttle(page);
        // The mock answers before the emulated network: give its answers the profile's latency.
        await page.route('**/api/**', async (route) => {
          await new Promise((res) => setTimeout(res, PROFILE.latencyMs));
          await route.fallback();
        });
        await page.addInitScript(OBSERVE);
        const before: { url: string; bytes: number }[] = [];
        let counting = true;
        page.on('requestfinished', async (req) => {
          if (!counting || req.url().startsWith('data:')) return;
          const sizes = await req.sizes().catch(() => null);
          before.push({ url: req.url(), bytes: sizes ? sizes.responseBodySize + sizes.responseHeadersSize : 0 });
        });
        await page.goto(r.url);
        await expect(r.ready(page)).toBeVisible({ timeout: 60_000 });
        counting = false;
        await page.waitForTimeout(5000);
        let tap: number | null = null;
        if (r.id === 'beranda') {
          await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: /^Kalender/ }).click();
          await expect(page).toHaveURL(/\/kalender/);
          await page.waitForTimeout(1000);
          tap = await page.evaluate(() => {
            const ev = (window as unknown as { __lab: { events: number[] } }).__lab.events;
            return ev.length ? Math.max(...ev) : null;
          });
        }
        const m = await page.evaluate(() => {
          const lab = (window as unknown as { __lab: { fcp: number; lcp: number; cls: number; tasks: { start: number; duration: number }[] } }).__lab;
          const fcp = lab.fcp || performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null;
          const after = lab.tasks.filter((t) => fcp === null || t.start >= fcp);
          return {
            fcp,
            lcp: lab.lcp || null,
            cls: lab.cls,
            tbt: after.reduce((n, t) => n + Math.max(0, t.duration - 50), 0),
            longestTask: lab.tasks.reduce((n, t) => Math.max(n, t.duration), 0),
          };
        });
        appendFileSync(
          OUT!,
          `${JSON.stringify({
            kind: 'run',
            route: r.id,
            run,
            ...m,
            tapToPaint: tap,
            requestsBeforeContent: before.length,
            kibBeforeContent: Math.round(before.reduce((n, b) => n + b.bytes, 0) / 1024),
          })}\n`,
        );
      });
    });
