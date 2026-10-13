/**
 * C1: SPEC's budgets and checks that hold for the whole app once today's screens are gone ("Performance
 * architecture and budgets", C1 brief "Tests"):
 * - no third-party script on any signed-in route; Google's sign-in script only on /login;
 * - Beranda's first load at phone size: ≤ 450 KiB in total, same-origin images in the first view ≤ 150 KiB, the
 *   largest ≤ 60 KiB (the harness's own /__e2e__/ images don't count);
 * - each destination's main view: hidden DOM ≤ 10 % of the elements, layout shift (CLS) ≤ 0.05;
 * - every route in P0-B's URL table fits at 320, 390, 768, 1024 and 1440 px and at 200 % zoom: no sideways
 *   overflow, no control cut off, no text under 12 px, and no serious or critical axe finding at phone and desktop
 *   width.
 */
import type { Page, Request, TestInfo } from '@playwright/test';
import { runAxe, measure } from '../support/audit';
import { greeting, layoutOf } from '../support/app';
import type { PersonaKey } from '../fixtures/api';
import type { ApiMock } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const KIB = 1024;

interface Route {
  path: string;
  persona?: PersonaKey;
  roles?: string[];
}

/** P0-B's URL table, one URL per route (Kelola as Raka; the inbox with Welfare's role). */
const ROUTES: Route[] = [
  { path: '/' },
  { path: '/pengumuman' },
  { path: '/pengumuman/p1' },
  { path: '/pengumuman/tulis', persona: 'pengurus' },
  { path: '/kalender' },
  { path: '/layanan' },
  { path: '/layanan/dingdong' },
  { path: '/layanan/testi' },
  { path: '/layanan/testi/teknik-informatika' },
  { path: '/layanan/testi/teknik-informatika/3' },
  { path: '/layanan/testi/teknik-informatika/3/course-IF2110' },
  { path: '/layanan/nim' },
  { path: '/layanan/lomba' },
  { path: '/layanan/curhat' },
  { path: '/layanan/curhat/r1' },
  { path: '/layanan/form' },
  { path: '/layanan/form/pixel' },
  { path: '/layanan/sparta' },
  { path: '/profil' },
  { path: '/profil/matkul' },
  { path: '/profil/matkul/tambah' },
  { path: '/profil/notifikasi' },
  { path: '/profil/kredit' },
  { path: '/mulai' },
  { path: '/kelola', persona: 'pengurus' },
  { path: '/kelola/live', persona: 'pengurus' },
  { path: '/kelola/live/pixel', persona: 'pengurus' },
  { path: '/kelola/live/pixel/rekap', persona: 'pengurus' },
  { path: '/kelola/sparta', persona: 'pengurus' },
  { path: '/kelola/sparta/sub-13525071', persona: 'pengurus' },
  { path: '/kelola/curhat', persona: 'pengurus', roles: ['curhatadmin'] },
  { path: '/kelola/curhat/r1', persona: 'pengurus', roles: ['curhatadmin'] },
];

/** The writes opening a page makes by itself: a post and a Curhat room are marked read. */
function allowReads(api: ApiMock) {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
}

/**
 * The page has loaded its data: the main element is there (a desktop dialog, such as the composer, hides it from
 * the accessibility tree, so not by role) and no loading placeholder or status is left.
 */
async function settled(page: Page) {
  await expect(page.locator('main')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelectorAll(
              '.g-skel, .g-skel-bar, .g-skel-block, [role="status"][aria-label^="Memuat"]',
            ).length,
        ),
      { message: 'loading placeholders left', timeout: 15_000 },
    )
    .toBe(0);
  await page.evaluate(
    () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const sameOrigin = (page: Page, url: string) =>
  new URL(url).origin === new URL(page.url()).origin;

for (const route of ROUTES) {
  test.describe(`${route.path}`, () => {
    test.use({
      persona: route.persona ?? 'anggota',
      roles: route.roles ?? null,
    });

    test(`${route.path}: no third-party script`, async ({ page, api }) => {
      allowReads(api);
      const scripts: string[] = [];
      page.on('request', (r) => {
        if (r.resourceType() === 'script' && !sameOrigin(page, r.url()))
          scripts.push(r.url());
      });
      await page.goto(route.path);
      await settled(page);
      expect(scripts).toEqual([]);
    });

    test(`${route.path} fits at every width and at 200 % zoom, with no small text or serious axe finding`, async ({
      page,
      api,
    }, testInfo) => {
      // The check sets its own window sizes, so one layout's run covers them all.
      test.skip(layoutOf(testInfo) !== 'desktop', 'one run covers every width');
      allowReads(api);
      await page.goto(route.path);
      await settled(page);
      const original = page.viewportSize()!;
      const problems: string[] = [];
      const sizes: [string, number, number][] = [
        ...[320, 390, 768, 1024, 1440].map(
          (w) => [`${w}px`, w, original.height] as [string, number, number],
        ),
        // 200 % zoom on a 1440 px window is a 720 px CSS viewport.
        ['200% zoom', 720, Math.round(original.height / 2)],
      ];
      for (const [label, width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await page.waitForFunction((w) => window.innerWidth === w, width);
        await settled(page);
        const found = await fitProblems(page);
        const m = await measure(page);
        if (m.smallText.count)
          found.push(`text under 12px: ${m.smallText.samples.join('; ')}`);
        if (width === 390 || width === 1440) {
          const axe = await runAxe(page);
          for (const v of axe.violations)
            if (v.impact === 'serious' || v.impact === 'critical')
              found.push(`axe ${v.id} (${v.impact}): ${v.targets.join(', ')}`);
        }
        problems.push(...found.map((f) => `${label}: ${f}`));
      }
      await page.setViewportSize(original);
      expect(problems).toEqual([]);
    });
  });
}

/** Sideways overflow, and controls in the page cut off by the window's edges. */
function fitProblems(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const out: string[] = [];
    if (doc.scrollWidth > doc.clientWidth)
      out.push(`overflow ${doc.scrollWidth - doc.clientWidth}px`);
    for (const el of document.querySelectorAll<HTMLElement>(
      'main button, main a, main input, main textarea, main select, main [role="switch"], main [role="radio"]',
    )) {
      if (!el.checkVisibility()) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.left < -1 || r.right > doc.clientWidth + 1)
        out.push(
          `clipped: ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}`,
        );
    }
    return out;
  });
}

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('Google’s sign-in script loads on /login, and it is the only third-party script', async ({
    page,
  }) => {
    const scripts: string[] = [];
    page.on('request', (r) => {
      if (r.resourceType() === 'script' && !sameOrigin(page, r.url()))
        scripts.push(new URL(r.url()).origin + new URL(r.url()).pathname);
    });
    await page.goto('/login');
    await expect(
      page.getByRole('button', { name: 'Masuk dengan Google' }),
    ).toBeVisible();
    await expect
      .poll(() => scripts)
      .toEqual(['https://accounts.google.com/gsi/client']);
  });
});

