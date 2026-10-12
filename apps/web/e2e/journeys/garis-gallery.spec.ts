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
/** Phones and tablets (P0-C's tablet projects): below 1024 px, Modal is a sheet and controls get 44 px targets. */
const isTouch = (t: TestInfo) => /^(phone|tablet)/.test(t.project.name);
const isDark = (t: TestInfo) => t.project.name.endsWith('dark');

async function open(page: Page) {
  await page.goto('/dev/garis');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sistem desain Garis' }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** The toasts' two live regions (always in the page): successes are polite, errors assertive. */
const politeToasts = (page: Page) =>
  page.locator('.g-toasts [aria-live="polite"]');
const assertiveToasts = (page: Page) =>
  page.locator('.g-toasts [aria-live="assertive"]');

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

// Review M4: chips could only be toggle buttons; the prototype also uses them as checkboxes (the composer's categories)
// and as a radio group (the class picker).
test('chips work as toggles, as checkboxes with a check, and as a radio group with one tab stop and arrow keys', async ({
  page,
}) => {
  await open(page);
  const cats = page.getByRole('group', { name: 'Kategori' });
  const akademik = cats.getByRole('checkbox', { name: 'Akademik' });
  const lomba = cats.getByRole('checkbox', { name: 'Lomba' });
  await expect(akademik).toBeChecked();
  await expect(akademik).not.toHaveAttribute('aria-pressed');
  await expect(akademik.locator('svg')).toHaveCount(1);
  await expect(lomba).not.toBeChecked();
  await expect(lomba.locator('svg')).toHaveCount(0);
  await lomba.focus();
  await page.keyboard.press('Space');
  await expect(lomba).toBeChecked();
  await expect(akademik).toBeChecked();
  await akademik.click();
  await expect(akademik).not.toBeChecked();

  const kelas = page.getByRole('radiogroup', { name: 'Kelas IF2110' });
  const k = (n: number) => kelas.getByRole('radio', { name: `K${n}` });
  for (const n of [1, 2, 3]) await expect(k(n)).not.toBeChecked();
  // One tab stop: the first chip while none is chosen.
  await expect(kelas.locator('[tabindex="0"]')).toHaveCount(1);
  await expect(k(1)).toHaveAttribute('tabindex', '0');
  await k(1).focus();
  await page.keyboard.press('ArrowRight');
  await expect(k(2)).toBeChecked();
  await expect(k(2)).toBeFocused();
  await expect(k(2)).toHaveAttribute('tabindex', '0');
  await expect(k(1)).toHaveAttribute('tabindex', '-1');
  await page.keyboard.press('End');
  await expect(k(3)).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(k(1)).toBeChecked();
  await expect(k(1)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(k(3)).toBeChecked();
  await page.keyboard.press('Home');
  await expect(k(1)).toBeChecked();
  await expect(k(3)).not.toBeChecked();
  // Choosing the chosen class again clears it, as in the prototype.
  await k(1).click();
  for (const n of [1, 2, 3]) await expect(k(n)).not.toBeChecked();
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
    isTouch(testInfo) ? 'g-sheet' : 'g-dlg',
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
  await expect(politeToasts(page).getByText('Ruang dihapus.')).toBeVisible();
});

// Review M3: Radix skipped the disabled item, so its reason couldn't be reached by keyboard and choosing it did
// nothing. As in the prototype, it stays focusable (aria-disabled) and choosing it says why, keeping the menu open.
test('a menu opens from the keyboard, its unavailable item stays reachable and says why, and focus returns', async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Pilihan lain' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const renotify = menu.getByRole('menuitem', { name: /Umumkan ulang/ });
  await expect(renotify).toHaveAttribute('aria-disabled', 'true');
  await expect(renotify).toContainText('Bisa lagi mulai 15.30');
  await expect(renotify).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await expect(
    politeToasts(page).getByText(/Umumkan ulang bisa lagi mulai 15\.30/),
  ).toBeVisible();
  await page.keyboard.press('ArrowDown');
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

// Review m4: Radix marks the item under the pointer as highlighted, and that drew the focus ring on hover.
test('a menu item under the pointer gets the hover fill only; keyboard focus gets the ring', async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Pilihan lain' });
  await trigger.click();
  const menu = page.getByRole('menu');
  const copy = menu.getByRole('menuitem', { name: 'Salin tautan' });
  await copy.hover();
  await expect(copy).toHaveAttribute('data-highlighted', '');
  const ring = (el: Element) => {
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle, shadow: cs.boxShadow };
  };
  expect(await copy.evaluate(ring)).toEqual({
    outline: 'none',
    shadow: 'none',
  });
  await page.keyboard.press('Escape');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(copy).toBeFocused();
  expect((await copy.evaluate(ring)).outline).toBe('solid');
});

// Review M1: menus and popovers sat at z-index 30, under the scrim (40) and the panel (41) of a dialog or sheet.
test('a menu opened inside a dialog shows above it, acts, and returns focus inside the dialog', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'Buka dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Detail acara' });
  const trigger = dialog.getByRole('button', { name: 'Pilihan acara' });
  await trigger.click();
  const item = page
    .getByRole('menu')
    .getByRole('menuitem', { name: 'Salin tautan acara' });
  await expect(item).toBeVisible();
  // The item is the topmost element where it is drawn: nothing of the dialog covers it.
  expect(
    await item.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return el === top || el.contains(top);
    }),
  ).toBe(true);
  await item.click();
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('menu-result')).toHaveText(
    'Tautan acara disalin',
  );
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

