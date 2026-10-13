/**
 * Buat pengumuman (P1-B): a focused page on phones and tablets, a dialog over the split on desktop; validation with
 * the prototype's messages, the notification line, photos uploading with progress, the exact request body, and the
 * new post on top, read and focused. Strict gates at every step.
 */
import type { Page, TestInfo } from '@playwright/test';
import { reply } from '../support/mock';
import {
  expectFocused,
  isDesk,
  strictGates,
  toastText,
} from '../support/pengumuman';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
  'base64',
);
const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PNG });

/** The composer: the dialog on desktop, the page's main otherwise. */
const composer = (page: Page, t: TestInfo) =>
  isDesk(t)
    ? page.getByRole('dialog', { name: 'Buat pengumuman' })
    : page.getByRole('main');

async function openComposer(page: Page, t: TestInfo) {
  await page.goto('/pengumuman');
  await page.getByRole('link', { name: 'Buat pengumuman' }).click();
  await expect(page).toHaveURL(/\/pengumuman\/tulis$/);
  const c = composer(page, t);
  await expect(c.getByRole('textbox', { name: /^Judul/ })).toBeFocused();
  return c;
}

test.describe('Nadia', () => {
  test('a focused page (dialog on desktop), Umum only, errors, the notification line, photos, the exact body', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/info', writes.createInfo)
      .on('POST /api/info/:infoId/read', writes.markRead)
      .on('POST /api/media/upload', writes.presign);
    const c = await openComposer(page, testInfo);
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    if (isDesk(testInfo)) {
      // The sidebar stays; the split is behind the dialog.
      await expect(nav).toBeVisible();
      await expect(page.locator('.g-split')).toBeAttached();
    } else {
      // A focused flow: no tab bar or rail, back in the top bar.
      await expect(nav).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /^Kembali ke / }),
      ).toBeVisible();
    }
    await strictGates(page, testInfo, 'compose');

    // Nadia may post in Umum only, and has no groups.
    const cats = c.getByRole('group', { name: 'Kategori' });
    await expect(cats.getByRole('checkbox')).toHaveCount(1);
    await expect(cats.getByRole('checkbox', { name: 'Umum' })).toBeVisible();
    await expect(c.getByRole('radio')).toHaveCount(2);
    await expect(c.getByRole('radio', { name: 'Grup-ku' })).toHaveCount(0);

    // An empty submit: content and category errors, focus on the content.
    await c.getByRole('button', { name: 'Umumkan' }).click();
    const body = c.getByRole('textbox', { name: 'Isi pengumuman' });
    await expect(c.getByText('Isi pengumuman belum ditulis.')).toBeVisible();
    await expect(c.getByText('Pilih minimal satu kategori.')).toBeVisible();
    await expect(body).toBeFocused();
    await expect(body).toHaveAttribute('aria-invalid', 'true');
    await expect(body).toHaveAccessibleDescription(
      'Isi pengumuman belum ditulis.',
    );
    expect(api.calls('POST /api/info')).toHaveLength(0);
    await strictGates(page, testInfo, 'compose-errors');

    await c
      .getByRole('textbox', { name: /^Judul/ })
      .fill('  Nebeng ke Jatinangor  ');
    await body.fill(
      'Ada yang mau bareng ke Jatinangor Sabtu pagi? Berangkat dari Ganesha 06.30.',
    );
    await expect(c.getByText('Isi pengumuman belum ditulis.')).toHaveCount(0);
    await expect(c.getByText('0/100')).toHaveCount(0);
    await expect(c.getByText('24/100')).toBeVisible();
    await cats.getByRole('checkbox', { name: 'Umum' }).click();
    await expect(c.getByText('Pilih minimal satu kategori.')).toHaveCount(0);
    await expect(
      c.getByText(
        'Notifikasi dikirim ke semua anggota, kecuali yang mematikan kategori Umum.',
      ),
    ).toBeVisible();

    // Angkatan with none chosen: the audience error.
    await c.getByText('Angkatan', { exact: true }).click();
    await expect(
      c.getByText(
        'Notifikasi dikirim ke angkatan yang kamu pilih, kecuali yang mematikan kategori Umum. Pengumuman ini hanya terlihat oleh mereka.',
      ),
    ).toBeVisible();
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect(
      c.getByText('Pilih minimal satu angkatan, atau ganti ke Semua.'),
    ).toBeVisible();
    await expect(c.getByRole('radio', { name: 'Angkatan' })).toBeFocused();
    const years = c.getByRole('group', { name: 'Pilih angkatan' });
    await expect(
      years.getByRole('checkbox', { name: '2025 · PIXEL' }),
    ).toBeVisible();
    await expect(
      years.getByRole('checkbox', { name: '2023', exact: true }),
    ).toBeVisible();
    await years.getByRole('checkbox', { name: '2025 · PIXEL' }).click();
    await expect(
      c.getByText('Pilih minimal satu angkatan, atau ganti ke Semua.'),
    ).toHaveCount(0);
    await expect(
      c.getByText(/^Notifikasi dikirim ke angkatan 2025, kecuali/),
    ).toBeVisible();

    // Photos: the first two upload slowly, one fails.
    api.uploads.delayMs = 1200;
    await c
      .locator('input[type="file"]')
      .setInputFiles([photo('a.png'), photo('b.png')]);
    await expect(
      c
        .getByRole('status')
        .filter({ hasText: /^Mengunggah/ })
        .first(),
    ).toBeVisible();
    await expect(c.getByText('Tunggu fotonya selesai diunggah.')).toBeVisible();
    await expect(c.getByRole('button', { name: 'Umumkan' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await c.getByRole('button', { name: 'Umumkan' }).click();
    expect(api.calls('POST /api/info')).toHaveLength(0);
    await expect(c.locator('[data-photo="done"]')).toHaveCount(2, {
      timeout: 10_000,
    });
    api.uploads.delayMs = 0;
    api.uploads.failNext = 1;
    await c.locator('input[type="file"]').setInputFiles([photo('c.png')]);
    await expect(c.getByText('Gagal diunggah')).toBeVisible();
    await expect(
      c.getByText(
        'Ada foto yang gagal diunggah. Coba lagi atau hapus fotonya.',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'compose-photo-failed');
    await c
      .locator('[data-photo="failed"]')
      .getByRole('button', { name: 'Coba lagi' })
      .click();
    await expect(c.locator('[data-photo="done"]')).toHaveCount(3);
    // Each upload asked for its own address just before sending.
    expect(api.calls('POST /api/media/upload').map((r) => r.body)).toEqual([
      { fileName: 'a.png', fileType: 'image/png' },
      { fileName: 'b.png', fileType: 'image/png' },
      { fileName: 'c.png', fileType: 'image/png' },
      { fileName: 'c.png', fileType: 'image/png' },
    ]);
    await c.getByRole('button', { name: 'Hapus foto 2' }).click();
    await expect(c.locator('[data-photo]')).toHaveCount(2);

    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect.poll(() => api.calls('POST /api/info').length).toBe(1);
    const sent = api.calls('POST /api/info')[0].body as { mediaUrls: string[] };
    expect(sent).toEqual({
      title: 'Nebeng ke Jatinangor',
      content:
        'Ada yang mau bareng ke Jatinangor Sabtu pagi? Berangkat dari Ganesha 06.30.',
      forCategories: ['umum'],
      forAngkatan: ['angkatan-2025'],
      mediaUrls: [
        expect.stringMatching(/upload-\d+-a\.svg$/),
        expect.stringMatching(/upload-\d+-c\.svg$/),
      ],
    });
    // Read for its author: the API doesn't mark it.
    await expect
      .poll(() =>
        api.calls('POST /api/info/e2e-info-7/read').map((r) => r.body),
      )
      .toEqual([{ unread: false }]);
    await expect(
      toastText(page, 'Diumumkan. Notifikasi sedang dikirim.'),
    ).toBeVisible();

    if (isDesk(testInfo)) {
      await expect(
        page.getByRole('dialog', { name: 'Buat pengumuman' }),
      ).toHaveCount(0);
      await expect(page).toHaveURL(/\/pengumuman\/e2e-info-7$/);
      const row = page.locator('[data-post-row="e2e-info-7"]');
      await expect(row).toHaveAttribute('aria-current', 'true');
      await expectFocused(row);
    } else {
      await expect(page).toHaveURL(/\/pengumuman$/);
      const first = page.locator('[data-post-link]').first();
      await expect(first).toHaveAttribute('data-post-link', 'e2e-info-7');
      await expectFocused(first);
      await expect(
        page.getByRole('navigation', { name: 'Navigasi utama' }),
      ).toBeVisible();
    }
  });

  test('Batal and Escape leave the composer; the next one starts fresh', async ({
    page,
  }, testInfo) => {
    const c = await openComposer(page, testInfo);
    await c
      .getByRole('textbox', { name: 'Isi pengumuman' })
      .fill('Draf yang ditinggal');
    if (isDesk(testInfo)) await page.keyboard.press('Escape');
    else await c.getByRole('button', { name: 'Batal' }).click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    const again = await openComposer(page, testInfo);
    await expect(
      again.getByRole('textbox', { name: 'Isi pengumuman' }),
    ).toHaveValue('');
  });

  test('a post that fails to send keeps everything, with Coba lagi', async ({
    page,
    api,
  }, testInfo) => {
    let fail = true;
    api
      .on('POST /api/info', (req) =>
        fail ? reply.status(500) : writes.createInfo(req),
      )
      .on('POST /api/info/:infoId/read', writes.markRead);
    const c = await openComposer(page, testInfo);
    await c
      .getByRole('textbox', { name: 'Isi pengumuman' })
      .fill('Kuis 2 dimajukan.');
    await c
      .getByRole('group', { name: 'Kategori' })
      .getByRole('checkbox', { name: 'Umum' })
      .click();
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect(
      page.getByText('Pengumuman belum terkirim. Semua isianmu masih ada.'),
    ).toBeVisible();
    await expect(
      c.getByRole('textbox', { name: 'Isi pengumuman' }),
    ).toHaveValue('Kuis 2 dimajukan.');
    fail = false;
    await page
      .locator('.g-toast-region')
      .getByRole('button', { name: 'Coba lagi' })
      .click();
    await expect.poll(() => api.calls('POST /api/info').length).toBe(2);
    await expect(
      toastText(page, 'Diumumkan. Notifikasi sedang dikirim.'),
    ).toBeVisible();
  });

  test('the share target prefills Judul, Isi and Foto', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/media/upload', writes.presign);
    await page.goto('/pengumuman');
    await page.evaluate(
      async (bytes) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('SharedContentDB', 1);
          req.onupgradeneeded = () =>
            req.result.createObjectStore('sharedContent', { keyPath: 'id' });
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const tx = req.result.transaction('sharedContent', 'readwrite');
            tx.objectStore('sharedContent').put({
              id: 'shared',
              title: 'Lowongan asisten',
              text: 'Lab Programming butuh asisten.',
              url: 'https://example.org/lowongan',
              images: [
                {
                  name: 'poster.png',
                  type: 'image/png',
                  data: new Uint8Array(bytes).buffer,
                },
              ],
            });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
          };
        }),
      [...PNG],
    );
    const c = await openComposer(page, testInfo);
    await expect(c.getByRole('textbox', { name: /^Judul/ })).toHaveValue(
      'Lowongan asisten',
    );
    await expect(
      c.getByRole('textbox', { name: 'Isi pengumuman' }),
    ).toHaveValue(
      'Lab Programming butuh asisten.\nhttps://example.org/lowongan',
    );
    await expect(c.locator('[data-photo="done"]')).toHaveCount(1);
    expect(api.calls('POST /api/media/upload')[0].body).toEqual({
      fileName: 'poster.png',
      fileType: 'image/png',
    });
  });
});