/** Every response's size until `done`, the harness's own images left out. */
async function weigh(page: Page, done: () => Promise<void>) {
  const requests: Request[] = [];
  page.on('requestfinished', (r) => {
    if (!new URL(r.url()).pathname.startsWith('/__e2e__/')) requests.push(r);
  });
  await done();
  return Promise.all(
    requests.map(async (r) => {
      const s = await r.sizes();
      return {
        url: r.url(),
        type: r.resourceType(),
        bytes: s.responseBodySize + s.responseHeadersSize,
      };
    }),
  );
}

test('Beranda’s first load at phone size: ≤ 450 KiB in all, first-view images ≤ 150 KiB, the largest ≤ 60 KiB', async ({
  page,
}, testInfo: TestInfo) => {
  test.skip(layoutOf(testInfo) !== 'phone', 'SPEC’s budget is for the phone');
  const loaded = await weigh(page, async () => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await settled(page);
    await page.waitForLoadState('load');
  });
  const total = loaded.reduce((s, r) => s + r.bytes, 0);
  const images = loaded.filter(
    (r) => r.type === 'image' && sameOrigin(page, r.url),
  );
  await testInfo.attach('beranda-first-load.json', {
    body: JSON.stringify({ total, requests: loaded }, null, 1),
    contentType: 'application/json',
  });
  expect(total, `${(total / KIB).toFixed(1)} KiB`).toBeLessThanOrEqual(
    450 * KIB,
  );
  expect(images.reduce((s, r) => s + r.bytes, 0)).toBeLessThanOrEqual(
    150 * KIB,
  );
  for (const i of images) expect(i.bytes, i.url).toBeLessThanOrEqual(60 * KIB);
});

/** The share of elements in `body` that aren't rendered (scripts, styles and templates left out). */
const hiddenShare = (page: Page) =>
  page.evaluate(() => {
    const all = [...document.body.querySelectorAll('*')].filter(
      (el) => !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(el.tagName),
    );
    const hidden = all.filter((el) => !el.checkVisibility());
    return { all: all.length, hidden: hidden.length };
  });

const DESTINATIONS: Route[] = [
  { path: '/' },
  { path: '/pengumuman' },
  { path: '/kalender' },
  { path: '/layanan' },
  { path: '/profil' },
  { path: '/kelola', persona: 'pengurus' },
];

for (const d of DESTINATIONS) {
  test.describe(`main view ${d.path}`, () => {
    test.use({ persona: d.persona ?? 'anggota' });

    test(`${d.path}: hidden DOM ≤ 10 % and layout shift ≤ 0.05`, async ({
      page,
    }, testInfo) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(d.path);
      await settled(page);
      // Late shifts (an image, a font) land within a moment of the content.
      await page.waitForTimeout(500);
      const { all, hidden } = await hiddenShare(page);
      const cls = await page.evaluate(
        () => (window as unknown as { __cls: number }).__cls,
      );
      await testInfo.attach('hidden-dom-and-cls.json', {
        body: JSON.stringify({ all, hidden, share: hidden / all, cls }),
        contentType: 'application/json',
      });
      expect(hidden / all, `${hidden} of ${all} hidden`).toBeLessThanOrEqual(
        0.1,
      );
      expect(cls).toBeLessThanOrEqual(0.05);
    });
  });
}
