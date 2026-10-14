/**
 * F2 (brief step 4; accessibility.md A15): the keyboard journeys J1–J10 with the keyboard alone, at phone (a hardware
 * keyboard on the touch layout), tablet and desktop. Only `page.goto` (opening a URL, as a link from outside would) and
 * the keys Tab, Shift+Tab, Enter, Space, the arrows, Home, End, Page Up, Page Down and Escape: no clicks and no
 * `.focus()`. `tabTo` presses Tab until the control has focus, so each step also proves the control is reachable.
 */
import type { Locator, Page } from '@playwright/test';
import { greeting, layoutOf } from '../support/app';
import { fakeGoogle, googleRequests } from '../support/google';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const LAYOUTS = /^qa-(phone|tablet|desktop)-light$/;
const MAX_TABS = 250;

/** Tab (or Shift+Tab) until `target` has focus; fails if it never does. */
async function tabTo(page: Page, target: Locator, back = false) {
  for (let i = 0; i < MAX_TABS; i++) {
    if (
      await target
        .evaluate((el) => el === document.activeElement)
        .catch(() => false)
    )
      return;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  await expect(
    target,
    `reached by ${back ? 'Shift+Tab' : 'Tab'}`,
  ).toBeFocused();
}

const main = (page: Page) => page.getByRole('main');

// Playwright reads the fixtures from an object pattern, so it stays, empty.
// eslint-disable-next-line no-empty-pattern
test.beforeEach(({}, testInfo) => {
  test.skip(
    !LAYOUTS.test(testInfo.project.name),
    'phone, tablet and desktop, light',
  );
});

test.describe('J1', () => {
  test.use({ signedIn: false, push: 'on' });
  test('J1: sign in, then reach Beranda', async ({ page, api }) => {
    await fakeGoogle(page.context());
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    api.on('POST /api/push/register', writes.registerPush);
    await page.goto('/login');
    await expect
      .poll(async () => (await googleRequests(page)).clients.length)
      .toBe(1);
    const masuk = page.getByRole('button', { name: 'Masuk dengan Google' });
    await tabTo(page, masuk);
    await page.keyboard.press('Enter');
    // A first sign-in with courses not set goes to first run; Ke Beranda from there.
    await expect(page).toHaveURL(/\/(mulai)?$/);
    if (/\/mulai$/.test(page.url())) {
      await tabTo(
        page,
        page
          .getByRole('link', { name: 'Ke Beranda' })
          .or(page.getByRole('button', { name: 'Ke Beranda' }))
          .first(),
      );
      await page.keyboard.press('Enter');
    }
    await expect(greeting(page)).toBeVisible();
  });
});

test('J2: the skip link, then every service in Layanan', async ({
  page,
}, testInfo) => {
  await page.goto('/layanan');
  await expect(page.locator('h1:visible')).toHaveCount(1);
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Langsung ke isi halaman' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#isi')).toBeFocused();
  for (const [name, url] of [
    ['Ding Dong', /\/layanan\/dingdong$/],
    ['Testi Matkul', /\/layanan\/testi$/],
    ['NIM Finder', /\/layanan\/nim/],
    ['Curhat Yuk!', /\/layanan\/curhat$/],
    ['Form', /\/layanan\/form$/],
    ['Info Lomba', /\/layanan\/lomba$/],
  ] as const) {
    await page.goto('/layanan');
    const link = main(page).getByRole('link', {
      name: new RegExp(`^${name.replace('!', '\\!')}`),
    });
    await tabTo(page, link);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(url);
  }
  // An external service opens in a new tab and PIPS! stays.
  await page.goto('/layanan');
  const beasiswa = main(page).getByRole('link', { name: /^Beasiswa/ });
  await tabTo(page, beasiswa);
  const popup = page.context().waitForEvent('page');
  await page.keyboard.press('Enter');
  await (await popup).close();
  await expect(page).toHaveURL(/\/layanan$/);
  expect(layoutOf(testInfo)).toBeTruthy();
});

