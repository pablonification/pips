/**
 * Pengumuman (P1-B; the share target with P0-B): pengumuman-unread, pengumuman-filter, pengumuman-react-comment,
 * pengumuman-missing, tulis-anggota, tulis-share, tulis-pengurus, pengumuman-own-post.
 */
import type { Page } from '@playwright/test';
import {
  P1,
  P2,
  P5,
  card,
  detail,
  expectUnread,
  menuButton,
  toastText,
} from '../../support/pengumuman';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';
import type { Layout } from '../flows';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
  'base64',
);
const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });
const backButton = (page: Page) => page.getByRole('button', { name: /^Kembali ke / });
const inList = (page: Page, layout: Layout, id: string) =>
  layout === 'desktop' ? page.locator(`[data-post-row="${id}"]`) : page.locator(`[data-post-link="${id}"]`);
const composer = (page: Page, layout: Layout) =>
  layout === 'desktop' ? page.getByRole('dialog', { name: 'Buat pengumuman' }) : page.getByRole('main');

flow('pengumuman-unread', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  await f.step('The feed: gold bars on the unread posts; 4 unread', async () => {
    await f.open('/pengumuman');
    await expect(page.getByRole('heading', { level: 1, name: 'Pengumuman' })).toBeVisible();
    await expect(inList(page, layout, 'p1')).toBeVisible();
    await expectUnread(page, 4);
    // p5 is for the akademik group: the server doesn't send it to Nadia; p3 (angkatan 2025) is hers.
    await expect(page.getByText(P5)).toHaveCount(0);
    await expect(inList(page, layout, 'p3')).toBeAttached();
    await f.gate('feed');
  });
  await f.step('Belum dibaca shows only them', async () => {
    await page.getByRole('button', { name: /^Belum dibaca/ }).click();
    await expect(page.getByRole('button', { name: /^Belum dibaca/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(inList(page, layout, 'p7')).toHaveCount(0);
    await f.gate('feed-unread');
    await f.hold();
    await page.getByRole('button', { name: /^Belum dibaca/ }).click();
    await expect(inList(page, layout, 'p7')).toBeVisible();
  });
  await f.step('Opening p1 marks it read: the badge drops to 3', async () => {
    await inList(page, layout, 'p1').click();
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(detail(page).getByRole('heading', { name: P1 })).toBeVisible();
    await expect.poll(() => api.calls('POST /api/info/p1/read').map((c) => c.body)).toEqual([{ unread: false }]);
    await expectUnread(page, 3);
    await f.gate('post');
    await f.hold();
  });
  if (layout !== 'desktop')
    await f.step('Back to the feed, at its card', async () => {
      await backButton(page).click();
      await expect(page).toHaveURL(/\/pengumuman$/);
      await expect(inList(page, layout, 'p1')).toBeFocused();
      await inList(page, layout, 'p1').click();
      await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    });
  await f.step('Its menu marks it unread again: the badge is back to 4', async () => {
    await menuButton(page, P1).click();
    await f.gate('post-menu');
    await page.getByRole('menuitem', { name: 'Tandai belum dibaca' }).click();
    await expect(toastText(page, 'Ditandai belum dibaca.')).toBeVisible();
    await expectUnread(page, 4);
    await f.hold();
  });
});

flow('pengumuman-filter', 'nadia', {}, async ({ page, f, layout }) => {
  const sheet = page.getByRole('dialog', { name: 'Kategori yang ditampilkan' });
  await f.step('Kategori: hide Akademik', async () => {
    await f.open('/pengumuman');
    await expect(inList(page, layout, 'p1')).toBeVisible();
    await page.getByRole('button', { name: /^Kategori/ }).click();
    await expect(sheet).toBeVisible();
    await f.gate('filter');
    const akademik = sheet.getByRole('switch', { name: 'Akademik' });
    await akademik.click();
    await expect(akademik).toHaveAttribute('aria-checked', 'false');
    await f.hold();
    await sheet.getByRole('button', { name: 'Selesai' }).click();
    await expect(inList(page, layout, 'p1')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kategori 1 disembunyikan' })).toBeVisible();
  });
  await f.step('Terlama: oldest first', async () => {
    await page.getByRole('button', { name: 'Urutan: terbaru dulu. Ganti urutan' }).click();
    await expect(page.getByRole('button', { name: 'Urutan: terlama dulu. Ganti urutan' })).toBeVisible();
    const first = layout === 'desktop' ? page.locator('[data-post-row]').first() : page.locator('[data-post-link]').first();
    await expect(first).toHaveAttribute(layout === 'desktop' ? 'data-post-row' : 'data-post-link', 'p7');
  });
  await f.step('Belum dibaca', async () => {
    await page.getByRole('button', { name: /^Belum dibaca/ }).click();
    await expect(inList(page, layout, 'p7')).toHaveCount(0);
    await expect(inList(page, layout, 'p2')).toBeVisible();
    await f.gate('feed-filtered');
  });
  await f.step('A reload keeps the view: it is in the link', async () => {
    await expect(page).toHaveURL(/excludeCategories=/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Kategori 1 disembunyikan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Belum dibaca/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Urutan: terlama dulu. Ganti urutan' })).toBeVisible();
    await f.hold();
  });
  await f.step('Search "gemastik" finds p2', async () => {
    await page.getByRole('button', { name: /^Kategori/ }).click();
    await sheet.getByRole('button', { name: 'Tampilkan semua' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    const search = page.getByRole('searchbox', { name: 'Cari pengumuman' });
    await f.type(search, 'gemastik');
    await expect(page).toHaveURL(/search=gemastik/);
    await expect(inList(page, layout, 'p2')).toBeVisible();
    await expect(inList(page, layout, 'p1')).toHaveCount(0);
    await f.hold();
  });
  await f.step('No result: "Tidak ada yang ditampilkan", then Tampilkan semua', async () => {
    const search = page.getByRole('searchbox', { name: 'Cari pengumuman' });
    await f.type(search, 'zzzz');
    await expect(page.getByText('Tidak ada yang ditampilkan')).toBeVisible();
    await expect(page.getByText('Tidak ada pengumuman yang cocok dengan “zzzz”.')).toBeVisible();
    await f.gate('feed-empty-search');
    await f.hold();
    await page.getByRole('button', { name: 'Tampilkan semua' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(inList(page, layout, 'p1')).toBeVisible();
  });
});

flow('pengumuman-react-comment', 'nadia', {}, async ({ page, f, api, layout }) => {
  const desk = layout === 'desktop';
  api
    .on('POST /api/info/:infoId/read', writes.markRead)
    .on('PUT /api/reaction', writes.react)
    .on('DELETE /api/reaction/info/:infoId', writes.unreact)
    .on('DELETE /api/reaction/comment/:commentId', writes.unreact)
    .on('POST /api/comment', writes.comment);
  if (!desk) {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined }),
    );
  }
  const picker = page.getByRole('group', { name: 'Pilih reaksi' });
  const opener = () =>
    desk
      ? detail(page).getByRole('button', { name: 'Beri reaksi', exact: true })
      : card(page, P1).getByRole('button', { name: '24 reaksi. Beri reaksi' });
  const changer = (n: string) =>
    desk
      ? detail(page).getByRole('button', { name: 'Ganti reaksi', exact: true })
      : card(page, P1).getByRole('button', { name: `Reaksimu ${n}. 25 reaksi. Ganti reaksi` });
  await f.step('A pixel reaction: Keren', async () => {
    await f.open('/pengumuman');
    await opener().click();
    await expect(picker).toBeVisible();
    await f.gate('picker');
    await f.hold();
    await picker.getByRole('button', { name: 'Keren' }).click();
    await expect.poll(() => api.calls('PUT /api/reaction').map((c) => c.body)).toEqual([{ infoId: 'p1', reaction: 'fire' }]);
    await expect(changer('Keren')).toBeVisible();
  });
  await f.step('Changed to Rayakan: still one per person', async () => {
    await changer('Keren').click();
    await picker.getByRole('button', { name: 'Rayakan' }).click();
    await expect.poll(() => api.calls('PUT /api/reaction').length).toBe(2);
    await expect(changer('Rayakan')).toBeVisible();
    await f.hold();
  });
  await f.step('Taken back', async () => {
    await changer('Rayakan').click();
    await picker.getByRole('button', { name: 'Rayakan' }).click();
    await expect.poll(() => api.calls('DELETE /api/reaction/info/p1').length).toBe(1);
    await expect(opener()).toBeVisible();
  });
  await f.step('The post: a reaction on Bima’s comment', async () => {
    if (!desk) await inList(page, layout, 'p1').click();
    await expect(detail(page).getByRole('heading', { name: P1 })).toBeVisible();
    const cmt = detail(page).getByRole('button', { name: 'Beri reaksi untuk komentar Bima Santoso' });
    await cmt.scrollIntoViewIfNeeded();
    await cmt.click();
    await picker.getByRole('button', { name: 'Senyum lebar' }).click();
    await expect(
      detail(page).getByRole('button', { name: 'Reaksimu Senyum lebar. Ganti untuk komentar Bima Santoso' }),
    ).toBeVisible();
    await f.hold();
  });
  await f.step('A comment', async () => {
    const field = page.getByRole('textbox', { name: 'Tulis komentar' });
    await f.type(field, 'Kak, IF2120 K02 di ruang mana?');
    await page.getByRole('button', { name: 'Kirim komentar' }).click();
    await expect(detail(page).getByText('Kak, IF2120 K02 di ruang mana?')).toBeVisible();
    await expect(toastText(page, 'Komentar terkirim.')).toBeVisible();
    await f.gate('post-commented');
    await f.hold();
  });
  await f.step('The link preview: the UTS schedule sheet', async () => {
    const preview = detail(page).locator('.g-lp').filter({ hasText: 'Jadwal UTS Ganjil 2026/2027' });
    await preview.scrollIntoViewIfNeeded();
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAttribute('target', '_blank');
    await f.hold();
  });
  await f.step('A Google Form opens inside PIPS! (p2)', async () => {
    await page.goto('/pengumuman/p2');
    await expect(detail(page).getByRole('heading', { name: P2 })).toBeVisible();
    const form = detail(page).getByRole('button', { name: /Google Form · bisa diisi di sini/ });
    await form.scrollIntoViewIfNeeded();
    await form.click();
    const dialog = page.getByRole('dialog', { name: 'Formulir Cari Tim Gemastik XIX' });
    await expect(dialog.locator('iframe')).toBeAttached();
    await expect(dialog.getByRole('link', { name: /Buka di tab baru/ })).toBeVisible();
    await f.hold();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
  await f.step(desk ? 'On desktop the post’s address is the page’s: no Bagikan' : 'Bagikan where the browser can’t share: the link is copied', async () => {
    if (desk) {
      await expect(detail(page).getByRole('button', { name: 'Bagikan' })).toHaveCount(0);
      return;
    }
    await page.getByRole('banner').getByRole('button', { name: 'Bagikan' }).click();
    await expect(toastText(page, 'Tautan pengumuman disalin.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/pengumuman\/p2$/);
    await f.hold();
  });
});

flow('pengumuman-missing', 'nadia', {}, async ({ page, f, layout }) => {
  await f.step('A link to a deleted announcement says so', async () => {
    await f.open('/pengumuman/hilang');
    await expect(page.getByRole('main').locator('p', { hasText: /^Pengumuman tidak ditemukan$/ })).toBeVisible();
    await expect(page.getByText('Pengumuman ini sudah dihapus, atau bukan untukmu.')).toBeVisible();
    await f.gate('not-found');
    await f.hold();
  });
  await f.step('Kembali ke Pengumuman', async () => {
    await page.getByRole('button', { name: 'Kembali ke Pengumuman' }).filter({ hasText: 'Kembali ke Pengumuman' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(inList(page, layout, 'p1')).toBeVisible();
    await f.hold();
  });
});

flow('tulis-anggota', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/info', writes.createInfo).on('POST /api/info/:infoId/read', writes.markRead);
  const c = composer(page, layout);
  await f.step('Buat pengumuman', async () => {
    await f.open('/pengumuman');
    await page.getByRole('link', { name: 'Buat pengumuman' }).click();
    await expect(page).toHaveURL(/\/pengumuman\/tulis$/);
    await expect(c.getByRole('textbox', { name: /^Judul/ })).toBeFocused();
    if (layout !== 'desktop')
      await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0);
    await f.gate('compose');
  });
  await f.step('Nadia may post only in Umum', async () => {
    const cats = c.getByRole('group', { name: 'Kategori' });
    await expect(cats.getByRole('checkbox')).toHaveCount(1);
    await expect(cats.getByRole('checkbox', { name: 'Umum' })).toBeVisible();
    await f.hold();
  });
  await f.step('Sent empty: the errors, focus on the first', async () => {
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect(c.getByText('Isi pengumuman belum ditulis.')).toBeVisible();
    await expect(c.getByText('Pilih minimal satu kategori.')).toBeVisible();
    await expect(c.getByRole('textbox', { name: 'Isi pengumuman' })).toBeFocused();
    expect(api.calls('POST /api/info')).toHaveLength(0);
    await f.gate('compose-errors');
    await f.hold();
  });
  await f.step('Written, Umum chosen; the notification line says who hears it', async () => {
    await f.type(c.getByRole('textbox', { name: /^Judul/ }), 'Nebeng ke Jatinangor');
    await f.type(
      c.getByRole('textbox', { name: 'Isi pengumuman' }),
      'Ada yang mau bareng ke Jatinangor Sabtu pagi? Berangkat dari Ganesha 06.30.',
    );
    await expect(c.getByText('20/100')).toBeVisible();
    await c.getByRole('group', { name: 'Kategori' }).getByRole('checkbox', { name: 'Umum' }).click();
    await expect(
      c.getByText('Notifikasi dikirim ke semua anggota, kecuali yang mematikan kategori Umum.'),
    ).toBeVisible();
    await f.hold();
  });
  await f.step('Umumkan: the post is on top', async () => {
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect.poll(() => api.calls('POST /api/info').length).toBe(1);
    await expect(toastText(page, 'Diumumkan. Notifikasi sedang dikirim.')).toBeVisible();
    if (layout === 'desktop') await expect(page.locator('[data-post-row="e2e-info-7"]')).toHaveAttribute('aria-current', 'page');
    else await expect(page.locator('[data-post-link]').first()).toHaveAttribute('data-post-link', 'e2e-info-7');
    await f.gate('feed-after-post');
    await f.hold();
  });
});

flow('tulis-share', 'nadia', {}, async ({ page, f, api, layout }) => {
  api.on('POST /api/media/upload', writes.presign);
  const c = composer(page, layout);
  await f.step('Another app shares text, a link and a photo to PIPS!', async () => {
    await f.open('/pengumuman');
    // What the service worker's share target stores (as compose.spec.ts seeds it).
    await page.evaluate(
      async (bytes) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('SharedContentDB', 1);
          req.onupgradeneeded = () => req.result.createObjectStore('sharedContent', { keyPath: 'id' });
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const tx = req.result.transaction('sharedContent', 'readwrite');
            tx.objectStore('sharedContent').put({
              id: 'shared',
              title: 'Lowongan asisten',
              text: 'Lab Programming butuh asisten.',
              url: 'https://example.org/lowongan',
              images: [{ name: 'poster.png', type: 'image/png', data: new Uint8Array(bytes).buffer }],
            });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
          };
        }),
      [...PNG],
    );
  });
  await f.step('The composer opens filled in', async () => {
    await page.goto('/pengumuman/tulis');
    await expect(c.getByRole('textbox', { name: /^Judul/ })).toHaveValue('Lowongan asisten');
    await expect(c.getByRole('textbox', { name: 'Isi pengumuman' })).toHaveValue(
      'Lab Programming butuh asisten.\nhttps://example.org/lowongan',
    );
    await expect(c.locator('[data-photo="done"]')).toHaveCount(1);
    await f.gate('compose-shared');
    await f.hold();
  });
});

flow('tulis-pengurus', 'raka', {}, async ({ page, f, api, layout }) => {
  api
    .on('POST /api/info', writes.createInfo)
    .on('POST /api/info/:infoId/read', writes.markRead)
    .on('POST /api/media/upload', writes.presign);
  const c = composer(page, layout);
  await f.step('Buat pengumuman: the categories Raka’s roles allow', async () => {
    await f.open('/pengumuman');
    await page.getByRole('link', { name: 'Buat pengumuman' }).click();
    await expect(c.getByRole('textbox', { name: /^Judul/ })).toBeFocused();
    await expect(c.getByRole('group', { name: 'Kategori' }).getByRole('checkbox')).toHaveText([
      'Akademik',
      'Himpunan',
      'Beasiswa',
      'Umum',
    ]);
    await f.gate('compose-raka');
  });
  await f.step('Written; Himpunan', async () => {
    await f.type(c.getByRole('textbox', { name: 'Isi pengumuman' }), 'Rapat Akademik dimajukan ke 18.30.');
    await c.getByRole('group', { name: 'Kategori' }).getByRole('checkbox', { name: 'Himpunan' }).click();
  });
  await f.step('Audience by angkatan: who will be notified', async () => {
    await c.getByText('Angkatan', { exact: true }).click();
    await c.getByRole('group', { name: 'Pilih angkatan' }).getByRole('checkbox', { name: '2025 · PIXEL' }).click();
    await expect(c.getByText(/^Notifikasi dikirim ke angkatan 2025, kecuali/)).toBeVisible();
    await f.hold();
  });
  await f.step('Audience by his groups: Akademik', async () => {
    await c.getByText('Grup-ku', { exact: true }).click();
    const groups = c.getByRole('group', { name: 'Pilih grup' });
    await expect(groups.getByRole('checkbox')).toHaveText(['Welfare and Academics', 'Akademik', 'DE', 'Admin']);
    await groups.getByRole('checkbox', { name: 'Akademik' }).click();
    await expect(
      c.getByText(
        'Notifikasi dikirim ke grup Akademik, kecuali yang mematikan kategori Himpunan. Pengumuman ini hanya terlihat oleh mereka.',
      ),
    ).toBeVisible();
    await f.gate('compose-groups');
    await f.hold();
  });
  await f.step('Only images are offered; two photos upload with progress', async () => {
    const input = c.locator('input[type="file"]');
    await expect(input).toHaveAttribute('accept', /^image\//);
    api.uploads.delayMs = 2000;
    await input.setInputFiles([photo('a.png'), photo('b.png')]);
    await expect(c.getByRole('status').filter({ hasText: /^Mengunggah/ }).first()).toBeVisible();
  });
  await f.step('Umumkan waits for them', async () => {
    await expect(c.getByText('Tunggu fotonya selesai diunggah.')).toBeVisible();
    await expect(c.getByRole('button', { name: 'Umumkan' })).toHaveAttribute('aria-disabled', 'true');
    await expect(c.locator('[data-photo="done"]')).toHaveCount(2, { timeout: 10_000 });
    await f.hold();
  });
  await f.step('Umumkan', async () => {
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect.poll(() => api.calls('POST /api/info').length).toBe(1);
    expect(api.calls('POST /api/info')[0].body).toMatchObject({
      forCategories: ['himpunan'],
      forGroups: ['akademik'],
    });
    await expect(toastText(page, 'Diumumkan. Notifikasi sedang dikirim.')).toBeVisible();
    await f.hold();
  });
});

flow('pengumuman-own-post', 'raka', {}, async ({ page, f, api }) => {
  api
    .on('POST /api/info/:infoId/read', writes.markRead)
    .on('POST /api/info/:infoId/renotify', writes.renotify)
    .on('DELETE /api/comment/:commentId', writes.deleteComment)
    .on('DELETE /api/info/:infoId', writes.deleteInfo);
  await f.step('His p1: Umumkan ulang is locked, "Bisa lagi mulai 15.30"', async () => {
    await f.open('/pengumuman/p1');
    await menuButton(page, P1).click();
    const locked = page.getByRole('menuitem', { name: /^Umumkan ulang/ });
    await expect(locked).toHaveAccessibleName('Umumkan ulang Bisa lagi mulai 15.30');
    await expect(locked).toHaveAttribute('aria-disabled', 'true');
    await f.gate('menu-own');
    await locked.click({ force: true });
    await expect(
      toastText(page, 'Umumkan ulang bisa lagi mulai 15.30. Jeda 3 jam supaya anggota tidak kebanjiran notifikasi.'),
    ).toBeVisible();
    expect(api.calls('POST /api/info/:infoId/renotify')).toHaveLength(0);
    await f.hold();
    await page.keyboard.press('Escape');
  });
  await f.step('His p5: Umumkan ulang sends, and the toast names the audience', async () => {
    await page.goto('/pengumuman/p5');
    await menuButton(page, P5).click();
    const open = page.getByRole('menuitem', { name: /^Umumkan ulang/ });
    await expect(open).toHaveAccessibleName('Umumkan ulang Kirim notifikasi lagi ke sasaran');
    await open.click();
    await expect.poll(() => api.calls('POST /api/info/p5/renotify').length).toBe(1);
    await expect(toastText(page, 'Diumumkan ulang. Notifikasi dikirim lagi ke grup Akademik.')).toBeVisible();
    await f.hold();
  });
  await f.step('Deleting a comment: the confirmation names it', async () => {
    await page.goto('/pengumuman/p1');
    const cmt = detail(page).locator('[data-comment="p1-c1"]');
    await cmt.scrollIntoViewIfNeeded();
    await cmt.getByRole('button', { name: 'Hapus' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus komentar ini?' });
    await expect(confirm.getByText('Komentar hilang untuk semua anggota.')).toBeVisible();
    await f.gate('confirm-comment');
    await f.hold();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/comment/p1-c1').length).toBe(1);
    await expect(detail(page).getByText('Kak, IF2123 K01 sama K02 ruangnya beda ya?')).toHaveCount(0);
  });
  await f.step('Deleting the post: the confirmation names it', async () => {
    await menuButton(page, P1).click();
    await page.getByRole('menuitem', { name: 'Hapus pengumuman' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus pengumuman ini?' });
    await expect(
      confirm.getByText(
        'Pengumuman, reaksi, dan komentarnya hilang untuk semua anggota. Ini tidak bisa diurungkan.',
      ),
    ).toBeVisible();
    await f.gate('confirm-post');
    await f.hold();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect.poll(() => api.calls('DELETE /api/info/p1').length).toBe(1);
    await expect(toastText(page, 'Pengumuman dihapus.')).toBeVisible();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await expect(page.locator('[data-post-row="p1"], [data-post-link="p1"]')).toHaveCount(0);
    await f.hold();
  });
});
