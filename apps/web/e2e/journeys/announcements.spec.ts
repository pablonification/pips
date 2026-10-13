/**
 * Pengumuman (P1-B): the feed, a post, reactions, comments, the menu, the filter and search, at phone, tablet and
 * desktop size in light and dark, with strict gates. Every write's body is checked as the API received it.
 * The composer is in compose.spec.ts.
 */
import { layoutOf } from '../support/app';
import { reply } from '../support/mock';
import {
  P1,
  P2,
  P4_TEXT,
  P5,
  P7,
  card,
  detail,
  expectFocused,
  expectUnread,
  isDesk,
  menuButton,
  postInList,
  strictGates,
  toastText,
} from '../support/pengumuman';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const backButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Kembali ke / });

test.describe('catching up (Nadia)', () => {
  test('the count, opening a post marks it read, back returns to its card, mark unread', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.goto('/pengumuman');
    await expect(page.getByRole('heading', { level: 1, name: 'Pengumuman' })).toBeVisible();
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    // p5 is for the akademik group: the server doesn't send it to Nadia.
    await expect(page.getByText(P5)).toHaveCount(0);
    await expectUnread(page, 4);
    await strictGates(page, testInfo, 'feed');
    // Desktop shows the first post beside the list without marking it read.
    if (isDesk(testInfo)) {
      await expect(detail(page).getByRole('heading', { name: P1 })).toBeVisible();
      await expect(postInList(page, testInfo, 'p1')).toHaveAttribute('aria-current', 'true');
      expect(api.calls('POST /api/info/:infoId/read')).toHaveLength(0);
    }

    await postInList(page, testInfo, 'p1').click();
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(detail(page).getByRole('heading', { name: P1 })).toBeVisible();
    await expect.poll(() => api.calls('POST /api/info/p1/read').map((c) => c.body)).toEqual([{ unread: false }]);
    await expectUnread(page, 3);
    await expect(detail(page).getByText('Kak, IF2123 K01 sama K02 ruangnya beda ya?')).toBeVisible();
    await strictGates(page, testInfo, 'post');

    if (isDesk(testInfo)) {
      // The row keeps focus; the list stays.
      await expectFocused(postInList(page, testInfo, 'p1'));
      await expect(postInList(page, testInfo, 'p1')).toHaveAttribute('aria-current', 'true');
    } else {
      // The post is the page: its title is the h1, and focus is on it.
      await expect(page.getByRole('heading', { level: 1, name: P1 })).toBeFocused();
      await backButton(page).click();
      await expect(page).toHaveURL(/\/pengumuman$/);
      await expectFocused(postInList(page, testInfo, 'p1'));
      await postInList(page, testInfo, 'p1').click();
      await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    }

    // Mark it unread from its menu: the count goes back up at once.
    await menuButton(page, P1).click();
    await strictGates(page, testInfo, 'post-menu');
    await page.getByRole('menuitem', { name: 'Tandai belum dibaca' }).click();
    await expect(toastText(page, 'Ditandai belum dibaca.')).toBeVisible();
    await expectFocused(menuButton(page, P1));
    await expect.poll(() => api.calls('POST /api/info/p1/read').map((c) => c.body)).toEqual([
      { unread: false },
      { unread: true },
    ]);
    await expectUnread(page, 4);
  });

  test('reactions: give, change and remove one, react to a comment; Escape closes the picker', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/info/:infoId/read', writes.markRead)
      .on('PUT /api/reaction', writes.react)
      .on('DELETE /api/reaction/info/:infoId', writes.unreact)
      .on('DELETE /api/reaction/comment/:commentId', writes.unreact);
    await page.goto('/pengumuman');
    const desk = isDesk(testInfo);
    // From the feed's card on phones and tablets; from the post beside the list on desktop.
    const opener = desk
      ? detail(page).getByRole('button', { name: 'Beri reaksi', exact: true })
      : card(page, P1).getByRole('button', { name: '24 reaksi. Beri reaksi' });
    await opener.click();
    const picker = page.getByRole('group', { name: 'Pilih reaksi' });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('button', { name: 'Senyum lebar' })).toBeFocused();
    await strictGates(page, testInfo, 'picker');
    await page.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);
    await expectFocused(opener);

    await opener.click();
    await picker.getByRole('button', { name: 'Keren' }).click();
    await expect.poll(() => api.calls('PUT /api/reaction').map((c) => c.body)).toEqual([
      { infoId: 'p1', reaction: 'fire' },
    ]);
    const changed = desk
      ? detail(page).getByRole('button', { name: 'Ganti reaksi', exact: true })
      : card(page, P1).getByRole('button', { name: 'Reaksimu Keren. 25 reaksi. Ganti reaksi' });
    await expectFocused(changed);
    if (desk)
      await expect(detail(page).getByRole('button', { name: 'Keren, 4 orang, termasuk kamu' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

    await changed.click();
    await expect(picker.getByRole('button', { name: 'Keren' })).toHaveAttribute('aria-pressed', 'true');
    await picker.getByRole('button', { name: 'Rayakan' }).click();
    await expect.poll(() => api.calls('PUT /api/reaction').length).toBe(2);
    expect(api.calls('PUT /api/reaction')[1].body).toEqual({ infoId: 'p1', reaction: 'party' });

    // Picking yours again removes it.
    await changed.click();
    await picker.getByRole('button', { name: 'Rayakan' }).click();
    await expect.poll(() => api.calls('DELETE /api/reaction/info/p1').length).toBe(1);
    await expect(opener).toBeVisible();

    // A comment, on the post itself.
    if (!desk) await postInList(page, testInfo, 'p1').click();
    const cmt = detail(page).getByRole('button', { name: 'Beri reaksi untuk komentar Bima Santoso' });
    await cmt.click();
    await page.getByRole('group', { name: 'Pilih reaksi' }).getByRole('button', { name: 'Senyum lebar' }).click();
    await expect.poll(() => api.calls('PUT /api/reaction').map((c) => c.body).at(-1)).toEqual({
      commentId: 'p1-c1',
      reaction: 'grin',
    });
    await expect(
      detail(page).getByRole('button', { name: 'Reaksimu Senyum lebar. Ganti untuk komentar Bima Santoso' }),
    ).toBeFocused();
  });

  test('a reaction the server refuses rolls back with an error', async ({ page, api }, testInfo) => {
    api.on('POST /api/info/:infoId/read', writes.markRead).on('PUT /api/reaction', reply.status(500));
    await page.goto('/pengumuman/p2');
    await detail(page).getByRole('button', { name: 'Beri reaksi', exact: true }).click();
    await page.getByRole('group', { name: 'Pilih reaksi' }).getByRole('button', { name: 'Keren' }).click();
    await expect(page.getByText('Reaksi gagal dikirim. Coba lagi.')).toBeVisible();
    // Keren is back to 18, not Nadia's.
    await expect(detail(page).getByRole('button', { name: 'Keren, 18 orang' })).toHaveAttribute('aria-pressed', 'false');
    await strictGates(page, testInfo, 'reaction-error');
  });

  test('commenting, then deleting your own comment through the confirmation', async ({ page, api }, testInfo) => {
    api
      .on('POST /api/info/:infoId/read', writes.markRead)
      .on('POST /api/comment', writes.comment)
      .on('DELETE /api/comment/:commentId', writes.deleteComment);
    await page.goto('/pengumuman/p7');
    const field = page.getByRole('textbox', { name: 'Tulis komentar' });
    // Empty sends nothing.
    await page.getByRole('button', { name: 'Kirim komentar' }).click();
    await expectFocused(field);
    expect(api.calls('POST /api/comment')).toHaveLength(0);

    await field.fill('Sudah ketemu, makasih!');
    await page.getByRole('button', { name: 'Kirim komentar' }).click();
    await expect(detail(page).getByText('Sudah ketemu, makasih!')).toBeVisible();
    expect(api.calls('POST /api/comment')[0].body).toEqual({ repliedInfoId: 'p7', content: 'Sudah ketemu, makasih!' });
    await expect(toastText(page, 'Komentar terkirim.')).toBeVisible();
    await expect(field).toHaveValue('');
    await expectFocused(field);
    await expect(detail(page).getByRole('heading', { name: 'Komentar 2' })).toBeVisible();

    // Only her own comment has Hapus (Nadia isn't admin).
    const mine = detail(page).locator('[data-comment="p7-c2"]');
    await expect(detail(page).locator('[data-comment="p7-c1"]').getByRole('button', { name: 'Hapus' })).toHaveCount(0);
    await mine.getByRole('button', { name: 'Hapus' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus komentar ini?' });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText('Komentar hilang untuk semua anggota.')).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Batal' })).toBeFocused();
    await strictGates(page, testInfo, 'confirm-comment');
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/comment/p7-c2').length).toBe(1);
    await expect(toastText(page, 'Komentar dihapus.')).toBeVisible();
    await expect(detail(page).getByText('Sudah ketemu, makasih!')).toHaveCount(0);
    await expectFocused(field);
  });

  test('a comment that fails keeps its text, with Coba lagi', async ({ page, api }) => {
    let fail = true;
    api.on('POST /api/info/:infoId/read', writes.markRead).on('POST /api/comment', (req) => {
      if (fail) return reply.status(500);
      return writes.comment(req);
    });
    await page.goto('/pengumuman/p7');
    const field = page.getByRole('textbox', { name: 'Tulis komentar' });
    await field.fill('Di pos satpam?');
    await page.getByRole('button', { name: 'Kirim komentar' }).click();
    await expect(page.getByText('Komentar gagal dikirim. Tulisanmu masih ada.')).toBeVisible();
    await expect(field).toHaveValue('Di pos satpam?');
    fail = false;
    await page.locator('.g-toast-region').getByRole('button', { name: 'Coba lagi' }).click();
    await expect(detail(page).getByText('Di pos satpam?')).toBeVisible();
    await expect(field).toHaveValue('');
  });
});