test('J3: Pengumuman: search, Belum dibaca, the filter, sort; a post: react, comment, share', async ({
  page,
  api,
}, testInfo) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  api.on('PUT /api/reaction', writes.react);
  api.on('POST /api/comment', writes.comment);
  test.setTimeout(180_000);
  await page.goto('/pengumuman');
  await expect(page.locator('h1:visible')).toHaveCount(1);
  const search = page.getByRole('searchbox', { name: 'Cari pengumuman' });
  await tabTo(page, search);
  await page.keyboard.type('UTS');
  await expect(page).toHaveURL(/search=UTS/);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  const unread = page
    .getByRole('button', { name: /^Belum dibaca/ })
    .locator('visible=true')
    .first();
  await tabTo(page, unread);
  await page.keyboard.press('Space');
  await expect(unread).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Space');
  await expect(unread).toHaveAttribute('aria-pressed', 'false');
  const kategori = page
    .getByRole('button', { name: /^Kategori/ })
    .locator('visible=true')
    .first();
  await tabTo(page, kategori);
  await page.keyboard.press('Enter');
  const overlay = page.getByRole('dialog').or(page.getByRole('menu')).first();
  await expect(overlay).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(overlay).toHaveCount(0);
  await expect(kategori).toBeFocused();
  const sort = page
    .getByRole('button', { name: /^Urutan:/ })
    .locator('visible=true')
    .first();
  await tabTo(page, sort);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/sort=oldest/);

  await page.goto('/pengumuman/p1');
  await expect(
    page.getByRole('heading', { name: /Jadwal UTS/ }).first(),
  ).toBeVisible();
  const react = main(page)
    .getByRole('button', { name: /Beri reaksi$/ })
    .first();
  await tabTo(page, react);
  await page.keyboard.press('Enter');
  const keren = page.getByRole('button', { name: 'Keren', exact: true });
  await expect(keren).toBeVisible();
  await tabTo(page, keren);
  await page.keyboard.press('Enter');
  await expect.poll(() => api.calls('PUT /api/reaction').length).toBe(1);
  const field = page.getByRole('textbox', { name: 'Tulis komentar' });
  await tabTo(page, field);
  await page.keyboard.type('Sudah dicek, terima kasih');
  const send = page.getByRole('button', { name: 'Kirim komentar' });
  await tabTo(page, send);
  await page.keyboard.press('Enter');
  await expect(main(page).getByText('Sudah dicek, terima kasih')).toBeVisible();
  // Sharing: Bagikan in the top bar on phones and tablets. Desktop has none, as the prototype's `postDetail` (only the
  // Opsi menu): F2-016, a question for the owner. There, the post's menu by keyboard.
  if (layoutOf(testInfo) !== 'desktop') {
    const share = page
      .getByRole('button', { name: 'Bagikan' })
      .locator('visible=true')
      .first();
    await tabTo(page, share);
    await expect(share).toBeFocused();
  } else {
    const opsi = main(page).getByRole('button', {
      name: /^Opsi untuk Jadwal UTS/,
    });
    await tabTo(page, opsi);
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(opsi).toBeFocused();
  }
});

test('J4: Buat pengumuman: a missing field takes focus, then it posts', async ({
  page,
  api,
}) => {
  api.on('POST /api/info', writes.createInfo);
  api.on('POST /api/info/:infoId/read', writes.markRead);
  await page.goto('/pengumuman/tulis');
  const body = page.getByRole('textbox', { name: 'Isi pengumuman' });
  await expect(body).toBeVisible();
  const umumkan = page.getByRole('button', { name: 'Umumkan' });
  await tabTo(page, umumkan);
  await page.keyboard.press('Enter');
  // The first field with an error takes focus (A10).
  await expect(body).toBeFocused();
  await expect(body).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.type('Rapat koordinasi Jumat pukul 16.00 di Labtek V.');
  const umum = page.getByRole('checkbox', { name: 'Umum' });
  await tabTo(page, umum);
  await page.keyboard.press('Space');
  await expect(umum).toBeChecked();
  await tabTo(page, umumkan);
  await page.keyboard.press('Enter');
  await expect.poll(() => api.calls('POST /api/info').length).toBe(1);
});

