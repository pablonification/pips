/**
 * The Garis gallery (/dev/garis): the design system's components in the browser, at phone and desktop sizes in
 * light and dark. Behaviour (keyboard, focus trap and return, roles and names, Seg and Switch state, toast timing,
 * touch hit areas), the theme switch, the logo rule, and SPEC's quality gates in strict mode (no serious or critical
 * axe violation, no overflow, no text under 12 px, lang="id").
 */
import type { Page, TestInfo } from '@playwright/test';
import { audit, gateFailures } from '../support/audit';
import { expect, test } from '../support/test';

test.use({ persona: null });

const isPhone = (t: TestInfo) => t.project.name.startsWith('phone');
const isDark = (t: TestInfo) => t.project.name.endsWith('dark');

async function open(page: Page) {
  await page.goto('/dev/garis');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sistem desain Garis' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function strictGates(page: Page, testInfo: TestInfo, name: string) {
  const a = await audit(page);
  await testInfo.attach(`gates-${name}.json`, {
    body: JSON.stringify(a, null, 2),
    contentType: 'application/json',
  });
  expect(gateFailures(a), name).toEqual([]);
}

test('the gallery follows the system theme before first paint, with the theme colour and self-hosted fonts', async ({
  page,
}, testInfo) => {
  await open(page);
  const state = await page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    scheme: document.documentElement.style.colorScheme,
    themeColor: document
      .querySelector('meta[name="theme-color"]')
      ?.getAttribute('content'),
    lang: document.documentElement.lang,
    fonts: [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family),
    body: getComputedStyle(document.body).fontFamily,
  }));
  expect(state.dark).toBe(isDark(testInfo));
  expect(state.scheme).toBe(isDark(testInfo) ? 'dark' : 'light');
  expect(state.themeColor).toBe(isDark(testInfo) ? '#0A0907' : '#FCFBF8');
  expect(state.lang).toBe('id');
  expect(state.fonts).toEqual(
    expect.arrayContaining(['Geist', 'Archivo Expanded']),
  );
  expect(state.body).toMatch(/^Geist/);
});

test('the gallery passes the quality gates, also with a sheet or dialog open', async ({
  page,
}, testInfo) => {
  await open(page);
  await strictGates(page, testInfo, 'gallery');
  await page.getByRole('button', { name: 'Buka sesuai layar' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Nyalakan notifikasi?' }),
  ).toBeVisible();
  await strictGates(page, testInfo, 'gallery-modal');
});

test('the theme switch stores the choice, applies it at once and before the next paint', async ({
  page,
}) => {
  await open(page);
  const seg = page.getByRole('group', { name: 'Tampilan halaman' });
  await seg.getByRole('radio', { name: 'Gelap' }).check();
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem('pips:theme'))).toBe(
    'dark',
  );
  expect(
    await page.locator('meta[name="theme-color"]').getAttribute('content'),
  ).toBe('#0A0907');
  // On reload the pre-paint script has applied it before the app's code runs.
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.readyState !== 'loading');
  expect(
    await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    ),
  ).toBe(true);
  await open(page);
  await seg.getByRole('radio', { name: 'Terang' }).check();
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  await seg.getByRole('radio', { name: 'Sistem' }).check();
  expect(
    await page.evaluate(() => localStorage.getItem('pips:theme')),
  ).toBeNull();
});