test.describe('Raka', () => {
  test.use({ persona: 'pengurus' });

  test('Grup-ku lists his four groups and sends roles as forGroups', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/info', writes.createInfo)
      .on('POST /api/info/:infoId/read', writes.markRead);
    const c = await openComposer(page, testInfo);
    await c
      .getByRole('textbox', { name: 'Isi pengumuman' })
      .fill('Rapat Akademik dimajukan ke 18.30.');
    await c
      .getByRole('group', { name: 'Kategori' })
      .getByRole('checkbox', { name: 'Himpunan' })
      .click();
    await c.getByText('Grup-ku', { exact: true }).click();
    const groups = c.getByRole('group', { name: 'Pilih grup' });
    await expect(groups.getByRole('checkbox')).toHaveText([
      'Welfare and Academics',
      'Akademik',
      'DE',
      'Admin',
    ]);
    await groups.getByRole('checkbox', { name: 'Akademik' }).click();
    await expect(
      c.getByText(
        'Notifikasi dikirim ke grup Akademik, kecuali yang mematikan kategori Himpunan. Pengumuman ini hanya terlihat oleh mereka.',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'compose-groups');
    await c.getByRole('button', { name: 'Umumkan' }).click();
    await expect.poll(() => api.calls('POST /api/info').length).toBe(1);
    expect(api.calls('POST /api/info')[0].body).toEqual({
      title: '',
      content: 'Rapat Akademik dimajukan ke 18.30.',
      forCategories: ['himpunan'],
      forGroups: ['akademik'],
    });
  });
});