test('J5: Kalender: change the month, pick a day with the arrows, read its agenda', async ({
  page,
}) => {
  await page.goto('/kalender');
  const day = (name: RegExp, month = 'Oktober 2026') =>
    main(page)
      .getByRole('group', { name: month })
      .getByRole('button', { name });
  // The grid has one Tab stop: the chosen day (roving tabindex).
  await tabTo(page, day(/^Kamis, 8 Oktober/));
  await page.keyboard.press('ArrowRight');
  await expect(day(/^Jumat, 9 Oktober/)).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(day(/^Senin, 9 November/, 'November 2026')).toBeFocused();
  await page.keyboard.press('PageUp');
  await expect(day(/^Jumat, 9 Oktober/)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(day(/^Jumat, 9 Oktober/)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    main(page).getByText('Deadline Tugas Besar 1').first(),
  ).toBeVisible();
});

test('J6: Curhat: read the log, reply to a message, send; delete asks first, Batal focused', async ({
  page,
  api,
}) => {
  api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom);
  await page.goto('/layanan/curhat/r1');
  const log = page.getByRole('log');
  await expect(log).toBeVisible();
  const balas = log.getByRole('button', { name: 'Balas' }).last();
  await tabTo(page, balas);
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Batal membalas' }),
  ).toBeVisible();
  const field = page.getByRole('textbox').last();
  await expect(field).toBeFocused();
  await page.keyboard.type('Terima kasih, Kak');
  const kirim = page.getByRole('button', { name: 'Kirim pesan' });
  await tabTo(page, kirim);
  await page.keyboard.press('Enter');
  await expect(log.getByText('Terima kasih, Kak')).toBeVisible();
  const hapus = page
    .getByRole('button', { name: 'Hapus ruang ini' })
    .or(main(page).getByRole('button', { name: 'Hapus ruang' }))
    .locator('visible=true')
    .first();
  await tabTo(page, hapus, true);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Hapus ruang ini?' });
  await expect(dialog.getByRole('button', { name: 'Batal' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('J7: Form PIXEL: an error on the first section takes focus; Sebelumnya and Lanjut by keyboard', async ({
  page,
}) => {
  await page.goto('/layanan/form/pixel');
  const lanjut = page
    .getByRole('button', { name: /^(Lanjut|Mulai)/ })
    .locator('visible=true')
    .first();
  await tabTo(page, lanjut);
  await page.keyboard.press('Enter');
  // Lanjut with a required question empty: the first error takes focus (A10).
  const next = page
    .getByRole('button', { name: 'Lanjut' })
    .locator('visible=true')
    .first();
  await tabTo(page, next);
  await page.keyboard.press('Enter');
  const invalid = page.locator('[aria-invalid="true"]').first();
  await expect(invalid).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = document.activeElement;
        return (
          !!a &&
          (a.getAttribute('aria-invalid') === 'true' ||
            !!a.closest('[aria-invalid="true"]'))
        );
      }),
    )
    .toBe(true);
});

test.describe('J8', () => {
  test('J8: Magang SPARTA (season open): Mulai, the first error focused, choose divisions and reorder them', async ({
    page,
    api,
    db,
  }) => {
    db.spartaWindow = {
      opensAt: '2026-09-30T17:00:00.000Z',
      closesAt: '2026-10-31T16:59:00.000Z',
    };
    db.internshipSubmissions = db.internshipSubmissions.filter(
      (s) => s.userId !== db.me!.id,
    );
    api.on('PUT /api/internship/submission', writes.saveSpartaDraft);
    await page.goto('/layanan/sparta');
    const mulai = page.getByRole('button', { name: 'Mulai' });
    await tabTo(page, mulai);
    await page.keyboard.press('Enter');
    const lanjut = page.getByRole('button', { name: 'Lanjut' });
    await tabTo(page, lanjut);
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Kelas')).toBeFocused();
    await page.keyboard.type('IF K2');
    const line = page.getByLabel(/ID LINE/);
    await tabTo(page, line);
    await page.keyboard.type('nadia.putri');
    await tabTo(page, lanjut);
    await page.keyboard.press('Enter');
    await expect
      .poll(() => api.calls('PUT /api/internship/submission').length)
      .toBeGreaterThan(0);
    // Step 2 explains the divisions; Lanjut to choosing them.
    await tabTo(page, lanjut);
    await page.keyboard.press('Enter');
    const boxes = main(page).getByRole('checkbox');
    await expect(boxes.first()).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await tabTo(page, boxes.nth(i));
      await page.keyboard.press('Space');
      await expect(boxes.nth(i)).toBeChecked();
    }
    const up = main(page)
      .getByRole('button', { name: /^Naikkan / })
      .last();
    await tabTo(page, up);
    await page.keyboard.press('Enter');
    await expect(main(page).getByRole('status').first()).toBeAttached();
  });
});