test('Seg is a radio group the arrow keys move; Switch and Chip report their state', async ({
  page,
}) => {
  await open(page);
  const seg = page.getByRole('group', { name: 'Tema contoh' });
  await seg.getByRole('radio', { name: 'Semua' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(seg.getByRole('radio', { name: 'Akademik' })).toBeChecked();
  await expect(seg.getByRole('radio', { name: 'Akademik' })).toBeFocused();

  const kit = page.getByTestId('garis-kit-light');
  const sw = kit.getByRole('switch', { name: 'Contoh switch mati' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toHaveAttribute('aria-checked', 'false');

  const chip = kit.getByRole('button', { name: 'Terbaru' });
  await expect(chip).toHaveAttribute('aria-pressed', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
});

test('fields name their hint or error, and mark the error invalid', async ({
  page,
}) => {
  await open(page);
  const kit = page.getByTestId('garis-kit-light');
  const nim = kit.getByLabel('NIM');
  await expect(nim).toHaveAccessibleDescription('8 angka, misalnya 13525045');
  const body = kit.getByLabel('Isi pengumuman');
  await expect(body).toHaveAttribute('aria-invalid', 'true');
  await expect(body).toHaveAccessibleDescription(
    'Isi pengumuman belum ditulis.',
  );
  await expect(kit.getByRole('checkbox', { name: 'Main game' })).toBeChecked();
});

test('a dialog traps focus, closes on Escape and returns focus to its button', async ({
  page,
}) => {
  await open(page);
  const opener = page.getByRole('button', { name: 'Buka dialog' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Detail acara' });
  await expect(dialog).toBeVisible();
  // Tab past the last control comes back inside.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(
      await dialog.evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
  }
  await expect(dialog.getByRole('button', { name: 'Tutup' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('a sheet rises from the bottom on phones and closes with Tutup; on desktop the same overlay is a dialog', async ({
  page,
}, testInfo) => {
  await open(page);
  const opener = page.getByRole('button', { name: 'Buka lembar' });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Filter' });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  const vp = page.viewportSize()!;
  if (isPhone(testInfo)) {
    expect(Math.round(box.y + box.height)).toBe(vp.height);
    expect(Math.round(box.width)).toBe(vp.width);
  } else {
    // From 640 px a sheet is a centred panel.
    expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(2);
    expect(box.width).toBeLessThanOrEqual(560);
  }
  // Reduced motion: no animation runs.
  expect(await sheet.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    'none',
  );
  await sheet.getByRole('button', { name: 'Tutup' }).click();
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();

  await page.getByRole('button', { name: 'Buka sesuai layar' }).click();
  const modal = page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
  await expect(modal).toHaveAccessibleDescription(/Pengumuman baru/);
  expect(await modal.evaluate((el) => el.className)).toContain(
    isPhone(testInfo) ? 'g-sheet' : 'g-dlg',
  );
  await page.keyboard.press('Escape');
});

test('a confirmation is an alert dialog with Batal focused, and its action runs', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Hapus ruang' }).click();
  const dlg = page.getByRole('alertdialog', { name: 'Hapus ruang ini?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Batal' })).toBeFocused();
  await dlg.getByRole('button', { name: 'Hapus ruang' }).click();
  await expect(dlg).toBeHidden();
  await expect(
    page.getByRole('status').filter({ hasText: 'Ruang dihapus.' }),
  ).toBeVisible();
});

test('a menu opens from the keyboard, arrow keys move between the items it can act on, and focus returns', async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Pilihan lain' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole('menuitem', { name: /Umumkan ulang/ }),
  ).toHaveAttribute('aria-disabled', 'true');
  await expect(
    menu.getByRole('menuitem', { name: /Umumkan ulang/ }),
  ).toContainText('Bisa lagi mulai 15.30');
  // Opened from the keyboard, focus lands on the first item it can act on: the disabled one is skipped.
  await expect(
    menu.getByRole('menuitem', { name: 'Salin tautan' }),
  ).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Hapus' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(
    menu.getByRole('menuitem', { name: 'Salin tautan' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  await expect(page.getByTestId('menu-result')).toHaveText('Tautan disalin');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('a popover closes on Escape and returns focus', async ({ page }) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Reaksi' });
  await trigger.click();
  const pop = page.getByRole('dialog', { name: 'Pilih reaksi' });
  await expect(pop).toBeVisible();
  await expect(pop.getByRole('button', { name: 'Keren' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('success toasts stay 5 s (8 s with Urungkan); error toasts stay until dismissed', async ({
  page,
}) => {
  await open(page);
  // Stop the page's clock a moment ahead (pausing at "now" would already be in the past).
  await page.clock.pauseAt(
    new Date((await page.evaluate(() => Date.now())) + 1_000),
  );
  await page.getByRole('button', { name: 'Notifikasi berhasil' }).click();
  const ok = page.getByRole('status').filter({ hasText: 'Komentar terkirim.' });
  await expect(ok).toBeVisible();
  await page.clock.runFor(4_900);
  await expect(ok).toBeVisible();
  await page.clock.runFor(200);
  await expect(ok).toBeHidden();

  await page.getByRole('button', { name: 'Dengan urungkan' }).click();
  const undo = page.getByRole('status').filter({ hasText: 'IF2110 dihapus' });
  await page.clock.runFor(7_000);
  await expect(undo).toBeVisible();
  await undo.getByRole('button', { name: 'Urungkan' }).click();
  await expect(undo).toBeHidden();
  await expect(
    page.getByRole('status').filter({ hasText: 'IF2110 dikembalikan.' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Notifikasi gagal' }).click();
  const err = page
    .getByRole('alert')
    .filter({ hasText: 'Komentar gagal terkirim' });
  await expect(err).toBeVisible();
  await page.clock.runFor(120_000);
  await expect(err).toBeVisible();
  await err.getByRole('button', { name: 'Tutup' }).click();
  await expect(err).toBeHidden();
});

test('Coba lagi retries; offline names the last update; skeletons name what is loading', async ({
  page,
}) => {
  await open(page);
  const error = page
    .getByRole('alert')
    .filter({ hasText: 'Pengumuman gagal dimuat' });
  await error.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByTestId('retry-count')).toHaveText('Dicoba lagi 1×');
  await expect(
    page.getByRole('status').filter({ hasText: 'Offline · diperbarui 07.45' }),
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Memuat kalender' }),
  ).toBeVisible();
});

test('on touch layouts every small control has a 44 px hit area, and the gold action is 48 px tall', async ({
  page,
}, testInfo) => {
  test.skip(!isPhone(testInfo), 'touch layouts only');
  await open(page);
  const kit = page.getByTestId('garis-kit-light');
  const hit = async (sel: ReturnType<Page['locator']>) =>
    sel.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const b = getComputedStyle(el, '::before');
      const px = (v: string) => (v === 'auto' ? 0 : parseFloat(v));
      return {
        w: r.width - px(b.left) - px(b.right),
        h: r.height - px(b.top) - px(b.bottom),
      };
    });
  for (const control of [
    kit.getByRole('switch', { name: 'Contoh switch mati' }),
    kit.getByRole('button', { name: 'Terbaru' }),
    page.getByRole('button', { name: 'Pilihan lain' }),
    page.getByRole('button', { name: 'Lihat semua' }).last(),
  ]) {
    const { w, h } = await hit(control);
    expect(w).toBeGreaterThanOrEqual(44);
    expect(h).toBeGreaterThanOrEqual(44);
  }
  const gold = kit.getByRole('button', { name: 'Umumkan' });
  expect((await gold.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

test('every HMIF logo is the official file, whole, unstretched and at least 40 px wide; icons are inline SVG', async ({
  page,
}) => {
  await open(page);
  const logos = await page
    .locator('img[src="/logo/hmif.png"]')
    .evaluateAll((imgs) =>
      (imgs as HTMLImageElement[]).map((i) => ({
        loaded: i.complete && i.naturalWidth === 800 && i.naturalHeight === 533,
        w: i.getBoundingClientRect().width,
        ratio:
          i.getBoundingClientRect().width / i.getBoundingClientRect().height,
        filter: getComputedStyle(i).filter,
      })),
    );
  expect(logos.length).toBeGreaterThanOrEqual(6);
  for (const l of logos) {
    expect(l.loaded).toBe(true);
    expect(l.w).toBeGreaterThanOrEqual(40);
    expect(Math.abs(l.ratio - 800 / 533)).toBeLessThan(0.02);
    expect(l.filter).toBe('none');
  }
  expect(await page.locator('#icons .icon-cell svg.g-ic').count()).toBe(54);
  expect(
    await page.locator('main img:not([src="/logo/hmif.png"])').count(),
  ).toBe(0);
});
