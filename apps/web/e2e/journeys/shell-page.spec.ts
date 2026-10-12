/**
 * What a screen gets from the shell (P0-C round 2), on the shell's test page (/dev/shell, src/dev/shell): its own
 * title under a top bar that names the section, a title from data, the page kept whole when the layout changes at
 * 1024 px, focus never hidden under the sticky top bar, and nothing of it kept after signing out.
 */
import type { Page } from '@playwright/test';
import { layoutOf, navLink } from '../support/app';
import { reply } from '../support/mock';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const scroller = (page: Page) =>
  page.locator('[data-scroll-restoration-id="isi"]');
const topTitle = (page: Page) => page.locator('.g-top-title');
const crumbs = (page: Page) =>
  page.getByRole('navigation', { name: 'Jejak halaman' });
const shellMemory = (page: Page) =>
  page.evaluate(() => sessionStorage.getItem('pips:shell') ?? '');

test.describe('a screen’s own title', () => {
  test('one h1, the screen’s; the top bar still names the page, hidden from screen readers @phone-only', async ({
    page,
  }) => {
    await page.goto('/dev/shell');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Halaman uji shell');
    await expect(topTitle(page)).toHaveText('Uji shell');
    await expect(topTitle(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.g-top [data-page-title]')).toHaveCount(0);
    // Its actions sit in the top bar.
    await expect(
      page
        .locator('.g-top')
        .getByRole('button', { name: 'Bagikan halaman uji' }),
    ).toBeVisible();
  });

  test('after a navigation, focus lands on the screen’s own title', async ({
    page,
  }) => {
    await page.goto('/dev/shell');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await navLink(page, 'Layanan').click();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/shell$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman uji shell' }),
    ).toBeFocused();
  });

  test('on a slow device too, Back moves focus to the screen’s own title', async ({
    page,
  }) => {
    // Regression: under load the router's onRendered event sometimes reported no path change on Back, so focus
    // stayed on the link clicked before (seen in the full suite; 1 in 9 runs at 20× CPU slowdown before the fix).
    await page.goto('/dev/shell');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await navLink(page, 'Layanan').click();
    await expect(page).toHaveURL(/\/layanan$/);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await page.goBack();
    await expect(page).toHaveURL(/\/dev\/shell$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman uji shell' }),
    ).toBeFocused();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  });

  test('a title from data names the page in the top bar, the breadcrumbs and the document title', async ({
    page,
  }, testInfo) => {
    await page.goto('/dev/shell?judul=Judul dari data');
    await expect(page).toHaveTitle('Judul dari data · PIPS!');
    if (layoutOf(testInfo) === 'desktop')
      await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText(
        'Judul dari data',
      );
    else await expect(topTitle(page)).toHaveText('Judul dari data');
  });

  test('a split page has no breadcrumbs on desktop (the post beside the feed) @desktop-only', async ({
    page,
    api,
  }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.goto('/pengumuman/p1');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page).toHaveTitle('Pengumuman · PIPS!');
    await expect(crumbs(page)).toHaveCount(0);
  });
});

test('crossing 1024 px keeps the page: what you typed, where you were, the same page', async ({
  page,
}) => {
  // Review M2: the page was rebuilt when a tablet rotated or a window was resized across 1024 px.
  const start = page.viewportSize()!;
  const other =
    start.width >= 1024
      ? { width: 834, height: 1112 }
      : { width: 1194, height: 834 };
  await page.goto('/dev/shell');
  const note = page.getByRole('textbox', { name: 'Catatan uji' });
  await note.fill('Tulisan yang belum disimpan');
  await scroller(page).evaluate((el) => el.scrollTo({ top: 700 }));
  const anchor = page.getByRole('button', {
    name: 'Tombol uji 12',
    exact: true,
  });
  await anchor.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    (window as unknown as { pageEl: Element | null }).pageEl =
      document.querySelector('.g-page');
  });
  for (const size of [other, start]) {
    await page.setViewportSize(size);
    await expect(
      page.locator(size.width >= 1024 ? '.g-side' : '.g-tabbar'),
    ).toBeVisible();
    expect(
      await page.evaluate(() => {
        const kept = (window as unknown as { pageEl: Element | null }).pageEl;
        return (
          !!kept?.isConnected && kept === document.querySelector('.g-page')
        );
      }),
      `the same page element at ${size.width} px`,
    ).toBe(true);
    await expect(note).toHaveValue('Tulisan yang belum disimpan');
    expect(await scroller(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(
      0,
    );
    await expect(anchor).toBeInViewport();
  }
});

test('focus never hides under the sticky top bar (WCAG 2.4.11) @phone-only', async ({
  page,
}) => {
  await page.goto('/dev/shell');
  const above = page.getByRole('button', {
    name: 'Tombol uji 10',
    exact: true,
  });
  const below = page.getByRole('button', {
    name: 'Tombol uji 11',
    exact: true,
  });
  await expect(above).toBeVisible();
  // Scroll until "Tombol uji 10" sits right under the bar, then Shift+Tab back to it from the next one.
  await page.evaluate(() => {
    const bar = document.querySelector('.g-top')!.getBoundingClientRect();
    const el = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'Tombol uji 10',
    )!;
    const sc = document.querySelector('[data-scroll-restoration-id="isi"]')!;
    sc.scrollTop += el.getBoundingClientRect().top - (bar.top + 4);
  });
  await below.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(above).toBeFocused();
  const bar = (await page.locator('.g-top').boundingBox())!;
  const box = (await above.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height - 0.5);
});

test.describe('signing out', () => {
  test('forgets the titles screens gave and the pages behind back', async ({
    page,
    api,
    db,
  }) => {
    // Review M5: a Curhat room's or a form's title stayed in the tab for whoever signed in next.
    api.on('POST /api/logout', () => {
      db.signedIn = false;
      return {};
    });
    await page.goto('/dev/shell?judul=Ruang rahasia');
    await expect(page).toHaveTitle('Ruang rahasia · PIPS!');
    await expect.poll(() => shellMemory(page)).toContain('Ruang rahasia');
    await page.goto('/profil');
    await page
      .getByRole('button', { name: 'Log out' })
      .locator('visible=true')
      .click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect.poll(() => shellMemory(page)).not.toContain('Ruang rahasia');
    await page.waitForTimeout(500);
    expect(await shellMemory(page)).not.toContain('Ruang rahasia');
  });

  test('a 401 forgets them too', async ({ page, api }) => {
    await page.goto('/dev/shell?judul=Ruang rahasia');
    await expect.poll(() => shellMemory(page)).toContain('Ruang rahasia');
    api.on('GET /api/me', reply.status(401, { error: 'Unauthorized' }));
    await page.reload();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await page.waitForTimeout(500);
    expect(await shellMemory(page)).not.toContain('Ruang rahasia');
  });
});
