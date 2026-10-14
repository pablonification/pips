/**
 * F2 (brief step 15) on the qa-perf project, run by hand (SPEC: the lab run isn't a gate on every push):
 *   QA_PERF_OUT=/tmp/perf.jsonl E2E_REUSE_BUILD=1 pnpm exec playwright test -c e2e --project=qa-perf
 * SPEC's lab phone as F1's lab (`review/lab.spec.ts`): CPU 4×, 1.6 Mbps down, 750 kbps up, 150 ms (the mock's
 * answers wait the 150 ms themselves, since the throttle doesn't reach them), a cold cache, 3 runs per page. Seven
 * pages, Live Counting as Raka. Each run appends FCP, LCP, CLS, TBT, the longest task, requests and KiB before
 * content, first-party JS before content, and on Beranda the tap to next paint, as one JSON line.
 */
import { appendFileSync } from 'node:fs';
import type { CDPSession, Page } from '@playwright/test';
import { expect, test } from '../support/test';

const OUT = process.env.QA_PERF_OUT;
test.skip(!OUT, 'Set QA_PERF_OUT to run the lab profile.');
test.describe.configure({ mode: 'serial' });

const PROFILE = { cpu: 4, latencyMs: 150, downKbps: 1600, upKbps: 750 };
const RUNS = 3;

const PAGES: {
  id: string;
  url: string;
  persona: 'anggota' | 'pengurus';
  ready: (p: Page) => ReturnType<Page['locator']>;
}[] = [
  {
    id: 'beranda',
    url: '/',
    persona: 'anggota',
    ready: (p) => p.getByRole('heading', { name: 'Halo, Nadia' }),
  },
  {
    id: 'pengumuman',
    url: '/pengumuman',
    persona: 'anggota',
    ready: (p) => p.locator('[data-post-link]').first(),
  },
  {
    id: 'post',
    url: '/pengumuman/p1',
    persona: 'anggota',
    ready: (p) => p.locator('h1:visible'),
  },
  {
    id: 'kalender',
    url: '/kalender',
    persona: 'anggota',
    ready: (p) => p.getByRole('main').getByText('Kuis 2').first(),
  },
  {
    id: 'layanan',
    url: '/layanan',
    persona: 'anggota',
    ready: (p) => p.getByRole('main').getByRole('heading', { name: 'Kuliah' }),
  },
  {
    id: 'form',
    url: '/layanan/form/pixel',
    persona: 'anggota',
    ready: (p) => p.locator('h1:visible'),
  },
  {
    id: 'live',
    url: '/kelola/live',
    persona: 'pengurus',
    ready: (p) => p.getByText('orang sudah mengisi'),
  },
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

const OBSERVE = () => {
  const w = window as unknown as { __lab: Record<string, unknown> };
  const lab = (w.__lab = {
    fcp: 0,
    lcp: 0,
    cls: 0,
    tasks: [] as { start: number; duration: number }[],
    events: [] as number[],
  });
  const po = (
    type: string,
    cb: (e: PerformanceEntry) => void,
    extra: Record<string, unknown> = {},
  ) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({
        type,
        buffered: true,
        ...extra,
      });
    } catch {
      // not supported
    }
  };
  po('paint', (e) => {
    if (e.name === 'first-contentful-paint') lab.fcp = e.startTime;
  });
  po('largest-contentful-paint', (e) => (lab.lcp = e.startTime));
  po('layout-shift', (e) => {
    const s = e as PerformanceEntry & {
      value: number;
      hadRecentInput: boolean;
    };
    if (!s.hadRecentInput) lab.cls += s.value;
  });
  po('longtask', (e) =>
    lab.tasks.push({ start: e.startTime, duration: e.duration }),
  );
  po(
    'event',
    (e) => {
      if (['click', 'pointerup', 'pointerdown'].includes(e.name))
        lab.events.push(e.duration);
    },
    { durationThreshold: 16 },
  );
};

for (const r of PAGES)
  for (let run = 1; run <= RUNS; run++)
    test.describe(`${r.id} run ${run}`, () => {
      test.use({ persona: r.persona });
      test(`${r.id}, run ${run}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'qa-perf', 'qa-perf');
        await throttle(page);
        await page.route('**/api/**', async (route) => {
          await new Promise((res) => setTimeout(res, PROFILE.latencyMs));
          await route.fallback();
        });
        await page.addInitScript(OBSERVE);
        const before: { url: string; bytes: number; type: string }[] = [];
        let counting = true;
        page.on('requestfinished', async (req) => {
          if (!counting || req.url().startsWith('data:')) return;
          const sizes = await req.sizes().catch(() => null);
          before.push({
            url: req.url(),
            type: req.resourceType(),
            bytes: sizes
              ? sizes.responseBodySize + sizes.responseHeadersSize
              : 0,
          });
        });
        await page.goto(r.url);
        await expect(r.ready(page)).toBeVisible({ timeout: 60_000 });
        counting = false;
        await page.waitForTimeout(5000);
        let tap: number | null = null;
        if (r.id === 'beranda') {
          await page
            .getByRole('navigation', { name: 'Navigasi utama' })
            .getByRole('link', { name: /^Kalender/ })
            .click();
          await expect(page).toHaveURL(/\/kalender/);
          await page.waitForTimeout(1000);
          tap = await page.evaluate(() => {
            const ev = (window as unknown as { __lab: { events: number[] } })
              .__lab.events;
            return ev.length ? Math.max(...ev) : null;
          });
        }
        const m = await page.evaluate(() => {
          const lab = (
            window as unknown as {
              __lab: {
                fcp: number;
                lcp: number;
                cls: number;
                tasks: { start: number; duration: number }[];
              };
            }
          ).__lab;
          const fcp =
            lab.fcp ||
            performance.getEntriesByName('first-contentful-paint')[0]
              ?.startTime ||
            null;
          const after = lab.tasks.filter((t) => fcp === null || t.start >= fcp);
          return {
            fcp,
            lcp: lab.lcp || null,
            cls: lab.cls,
            tbt: after.reduce((n, t) => n + Math.max(0, t.duration - 50), 0),
            longestTask: lab.tasks.reduce((n, t) => Math.max(n, t.duration), 0),
          };
        });
        const origin = new URL(page.url()).origin;
        appendFileSync(
          OUT!,
          `${JSON.stringify({
            route: r.id,
            run,
            ...m,
            tapToPaint: tap,
            requestsBeforeContent: before.length,
            kibBeforeContent: Math.round(
              before.reduce((n, b) => n + b.bytes, 0) / 1024,
            ),
            jsKibBeforeContent: Math.round(
              before
                .filter((b) => b.type === 'script' && b.url.startsWith(origin))
                .reduce((n, b) => n + b.bytes, 0) / 1024,
            ),
            thirdPartyScripts: before
              .filter((b) => b.type === 'script' && !b.url.startsWith(origin))
              .map((b) => b.url),
          })}\n`,
        );
      });
    });