// The prototype's main pattern: a post's menu, then Hapus, then the confirmation. Closing it returns focus to the
// menu's button, not to the page.
test('a confirmation opened from a menu item returns focus to the menu button when it closes', async ({
  page,
}) => {
  await open(page);
  const trigger = page.getByRole('button', { name: 'Pilihan lain' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await expect(page.getByRole('menuitem', { name: 'Hapus' })).toBeFocused();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('alertdialog', { name: 'Hapus pengumuman ini?' });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByRole('button', { name: 'Batal' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
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

// Review M2: each toast mounted together with its role, which screen readers often don't announce. The live regions
// are now always in the page, before the first toast, and stay readable while a dialog hides the rest.
test('toasts are announced from live regions that exist before the first toast, polite for successes and assertive for errors', async ({
  page,
}) => {
  await open(page);
  await expect(politeToasts(page)).toHaveCount(1);
  await expect(assertiveToasts(page)).toHaveCount(1);
  await expect(politeToasts(page)).toBeEmpty();
  await expect(assertiveToasts(page)).toBeEmpty();
  await expect(page.locator('.g-toasts [role]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Notifikasi berhasil' }).click();
  await expect(politeToasts(page)).toContainText('Komentar terkirim.');
  await expect(assertiveToasts(page)).toBeEmpty();
  await page.getByRole('button', { name: 'Notifikasi gagal' }).click();
  await expect(assertiveToasts(page)).toContainText('Komentar gagal terkirim');
  await assertiveToasts(page).getByRole('button', { name: 'Tutup' }).click();
  await expect(assertiveToasts(page)).toBeEmpty();

  // With a dialog open, the rest of the page is hidden from screen readers, but not the live regions.
  await page.getByRole('button', { name: 'Buka dialog' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Detail acara' }),
  ).toBeVisible();
  for (const region of [politeToasts(page), assertiveToasts(page)])
    expect(
      await region.evaluate(
        (el) => el.closest('[aria-hidden="true"]') === null,
      ),
    ).toBe(true);
  await page.keyboard.press('Escape');
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
  const ok = politeToasts(page).getByText('Komentar terkirim.');
  await expect(ok).toBeVisible();
  await page.clock.runFor(4_900);
  await expect(ok).toBeVisible();
  await page.clock.runFor(200);
  await expect(ok).toBeHidden();

  await page.getByRole('button', { name: 'Dengan urungkan' }).click();
  const undo = politeToasts(page).locator('.g-toast', {
    hasText: 'IF2110 dihapus',
  });
  await page.clock.runFor(7_000);
  await expect(undo).toBeVisible();
  await undo.getByRole('button', { name: 'Urungkan' }).click();
  await expect(undo).toBeHidden();
  await expect(
    politeToasts(page).getByText('IF2110 dikembalikan.'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Notifikasi gagal' }).click();
  const err = assertiveToasts(page).locator('.g-toast', {
    hasText: 'Komentar gagal terkirim',
  });
  await expect(err).toBeVisible();
  await page.clock.runFor(120_000);
  await expect(err).toBeVisible();
  await err.getByRole('button', { name: 'Tutup' }).click();
  await expect(err).toBeHidden();
});

// Review m2: Coba lagi was disabled while retrying, which dropped keyboard focus to the page.
test('Coba lagi keeps focus while it retries and ignores presses until it ends; offline names the last update; skeletons name what is loading', async ({
  page,
}) => {
  await open(page);
  const error = page
    .getByRole('alert')
    .filter({ hasText: 'Pengumuman gagal dimuat' });
  const retry = error.getByRole('button', { name: 'Coba lagi' });
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect(retry).toHaveAttribute('aria-disabled', 'true');
  await expect(retry).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(retry).not.toHaveAttribute('aria-disabled');
  await expect(retry).toBeFocused();
  await expect(page.getByTestId('retry-count')).toHaveText('Dicoba lagi 1×');
  await expect(
    page.getByRole('status').filter({ hasText: 'Offline · diperbarui 07.45' }),
  ).toBeVisible();
  await expect(
    page.getByRole('status', { name: 'Memuat kalender' }),
  ).toBeVisible();
});

// Review m3: Count and Tile put aria-label on a plain span, which ARIA doesn't let screen readers read.
test('a labelled count and tile read their words, not the bare figure or icon', async ({
  page,
}) => {
  await open(page);
  const marks = page.getByTestId('labelled-marks');
  const snapshot = await marks.ariaSnapshot();
  expect(snapshot).toContain('3 belum dibaca');
  expect(snapshot).toContain('Ruang terkunci');
  expect(snapshot).not.toMatch(/text: 3\s*$/m);
  await expect(marks.locator('[aria-label]')).toHaveCount(0);
});

test('on touch layouts every small control has a 44 px hit area, and the gold action is 48 px tall', async ({
  page,
}, testInfo) => {
  test.skip(!isTouch(testInfo), 'touch layouts only');
  await open(page);
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
  // Review m8: every kind of small control, in both kits, not only four in the light one.
  const checked: string[] = [];
  const measure = async (
    name: string,
    control: ReturnType<Page['locator']>,
  ) => {
    await expect(control, name).toBeVisible();
    const { w, h } = await hit(control);
    expect(w, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(h, `${name} height`).toBeGreaterThanOrEqual(44);
    checked.push(name);
  };
  for (const theme of ['light', 'dark'] as const) {
    const k = page.getByTestId(`garis-kit-${theme}`);
    await measure(
      `${theme} switch`,
      k.getByRole('switch', { name: 'Contoh switch mati' }),
    );
    await measure(`${theme} chip`, k.getByRole('button', { name: 'Terbaru' }));
    await measure(
      `${theme} checkbox row`,
      k
        .locator('.g-opt')
        .filter({ has: page.getByRole('checkbox') })
        .first(),
    );
    await measure(
      `${theme} radio row`,
      k
        .locator('.g-opt')
        .filter({ has: page.getByRole('radio') })
        .first(),
    );
    const gold = k.getByRole('button', { name: 'Umumkan' });
    expect((await gold.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  }
  await page.getByRole('button', { name: 'Notifikasi gagal' }).click();
  await measure(
    'icon button sm',
    assertiveToasts(page).getByRole('button', { name: 'Tutup' }),
  );
  await measure(
    'icon button',
    page.getByRole('button', { name: 'Pilihan lain' }),
  );
  await measure(
    'seg label',
    page.getByRole('group', { name: 'Tema contoh' }).locator('label').first(),
  );
  await measure(
    'link',
    page.getByRole('button', { name: 'Lihat semua' }).last(),
  );
  await measure('avatar button', page.getByRole('button', { name: 'Profil' }));
  await measure(
    'reaction',
    page
      .getByTestId('garis-shared')
      .getByRole('button', { pressed: false })
      .first(),
  );
  await measure(
    'checkbox chip',
    page.getByRole('group', { name: 'Kategori' }).getByRole('checkbox').first(),
  );
  await measure('radio chip', page.getByRole('radio', { name: 'K1' }));
  await measure('disclosure', page.locator('.g-disclosure > summary').first());
  expect(checked.length).toBe(17);
});

test('every HMIF logo is the official file, whole, unstretched and at least 40 px wide; icons are inline SVG', async ({
  page,
}) => {
  await open(page);
  // As ops/ui-revamp-review/tools/garis-check.mjs checks the prototype (review m7: also uncovered, unclipped and at
  // full opacity): each copy is scrolled into view and its corners and centre must hit the image itself.
  const report = await page.evaluate(async () => {
    const bad: string[] = [];
    const redrawn = document.querySelectorAll(
      'svg[viewBox="0 0 160 93"]',
    ).length;
    if (redrawn) bad.push(`${redrawn} redrawn IF marks`);
    const logos = [...document.querySelectorAll('img')].filter(
      (i) => /\/logo\/hmif\.png$/.test(i.src) && i.getClientRects().length,
    );
    for (const [n, img] of logos.entries()) {
      img.scrollIntoView({ block: 'center' });
      await new Promise((r) => setTimeout(r, 60));
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(img);
      const where = `logo ${n + 1} in ${img.parentElement?.className || img.parentElement?.tagName}`;
      if (
        !img.complete ||
        img.naturalWidth !== 800 ||
        img.naturalHeight !== 533
      )
        bad.push(`${where}: not loaded`);
      if (Math.abs(r.width / r.height - 800 / 533) > 0.02)
        bad.push(`${where}: stretched to ${r.width}×${r.height}`);
      if (r.width < 40) bad.push(`${where}: ${r.width} px wide`);
      if (
        cs.filter !== 'none' ||
        cs.mixBlendMode !== 'normal' ||
        cs.transform !== 'none' ||
        cs.rotate !== 'none' ||
        cs.clipPath !== 'none'
      )
        bad.push(`${where}: altered by CSS`);
      let opacity = 1;
      for (let el: Element | null = img; el; el = el.parentElement)
        opacity *= Number(getComputedStyle(el).opacity);
      if (opacity !== 1) bad.push(`${where}: opacity ${opacity}`);
      const pts = [
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
        [r.left + r.width / 2, r.top + r.height / 2],
      ];
      if (pts.some(([x, y]) => document.elementFromPoint(x, y) !== img))
        bad.push(`${where}: covered or clipped`);
    }
    return { n: logos.length, bad };
  });
  expect(report.n).toBeGreaterThanOrEqual(6);
  expect(report.bad).toEqual([]);
  expect(await page.locator('#icons .icon-cell svg.g-ic').count()).toBe(54);
  expect(
    await page.locator('main img:not([src="/logo/hmif.png"])').count(),
  ).toBe(0);
});