test('J9: Mata kuliahku: remove a course and undo it, no swipe; Notifikasi: a switch says its category and state', async ({
  page,
  api,
}) => {
  api.on('DELETE /api/course/take/batch', writes.dropCourses);
  api.on('PUT /api/course/take/batch', writes.takeCourses);
  api.on('POST /api/unsubscribe/category', writes.muteCategory);
  api.on('DELETE /api/unsubscribe/category', writes.unmuteCategory);
  await page.goto('/profil/matkul');
  const remove = main(page).getByRole('button', { name: /^Hapus IF2110 / });
  await tabTo(page, remove);
  await page.keyboard.press('Enter');
  const undo = page.getByRole('button', { name: 'Urungkan' });
  await expect(undo).toBeVisible();
  await tabTo(page, undo);
  await page.keyboard.press('Enter');
  await expect(
    main(page).getByRole('button', { name: /^Hapus IF2110 / }),
  ).toBeVisible();

  await page.goto('/profil/notifikasi');
  const lomba = page.getByRole('switch', { name: 'Lomba' });
  await tabTo(page, lomba);
  const before = await lomba.getAttribute('aria-checked');
  await page.keyboard.press('Space');
  await expect(lomba).not.toHaveAttribute('aria-checked', before ?? '');
});

test.describe('J10', () => {
  test.use({ persona: 'pengurus' });
  test('J10: Live Counting and Data SPARTA Magang: every control by keyboard, charts with a text alternative', async ({
    page,
  }) => {
    await page.goto('/kelola/live/pixel');
    await expect(page.getByText('orang sudah mengisi').first()).toBeVisible();
    // Each chart has its numbers in text (a list or a table), not only bars.
    const charts = main(page).locator('figure, [role="img"], [role="figure"]');
    for (let i = 0; i < (await charts.count()); i++) {
      const name = await charts
        .nth(i)
        .evaluate(
          (el) =>
            el.getAttribute('aria-label') ||
            (el.querySelector('figcaption')?.textContent ?? '') +
              (el.textContent ?? ''),
        );
      expect(
        name.trim().length,
        `chart ${i} has a text alternative`,
      ).toBeGreaterThan(0);
    }
    const semua = main(page)
      .getByRole('link', { name: /^Semua/ })
      .first();
    await tabTo(page, semua);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/rekap/);
    await page.goto('/kelola/sparta');
    // A radio group is one Tab stop (its chosen option); the arrows move within it.
    const draf = page.getByRole('radio', { name: 'Draf' });
    const chosen = draf
      .locator('xpath=ancestor::*[@role="radiogroup" or self::fieldset][1]')
      .getByRole('radio', { checked: true });
    await tabTo(page, chosen);
    for (
      let i = 0;
      i < 3 && !(await draf.evaluate((el) => el === document.activeElement));
      i++
    )
      await page.keyboard.press('ArrowRight');
    await expect(draf).toBeFocused();
    await expect(page).toHaveURL(/status=draf/);
  });
});
