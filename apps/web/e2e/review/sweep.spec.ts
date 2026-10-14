/**
 * The sweep (F1 brief, step 8): every page in routes.ts, as each person it differs for, on the review-sweep-* projects
 * (320, 390, 768, 1024 and 1440 px, and 200 % zoom on a 1440 × 900 window; light and dark). On each:
 * - the strict audit: axe with no serious or critical violation, no document overflow, text ≥ 12 px, inputs ≥ 16 px
 *   on touch, `lang="id"` (support/strict.ts);
 * - no control clipped by the window;
 * - 44 px touch targets on touch layouts, measured as shell.spec.ts does (a control's absolutely placed ::before
 *   counts), the agenda strip's days excepted as SPEC allows;
 * - the title "{Halaman} · PIPS!", one `main` and one `h1`;
 * - the logo audit of garis-check.mjs section 2d: every visible /logo/hmif.png loaded, unstretched, unfiltered,
 *   uncovered, unclipped and at least 40 px wide.
 * C1 leaves its own route sweep in the journeys (P0-B's URL table); this one adds /mulai, Rekap Form and the
 * Welfare inbox, both personas, the touch targets, the titles and the logo.
 */
import type { Page } from '@playwright/test';
import { strictAudit } from '../support/strict';
import * as writes from '../support/writes';
import { expect, test } from '../support/test';
import { ROUTES } from './routes';

const TOUCH = /^review-sweep-(320|390|768)-/;

async function clipped(page: Page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      'a, button, input, select, textarea, [role="switch"], [role="radio"]',
    )) {
      if (!el.checkVisibility()) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < -1 || r.right > w + 1)
        out.push(
          el.getAttribute('aria-label') ??
            el.textContent?.trim().slice(0, 30) ??
            el.tagName,
        );
    }
    return out;
  });
}

/**
 * Each control's hit area: its box, grown by an absolutely placed ::before or ::after (shell.spec.ts counts ::before;
 * Pengumuman's cards stretch their title link's ::after over the whole card). The skip link, shown only on focus, and
 * the agenda strip's days (SPEC allows them smaller) are left out.
 */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const px = (v: string) => (v === 'auto' ? null : parseFloat(v));
    const out: { name: string; w: number; h: number }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(
      'a, button, [role="switch"], [role="radio"], input[type="checkbox"]',
    )) {
      if (!el.checkVisibility() || el.matches('.g-ag-day, [href="#isi"]'))
        continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let w = r.width;
      let h = r.height;
      for (const pseudo of ['::before', '::after']) {
        const st = getComputedStyle(el, pseudo);
        if (st.content === 'none' || st.position !== 'absolute') continue;
        const cb = (
          getComputedStyle(el).position !== 'static'
            ? el
            : (el.offsetParent as HTMLElement | null)
        )?.getBoundingClientRect();
        if (!cb) continue;
        const [t, rt, b, l] = [
          px(st.top),
          px(st.right),
          px(st.bottom),
          px(st.left),
        ];
        const pw =
          l !== null && rt !== null
            ? cb.width - l - rt
            : parseFloat(st.width) || 0;
        const ph =
          t !== null && b !== null
            ? cb.height - t - b
            : parseFloat(st.height) || 0;
        // As support/p1a.ts hitSizes reads it too: a pseudo-element pulled out by negative offsets on each side.
        const grownW = r.width - 2 * Math.min(0, l ?? 0);
        const grownH = r.height - 2 * Math.min(0, t ?? 0);
        w = Math.max(w, pw, grownW);
        h = Math.max(h, ph, grownH);
      }
      if (Math.round(w) < 44 || Math.round(h) < 44)
        out.push({
          name: (el.getAttribute('aria-label') ?? el.textContent ?? '')
            .trim()
            .slice(0, 60),
          w: Math.round(w),
          h: Math.round(h),
        });
    }
    return out;
  });
}

/** garis-check.mjs 2d: every visible copy of the official logo. */
async function logoProblems(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
      if (
        !new URL(img.src, location.href).pathname.endsWith('/logo/hmif.png') ||
        !img.checkVisibility()
      )
        continue;
      const r = img.getBoundingClientRect();
      const s = getComputedStyle(img);
      if (!img.complete || img.naturalWidth === 0) out.push('not loaded');
      const ratio = r.width / r.height;
      const natural = img.naturalWidth / img.naturalHeight;
      if (
        img.naturalWidth &&
        Math.abs(ratio / natural - 1) > 0.02 &&
        s.objectFit !== 'contain'
      )
        out.push(`stretched ${ratio.toFixed(2)} vs ${natural.toFixed(2)}`);
      if (
        s.filter !== 'none' ||
        s.mixBlendMode !== 'normal' ||
        parseFloat(s.opacity) < 1
      )
        out.push('filtered');
      if (r.width < 40) out.push(`${Math.round(r.width)} px wide`);
      if (
        r.left < 0 ||
        r.top < 0 ||
        r.right > innerWidth ||
        r.bottom > innerHeight
      ) {
        // Below the fold is fine; cut by the window's sides is not.
        if (r.left < 0 || r.right > innerWidth) out.push('clipped');
      } else if (
        ![
          ...document.querySelectorAll<HTMLElement>(
            '[role="dialog"], [role="alertdialog"]',
          ),
        ].some((d) => d.checkVisibility())
      ) {
        // An open dialog's backdrop dims everything behind it, the logo too: that isn't covering it.
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        if (hit && hit !== img && !img.contains(hit)) out.push('covered');
      }
    }
    return out;
  });
}

for (const [path, route] of Object.entries(ROUTES))
  for (const who of route.as)
    test.describe(`${path} as ${who.key}`, () => {
      test.use(who.use);
      test(`${route.url} as ${who.key}`, async ({ page, api }, testInfo) => {
        test.skip(
          !/^review-sweep-/.test(testInfo.project.name),
          'a review-sweep project only',
        );
        // Opening a post or a room marks it read.
        api.on('POST /api/info/:infoId/read', writes.markRead);
        api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
        await page.goto(route.url);
        // On desktop the composer is a dialog over Pengumuman, which leaves the page inert behind it.
        await expect(
          page.locator('main, [role="dialog"]').first(),
        ).toBeVisible();
        // Not "networkidle": Curhat and Live Counting keep a socket.io long poll open.
        await page.waitForLoadState('load');
        await expect(page.getByRole('status', { name: /^Memuat/ })).toHaveCount(
          0,
          { timeout: 15_000 },
        );
        await strictAudit(page, testInfo, `sweep-${who.key}-${path}`);
        expect(await clipped(page), 'controls clipped by the window').toEqual(
          [],
        );
        await expect(page).toHaveTitle(/^.+ · PIPS!$/);
        await expect(page.locator('main, [role="main"]')).toHaveCount(1);
        await expect(page.locator('h1:visible')).toHaveCount(1);
        expect(await logoProblems(page), 'the official logo').toEqual([]);
        if (TOUCH.test(testInfo.project.name))
          expect(await smallTargets(page), '44 px touch targets').toEqual([]);
      });
    });