test.describe('filter and search', () => {
  test('hiding Akademik sends its name; Terlama, Belum dibaca, search, the empty state, Tampilkan semua', async ({
    page,
    api,
  }, testInfo) => {
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await page.getByRole('button', { name: /^Kategori/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Kategori yang ditampilkan' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Notifikasi diatur terpisah di Profil.')).toBeVisible();
    await strictGates(page, testInfo, 'filter');
    const akademik = sheet.getByRole('switch', { name: 'Akademik' });
    await expect(akademik).toHaveAttribute('aria-checked', 'true');
    await akademik.click();
    await expect(akademik).toHaveAttribute('aria-checked', 'false');
    // Regression (P1-B): the harness compared ids ("akademik"); the API takes names.
    await expect
      .poll(() => api.calls('GET /api/info').some((c) => new URLSearchParams(c.query).get('excludeCategory') === 'Akademik'))
      .toBe(true);
    await sheet.getByRole('button', { name: 'Selesai' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(postInList(page, testInfo, 'p1')).toHaveCount(0);
    await expect(postInList(page, testInfo, 'p2')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kategori 1 disembunyikan' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/excludeCategories=/);

    // The URL holds the view across a reload.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Kategori 1 disembunyikan' })).toBeVisible();
    await expect(postInList(page, testInfo, 'p2')).toBeVisible();
    await expect(postInList(page, testInfo, 'p1')).toHaveCount(0);

    // Oldest first.
    await page.getByRole('button', { name: 'Urutan: terbaru dulu. Ganti urutan' }).click();
    await expect
      .poll(() => api.calls('GET /api/info').some((c) => new URLSearchParams(c.query).get('sort') === 'oldest'))
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Urutan: terlama dulu. Ganti urutan' })).toBeVisible();
    const first = isDesk(testInfo) ? page.locator('[data-post-row]').first() : page.locator('[data-post-link]').first();
    await expect(first).toHaveAttribute(isDesk(testInfo) ? 'data-post-row' : 'data-post-link', 'p7');

    // Unread only.
    await page.getByRole('button', { name: /^Belum dibaca/ }).click();
    await expect(page.getByRole('button', { name: /^Belum dibaca/ })).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(() => api.calls('GET /api/info').some((c) => c.query.includes('unread=true') && c.query.includes('sort=oldest')))
      .toBe(true);
    await expect(postInList(page, testInfo, 'p7')).toHaveCount(0);
    await expect(postInList(page, testInfo, 'p2')).toBeVisible();
    await strictGates(page, testInfo, 'feed-filtered');

    // Back to everything, then search.
    await page.getByRole('button', { name: /^Kategori/ }).click();
    await page.getByRole('dialog', { name: 'Kategori yang ditampilkan' }).getByRole('button', { name: 'Tampilkan semua' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(page.getByRole('button', { name: 'Kategori' })).toHaveAttribute('aria-pressed', 'false');
    await expect(postInList(page, testInfo, 'p7')).toBeVisible();

    const search = page.getByRole('searchbox', { name: 'Cari pengumuman' });
    await search.fill('beasiswa');
    await expect.poll(() => api.calls('GET /api/info').some((c) => c.query.includes('search=beasiswa'))).toBe(true);
    await expect(page.getByText(P4_TEXT).first()).toBeVisible();
    await expect(postInList(page, testInfo, 'p1')).toHaveCount(0);
    await expect(page).toHaveURL(/search=beasiswa/);

    await search.fill('zzzz');
    await expect(page.getByText('Tidak ada yang ditampilkan')).toBeVisible();
    await expect(page.getByText('Tidak ada pengumuman yang cocok dengan “zzzz”.')).toBeVisible();
    if (isDesk(testInfo)) await expect(page.getByText('Pilih pengumuman')).toBeVisible();
    await strictGates(page, testInfo, 'feed-empty-search');
    await page.getByRole('button', { name: 'Tampilkan semua' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(search).toHaveValue('');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
  });

  test('search matches the title and the text, not the author', async ({ page }, testInfo) => {
    await page.goto('/pengumuman?search=Salsabila');
    await expect(page.getByText('Tidak ada yang ditampilkan')).toBeVisible();
    await page.goto('/pengumuman?search=Gemastik');
    await expect(postInList(page, testInfo, 'p2')).toBeVisible();
  });

  test('desktop: when the open post leaves the list, the first visible post takes its place @desktop-only', async ({
    page,
    api,
  }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.goto('/pengumuman/p1');
    await expect(detail(page).getByRole('heading', { name: P1 })).toBeVisible();
    await page.getByRole('button', { name: /^Kategori/ }).click();
    await page.getByRole('switch', { name: 'Akademik' }).click();
    await page.getByRole('button', { name: 'Selesai' }).click();
    await expect(page).toHaveURL(/\/pengumuman\?/);
    await expect(detail(page).getByRole('heading', { name: P2 })).toBeVisible();
    await expect(page.locator('[data-post-row="p2"]')).toHaveAttribute('aria-current', 'true');
    // The automatic selection isn't marked read.
    expect(api.calls('POST /api/info/p2/read')).toHaveLength(0);
  });
});

test.describe('the author (Raka, admin)', () => {
  test.use({ persona: 'pengurus' });

  test('Umumkan ulang: locked until 15.30 on p1, sent on p5', async ({ page, api }, testInfo) => {
    api.on('POST /api/info/:infoId/read', writes.markRead).on('POST /api/info/:infoId/renotify', writes.renotify);
    await page.goto('/pengumuman/p1');
    await menuButton(page, P1).click();
    const locked = page.getByRole('menuitem', { name: /^Umumkan ulang/ });
    await expect(locked).toHaveAccessibleName('Umumkan ulang Bisa lagi mulai 15.30');
    await expect(locked).toHaveAttribute('aria-disabled', 'true');
    await strictGates(page, testInfo, 'menu-own');
    await locked.click();
    await expect(
      toastText(page, 'Umumkan ulang bisa lagi mulai 15.30. Jeda 3 jam supaya anggota tidak kebanjiran notifikasi.'),
    ).toBeVisible();
    // It stays open, and nothing was sent.
    await expect(locked).toBeVisible();
    expect(api.calls('POST /api/info/:infoId/renotify')).toHaveLength(0);
    await page.keyboard.press('Escape');
    await expectFocused(menuButton(page, P1));

    await page.goto('/pengumuman/p5');
    await menuButton(page, P5).click();
    const open = page.getByRole('menuitem', { name: /^Umumkan ulang/ });
    await expect(open).toHaveAccessibleName('Umumkan ulang Kirim notifikasi lagi ke sasaran');
    await open.click();
    await expect.poll(() => api.calls('POST /api/info/p5/renotify').length).toBe(1);
    await expect(toastText(page, 'Diumumkan ulang. Notifikasi dikirim lagi ke grup Akademik.')).toBeVisible();
  });

  test('as admin: delete Bima’s comment and Salsa’s post (“Sebagai admin”); then his own post, back to the feed', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/info/:infoId/read', writes.markRead)
      .on('DELETE /api/comment/:commentId', writes.deleteComment)
      .on('DELETE /api/info/:infoId', writes.deleteInfo);
    await page.goto('/pengumuman/p1');
    await detail(page).locator('[data-comment="p1-c1"]').getByRole('button', { name: 'Hapus' }).click();
    await page.getByRole('alertdialog', { name: 'Hapus komentar ini?' }).getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/comment/p1-c1').length).toBe(1);
    await expect(detail(page).getByText('Kak, IF2123 K01 sama K02 ruangnya beda ya?')).toHaveCount(0);

    await page.goto('/pengumuman/p2');
    await menuButton(page, P2).click();
    const del = page.getByRole('menuitem', { name: 'Hapus pengumuman Sebagai admin' });
    await expect(del).toBeVisible();
    // Not his: no Umumkan ulang.
    await expect(page.getByRole('menuitem', { name: /^Umumkan ulang/ })).toHaveCount(0);
    await del.click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus pengumuman ini?' });
    await expect(
      confirm.getByText('Pengumuman, reaksi, dan komentarnya hilang untuk semua anggota. Ini tidak bisa diurungkan.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'confirm-post');
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/info/p2').length).toBe(1);
    await expect(toastText(page, 'Pengumuman dihapus.')).toBeVisible();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Pengumuman' })).toBeFocused();
    await expect(page.locator('[data-post-row="p2"], [data-post-link="p2"]')).toHaveCount(0);

    await page.goto('/pengumuman/p1');
    await menuButton(page, P1).click();
    await page.getByRole('menuitem', { name: 'Hapus pengumuman' }).click();
    await page.getByRole('alertdialog', { name: 'Hapus pengumuman ini?' }).getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/info/p1').length).toBe(1);
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(page.locator('[data-post-row="p1"], [data-post-link="p1"]')).toHaveCount(0);
  });

  test('a delete the server refuses shows an error and keeps the post', async ({ page, api }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead).on('DELETE /api/info/:infoId', reply.status(403));
    await page.goto('/pengumuman/p2');
    await menuButton(page, P2).click();
    await page.getByRole('menuitem', { name: /^Hapus pengumuman/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Hapus' }).click();
    await expect(page.getByText('Kamu tidak bisa melakukan ini.')).toBeVisible();
    await expect(page).toHaveURL(/\/pengumuman\/p2$/);
    await expect(detail(page).getByRole('heading', { name: P2 })).toBeVisible();
  });
});

test.describe('deep links', () => {
  test('a push to /timeline/p2 lands on /pengumuman/p2, marked read', async ({ page, api }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.goto('/timeline/p2');
    await expect(page).toHaveURL(/\/pengumuman\/p2$/);
    await expect(detail(page).getByRole('heading', { name: P2 })).toBeVisible();
    await expect.poll(() => api.calls('POST /api/info/p2/read').map((c) => c.body)).toEqual([{ unread: false }]);
  });

  test('a post that is gone shows its not-found state and the way back (regression: the old page went blank)', async ({
    page,
  }, testInfo) => {
    await page.goto('/pengumuman/hilang');
    await expect(page.getByText('Pengumuman tidak ditemukan')).toBeVisible();
    await expect(page.getByText('Pengumuman ini sudah dihapus, atau bukan untukmu.')).toBeVisible();
    await strictGates(page, testInfo, 'not-found');
    await page.getByRole('button', { name: 'Kembali ke Pengumuman' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
  });

  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('a shared link goes through sign-in and back to the post', async ({ page, api, db }) => {
      await page.goto('/timeline/p2');
      await expect(page).toHaveURL(/\/login\?redirect=%2Fpengumuman%2Fp2$/);
      expect(api.calls('GET /api/info/:infoId')).toHaveLength(0);
      // Signing in (P1-C owns the sign-in screen): the session now exists, and the redirect is followed.
      db.signedIn = true;
      api.on('POST /api/info/:infoId/read', writes.markRead);
      await page.addInitScript((user) => localStorage.setItem('user', JSON.stringify(user)), db.me);
      await page.goto('/pengumuman/p2');
      await expect(detail(page).getByRole('heading', { name: P2 })).toBeVisible();
      await expect.poll(() => api.calls('POST /api/info/p2/read').length).toBe(1);
    });
  });
});

test.describe('states', () => {
  test('loading shows the skeleton; a 503 shows Coba lagi, which recovers', async ({ page, api }, testInfo) => {
    let mode: 'hang' | 'fail' | 'ok' = 'hang';
    api.on('GET /api/info', (req) => {
      if (new URLSearchParams(req.query).get('unread') === 'true') return { infos: [] };
      if (mode === 'hang') return reply.hang();
      if (mode === 'fail') return reply.status(503);
      return { infos: req.db.infos.slice(0, 10) };
    });
    await page.goto('/pengumuman');
    await expect(page.getByRole('status', { name: 'Memuat pengumuman…' }).first()).toBeVisible();
    await strictGates(page, testInfo, 'feed-loading');
    mode = 'fail';
    await page.reload();
    await expect(page.getByText('Pengumuman gagal dimuat.')).toBeVisible({ timeout: 20_000 });
    await strictGates(page, testInfo, 'feed-error');
    // Never a sign-out.
    await expect(page).toHaveURL(/\/pengumuman$/);
    mode = 'ok';
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
  });

  test('an empty feed', async ({ page, api }, testInfo) => {
    api.on('GET /api/info', { infos: [] });
    await page.goto('/pengumuman');
    await expect(page.getByText('Tidak ada yang ditampilkan')).toBeVisible();
    await expectUnread(page, 0);
    await strictGates(page, testInfo, 'feed-empty');
  });

  test('more than 10 posts: the next page loads at the end, with Muat lagi', async ({ page, db, api }, testInfo) => {
    const base = db.infos[6];
    db.infos = Array.from({ length: 23 }, (_, i) => ({
      ...base,
      id: `x${i}`,
      title: `Pengumuman uji ${i + 1}`,
      createdAt: new Date(Date.parse(base.createdAt) - i * 60e3).toISOString(),
      isRead: true,
    }));
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'x0')).toBeVisible();
    const more = page.getByRole('button', { name: 'Muat lagi' });
    await more.scrollIntoViewIfNeeded();
    await expect(postInList(page, testInfo, 'x10')).toBeAttached();
    await expect.poll(() => api.calls('GET /api/info').some((c) => c.query.includes('offset=10'))).toBe(true);
    await page.locator(isDesk(testInfo) ? '[data-post-row="x19"]' : '[data-post-link="x19"]').scrollIntoViewIfNeeded();
    await expect(postInList(page, testInfo, 'x22')).toBeAttached();
    await expect(more).toHaveCount(0);
  });

  test('offline: the banner over the first page kept from before', async ({ page, api }, testInfo) => {
    await page.goto('/pengumuman');
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await api.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.getByRole('status').filter({ hasText: /^Offline · diperbarui \d\d\.\d\d$/ })).toBeVisible();
    await expect(postInList(page, testInfo, 'p1')).toBeVisible();
    await strictGates(page, testInfo, 'feed-offline');
    await api.setOffline(false);
  });
});

test.describe('share', () => {
  test('Web Share gets the title and the post’s address @phone-only', async ({ page, api, baseURL }) => {
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.addInitScript(() => {
      (window as unknown as { shared: unknown[] }).shared = [];
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: unknown) => {
          (window as unknown as { shared: unknown[] }).shared.push(data);
          return Promise.resolve();
        },
      });
    });
    const shared = () => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared);
    await page.goto('/pengumuman');
    await card(page, P1).getByRole('button', { name: 'Bagikan' }).click();
    await expect.poll(shared).toEqual([{ title: P1, url: `${baseURL}/pengumuman/p1` }]);
    // A post without a title, from the top bar of its page.
    await page.goto('/pengumuman/p4');
    await page.getByRole('banner').getByRole('button', { name: 'Bagikan' }).click();
    await expect.poll(shared).toEqual([{ title: 'Pengumuman dari Dimas Aditya', url: `${baseURL}/pengumuman/p4` }]);
  });

  test('without Web Share the link is copied @phone-only', async ({ page, context }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    });
    await page.goto('/pengumuman');
    await card(page, P7).getByRole('button', { name: 'Bagikan' }).click();
    await expect(toastText(page, 'Tautan pengumuman disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/pengumuman\/p7$/);
    expect(layoutOf(testInfo)).not.toBe('desktop');
  });

  test('desktop: the post has its menu in the byline and no share button @desktop-only', async ({ page }) => {
    await page.goto('/pengumuman');
    await expect(detail(page).getByRole('button', { name: `Opsi untuk ${P1}` })).toBeVisible();
    await expect(detail(page).getByRole('button', { name: 'Bagikan' })).toHaveCount(0);
  });
});
