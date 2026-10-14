/**
 * F2 (brief step 6; accessibility.md A11; SPEC stories 127 and 128) on the qa-motion project, where the harness
 * leaves the app's own motion in (`motion: 'on'`: no no-motion stylesheet).
 * - Reduced motion: after first paint, a route change, and opening search, a sheet or dialog, a menu and a toast, and
 *   on Beranda's agenda strip and the Live Counting square, nothing moves for a second: no CSS animation or
 *   transition runs, and sampled frame by frame, the opened element's transform, opacity and box stay put.
 * - No preference: the shell (tab bar, rail, sidebar) never animates on first paint; overlays open in SPEC's times
 *   and close faster (or at once).
 */
import type { Locator, Page } from '@playwright/test';
import { greeting, isPhone } from '../support/app';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';
import { moved, type MotionSample } from './lib';

test.use({ motion: 'on' });

/** Animations and transitions running now with a duration, by what they animate. */
const running = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => {
        const d = Number(a.effect?.getComputedTiming().duration ?? 0);
        return a.playState === 'running' && d > 1;
      })
      .map((a) => {
        const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const name =
          (a as CSSAnimation).animationName ??
          (a as CSSTransition).transitionProperty ??
          'animation';
        return `${name} on ${t?.tagName.toLowerCase()}.${String(t?.className ?? '').split(' ')[0]}`;
      }),
  );

/** Samples an element every frame for a second (the motion sampler) and says how it moved, if it did. */
async function sample(el: Locator, ms = 1000): Promise<string | null> {
  const samples = await el.evaluate(
    (node, ms) =>
      new Promise<MotionSample[]>((resolve) => {
        const out: MotionSample[] = [];
        const start = performance.now();
        const tick = () => {
          const s = getComputedStyle(node);
          const r = node.getBoundingClientRect();
          out.push({
            transform: `${s.transform} ${s.translate} ${s.scale}`,
            opacity: Number(s.opacity),
            x: r.x,
            y: r.y,
            w: r.width,
            h: r.height,
          });
          if (performance.now() - start < ms) requestAnimationFrame(tick);
          else resolve(out);
        };
        tick();
      }),
    ms,
  );
  return moved(samples);
}

/** Nothing animates and the element stays put, sampled from now for a second. */
async function still(page: Page, el: Locator, what: string) {
  const [motion, animations] = await Promise.all([sample(el), running(page)]);
  expect(animations, `${what}: animations running`).toEqual([]);
  expect(motion, `${what}: moved`).toBeNull();
}

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('first paint, a route change, search and the agenda strip stay still', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await still(page, greeting(page), 'Beranda after first paint');
    const strip = page.locator('.g-ag-day').first();
    if (await strip.count()) await still(page, strip, 'the agenda strip');
    await page
      .getByRole('navigation', { name: 'Navigasi utama' })
      .getByRole('link', { name: /^Pengumuman/ })
      .click();
    await still(page, page.locator('h1:visible'), 'after a route change');
    if (isPhone(testInfo)) {
      await page.goto('/');
      await page
        .getByRole('button', { name: /Cari di PIPS!/ })
        .first()
        .click();
    } else await page.keyboard.press('Control+k');
    await still(page, page.locator('.g-palette'), 'search');
  });

  test('a sheet or dialog, a menu and a toast stay still', async ({
    page,
    api,
  }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.goto('/profil');
    await page.getByRole('button', { name: 'Keluar' }).click();
    await still(
      page,
      page.getByRole('alertdialog').or(page.getByRole('dialog')).first(),
      'Keluar’s confirmation',
    );
    await page.keyboard.press('Escape');
    await page.goto('/pengumuman/p1');
    await expect(page.locator('h1:visible')).toHaveCount(1);
    const menu = page
      .getByRole('button', { name: /^(Opsi|Lainnya|Menu)/ })
      .locator('visible=true')
      .first();
    if (await menu.count()) {
      await menu.click();
      await still(page, page.getByRole('menu'), 'a menu');
      await page.keyboard.press('Escape');
    }
    const share = page
      .getByRole('button', { name: /Salin tautan|Bagikan/ })
      .locator('visible=true')
      .first();
    if (await share.count()) {
      await share.click();
      const toast = page.locator('.g-toast').first();
      if (await toast.count()) await still(page, toast, 'a toast');
    }
  });

  test.describe('Raka', () => {
    test.use({ persona: 'pengurus' });
    test('the Live Counting square doesn’t blink', async ({ page }) => {
      await page.goto('/kelola/live/pixel');
      const square = page
        .locator('[class*="live"] [class*="sq"], .g-live-sq, .g-live-dot')
        .first();
      await expect(page.locator('h1:visible')).toHaveCount(1);
      if (await square.count()) await still(page, square, 'the live square');
      expect(await running(page)).toEqual([]);
    });
  });
});

test.describe('no preference', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the shell never animates on first paint', async ({ page }) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    const shell = await page.evaluate(() =>
      document
        .getAnimations()
        .map(
          (a) => (a.effect as KeyframeEffect | null)?.target as Element | null,
        )
        .filter((t) => !!t?.closest('.g-tabbar, .g-rail, .g-side, .g-top'))
        .map(
          (t) =>
            `${t!.tagName.toLowerCase()}.${String(t!.className).split(' ')[0]}`,
        ),
    );
    expect(shell).toEqual([]);
  });

  test('overlays open in SPEC’s times and close faster', async ({ page }) => {
    await page.goto('/profil');
    await page.getByRole('button', { name: 'Keluar' }).click();
    const openMs = await page.evaluate(() =>
      Math.max(
        0,
        ...document
          .getAnimations()
          .map((a) => Number(a.effect?.getComputedTiming().duration ?? 0)),
      ),
    );
    expect(openMs, 'open: at most the sheet’s 220 ms').toBeLessThanOrEqual(220);
    await page.keyboard.press('Escape');
    const closeMs = await page.evaluate(() =>
      Math.max(
        0,
        ...document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .map((a) => Number(a.effect?.getComputedTiming().duration ?? 0)),
      ),
    );
    expect(closeMs).toBeLessThan(Math.max(openMs, 1));
  });
});
