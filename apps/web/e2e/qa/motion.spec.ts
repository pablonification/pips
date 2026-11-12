/**
 * Motion, on the qa-motion project, where the harness
 * leaves the app's own motion in (`motion: 'on'`: no no-motion stylesheet).
 * - Reduced motion: after first paint, a route change, and opening search, a sheet or dialog, a menu and a toast, and
 *   on Beranda's agenda strip and the Live Counting square, nothing moves for a second: no CSS animation or
 *   transition runs, and sampled frame by frame, the opened element's transform, opacity and box stay put.
 * - No preference: the shell (tab bar, rail, sidebar) never animates on first paint; overlays open in their set times
 *   and close faster (or at once).
 */
import type { Locator, Page } from '@playwright/test';
import { greeting, isPhone } from '../support/app';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';
import { fakeGoogle, googleRequests } from '../support/google';
import { reply } from '../support/mock';
import { moved, type MotionSample } from './lib';

test.use({ motion: 'on' });

/** Presses a header key and reads, on the next frame, whether it shows pressed (for 160 ms only). */
const pressKey = (key: Locator) =>
  key.evaluate(async (k) => {
    k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    return k.classList.contains('down');
  });

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
    // Beranda stays on screen while Pengumuman's code loads: sample Pengumuman's own title once it is there.
    const title = page.getByRole('heading', {
      level: 1,
      name: 'Pengumuman',
      exact: true,
    });
    await expect(title).toBeVisible();
    await still(page, title, 'after a route change');
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

  // V5 Masuk: garis-check.mjs's reduced-motion check, in the app.
  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('Masuk: no entrance, no rising reaction, no typing keys or blinking loader; slides change at once', async ({
      page,
      api,
    }) => {
      await fakeGoogle(page.context());
      api.on('POST /api/auth/login/accesstoken', reply.hang());
      await page.goto('/login');
      const rows = page.locator('.g-mk-rows');
      await still(page, rows, 'Masuk after first paint');
      // The first slide's key is lit at once, with no wait for an entrance.
      await expect(page.locator('.g-mk-key.on')).toHaveAttribute(
        'data-key',
        'pengumuman',
      );
      await page
        .locator('.g-mk-key[data-key="nim"]')
        .dispatchEvent('pointerdown');
      await expect(page.locator('.g-mk-float')).toHaveCount(0);
      await page
        .getByRole('region', { name: 'Kenalan dengan PIPS!' })
        .getByRole('button', { name: 'Kalender', exact: true })
        .click();
      expect(
        await page
          .locator('.g-mk-track')
          .evaluate((t) => Math.abs(t.scrollLeft - t.clientWidth) < 2),
        'the slide changed at once',
      ).toBe(true);
      await expect
        .poll(async () => (await googleRequests(page)).clients.length)
        .toBe(1);
      await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
      await expect(page.getByRole('main')).toHaveClass(/\bbusy\b/);
      await still(page, rows, 'the keys while signing in');
      await still(page, page.locator('.g-mk-load'), 'the loader');
      expect(await page.locator('.g-mk-float').count()).toBe(0);
    });
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

  // V5 Masuk: an entrance of about a second, a reaction for the first slide and for a tapped key, the keys typing
  // while signing in; nothing loops for more than a few seconds except that wave.
  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('Masuk: the entrance plays once, reactions rise, then everything is still', async ({
      page,
      api,
    }) => {
      await fakeGoogle(page.context());
      api.on('POST /api/auth/login/accesstoken', reply.hang());
      // Every animation that starts, recorded from the first paint on.
      await page.addInitScript(() => {
        const w = window as unknown as { __mkStarted: string[] };
        w.__mkStarted = [];
        document.addEventListener('animationstart', (e) =>
          w.__mkStarted.push(e.animationName),
        );
      });
      await page.goto('/login');
      await expect(page.locator('.g-mk-key.on')).toHaveCount(1);
      const names = await page.evaluate(
        () => (window as unknown as { __mkStarted: string[] }).__mkStarted,
      );
      for (const n of ['g-mk-drop', 'g-mk-pop', 'g-mk-up', 'g-mk-slide-l'])
        expect(names, `the entrance's ${n}`).toContain(n);
      // After the entrance the first slide's key lights and a reaction rises from it, then fades away.
      await expect(page.locator('.g-mk-key.on')).toHaveAttribute(
        'data-key',
        'pengumuman',
      );
      await expect(page.locator('.g-mk-float')).toHaveCount(1);
      await expect(page.locator('.g-mk-float')).toHaveCount(0);
      // A tapped key presses down and sends one up.
      const nim = page.locator('.g-mk-key[data-key="nim"]');
      expect(await pressKey(nim), 'the key pressed down').toBe(true);
      await expect(page.locator('.g-mk-float')).toHaveCount(1);
      // Then nothing moves: the last pixel reaction's bob ends 6.6 s after first paint.
      await page.waitForTimeout(6000);
      await expect.poll(() => running(page), { timeout: 5000 }).toEqual([]);
      // Signing in: the keys type in a wave and the loader blinks while it waits.
      await expect
        .poll(async () => (await googleRequests(page)).clients.length)
        .toBe(1);
      await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
      await expect
        .poll(async () => (await running(page)).join())
        .toMatch(/g-mk-type.*g-mk-blink|g-mk-blink.*g-mk-type/);
    });
  });

  test('overlays open in their set times and close faster', async ({ page }) => {
    await page.goto('/profil');
    // The member card sweeps its sheen once on arrival (1.1 s); let it end, so only the overlay is timed.
    await page.waitForFunction(
      () =>
        !!document.querySelector('.g-m-sheen') &&
        !document
          .getAnimations()
          .some((a) => (a as CSSAnimation).animationName === 'g-m-sweep'),
    );
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
