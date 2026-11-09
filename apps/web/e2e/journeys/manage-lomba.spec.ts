/**
 * P3-B: managing Info Lomba for `cnc` (proposals): Tambah lomba with each validation error, its request and the new
 * card in deadline order; Ubah lomba without `mediaUrls`; Hapus lomba cancelled and confirmed. Nadia and Raka see
 * none of it (FEATURES.md gap 3). The poster (owner's decision, 2026-11-03): added, replaced and removed, a failed
 * upload, and the keyboard. Phone, tablet and desktop, light and dark, with strict gates.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import {
  dialog,
  expectStillSignedIn,
  FAILED,
  expectTitleFocused,
  failWith,
  FAILURES,
  slow,
  toastText,
} from '../support/manage';
import { expectLit, expectVisibleFocus, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import { reply } from '../support/mock';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const names = (page: Page) =>
  main(page).getByRole('heading', { level: 2 }).allTextContents();
const tambahLomba = (page: Page) =>
  page.getByRole('button', { name: 'Tambah lomba' }).locator('visible=true');
const add = (page: Page) => dialog(page, 'Tambah lomba');
const posts = (api: { calls: (s: string) => unknown[] }) =>
  api.calls('POST /api/competitions');

async function fillHology(page: Page, price = '') {
  const d = add(page);
  await d.getByLabel('Nama lomba').fill('Hology 8');
  await d.getByLabel('Penyelenggara').fill('Universitas Brawijaya');
  await d.getByRole('checkbox', { name: 'UI/UX' }).click();
  await d.getByLabel('Tanggal pendaftaran ditutup').fill('2026-10-10');
  await d.getByLabel(/^Biaya/).fill(price);
  await d.getByLabel('Tautan pendaftaran').fill('hology.ub.ac.id/daftar');
  await d.getByLabel('Tautan sumber').fill('https://instagram.com/hology');
}

test.describe('cnc', () => {
  test.use({ roles: ['cnc'] });

  test('Tambah lomba: every error, then the request with a free fee and https://, and the card by its deadline', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/competitions', writes.createCompetition);
    await page.goto('/layanan/lomba');
    await expect.poll(() => names(page)).toHaveLength(6);
    await expectLit(page, testInfo, 'Layanan');
    await tambahLomba(page).click();
    const d = add(page);
    await expect(d).toBeVisible();
    await expect(d.getByLabel('Nama lomba')).toBeFocused();
    // The defaults: opening today at 00.00, closing at 23.59 on a day still to choose.
    await expect(d.getByLabel('Tanggal pendaftaran dibuka')).toHaveValue(
      '2026-10-08',
    );
    await expect(d.getByLabel('Jam pendaftaran dibuka')).toHaveValue('00:00');
    await expect(d.getByLabel('Tanggal pendaftaran ditutup')).toHaveValue('');
    await expect(d.getByLabel('Jam pendaftaran ditutup')).toHaveValue('23:59');
    await expect(d.getByText('Kosongkan kalau gratis.')).toBeVisible();

    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d.getByText('Tulis minimal 3 huruf.')).toHaveCount(2);
    await expect(d.getByText('Isi tanggal dan jamnya.')).toBeVisible();
    await expect(
      d.getByText('Tulis tautan yang lengkap, misalnya https://….'),
    ).toHaveCount(2);
    await expect(d.getByLabel('Nama lomba')).toBeFocused();
    expect(posts(api)).toHaveLength(0);
    await strictGates(page, testInfo, 'tambah-lomba-errors', null);
    // The gates resize the window across 1024 px, where Tambah lomba moves between the top bar and the desktop head:
    // the dialog stays open (review m3).
    await expect(d).toBeVisible();

    await fillHology(page);
    // The deadline before the opening, then already past.
    await d.getByLabel('Tanggal pendaftaran dibuka').fill('2026-10-12');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(
      d.getByText('Penutupan harus setelah pembukaan.'),
    ).toBeVisible();
    await d.getByLabel('Tanggal pendaftaran dibuka').fill('2026-10-01');
    await d.getByLabel('Tanggal pendaftaran ditutup').fill('2026-10-07');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(
      d.getByText('Pendaftaran yang sudah tutup tidak akan tampil.'),
    ).toBeVisible();
    expect(posts(api)).toHaveLength(0);

    await d.getByLabel('Tanggal pendaftaran ditutup').fill('2026-10-10');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect(posts(api).map((c) => (c as { body: unknown }).body)).toEqual([
      {
        name: 'Hology 8',
        organizer: 'Universitas Brawijaya',
        categories: ['UI/UX'],
        registrationStart: '2026-09-30T17:00:00.000Z',
        registrationDeadline: '2026-10-10T16:59:00.000Z',
        price: null,
        registrationUrl: 'https://hology.ub.ac.id/daftar',
        sourceUrl: 'https://instagram.com/hology',
      },
    ]);
    await expect(toastText(page, 'Lomba ditambahkan.')).toBeVisible();
    // Closing Sabtu 10 Oktober, it's the soonest deadline: first.
    await expect.poll(async () => (await names(page))[0]).toBe('Hology 8');
    await expectTitleFocused(page);
  });

  test('a fee of 150000 is sent as "150000"', async ({ page, api }) => {
    api.on('POST /api/competitions', writes.createCompetition);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    await fillHology(page, '150000');
    await add(page).getByRole('button', { name: 'Tambahkan' }).click();
    await expect(add(page)).toBeHidden();
    expect(
      posts(api).map((c) => (c as { body: { price: unknown } }).body.price),
    ).toEqual(['150000']);
    await expect(main(page).getByText('Rp150.000')).toHaveCount(2);
  });

  for (const { status, says } of FAILURES)
    test(`a ${status}: the dialog stays with what was typed, the error toast, still signed in`, async ({
      page,
      api,
    }) => {
      api.on('POST /api/competitions', failWith(status));
      await page.goto('/layanan/lomba');
      await tambahLomba(page).click();
      await fillHology(page);
      await add(page).getByRole('button', { name: 'Tambahkan' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(add(page)).toBeVisible();
      await expect(add(page).getByLabel('Nama lomba')).toHaveValue('Hology 8');
      await expectStillSignedIn(page);
    });

  test('a slow request: Tambahkan is busy and sends once', async ({
    page,
    api,
  }) => {
    api.on('POST /api/competitions', slow(writes.createCompetition));
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    await fillHology(page);
    const button = add(page).getByRole('button', { name: 'Tambahkan' });
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    await expect(add(page)).toBeHidden();
    expect(posts(api)).toHaveLength(1);
  });

  test('Batal: no request, focus back on Tambah lomba', async ({
    page,
    api,
  }) => {
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    await add(page).getByRole('button', { name: 'Batal' }).click();
    await expect(add(page)).toBeHidden();
    await expect(tambahLomba(page)).toBeFocused();
    expect(posts(api)).toHaveLength(0);
  });

  test('Ubah lomba: filled from the card, only what changed sent, never mediaUrls', async ({
    page,
    api,
  }, testInfo) => {
    api.on('PUT /api/competitions/:id', writes.updateCompetition);
    await page.goto('/layanan/lomba');
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await page.getByRole('menuitem', { name: 'Ubah lomba' }).click();
    const d = dialog(page, 'Ubah lomba');
    await expect(d).toBeVisible();
    await expect(d.getByLabel('Nama lomba')).toHaveValue('Gemastik XIX');
    await strictGates(page, testInfo, 'ubah-lomba', null);
    await d.getByLabel('Penyelenggara').fill('Puspresnas Kemdiktisaintek');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    const [put] = api.calls('PUT /api/competitions/:id');
    expect(put.body).toEqual({ organizer: 'Puspresnas Kemdiktisaintek' });
    await expect(toastText(page, 'Lomba diperbarui.')).toBeVisible();
    await expect(
      main(page).getByText('Puspresnas Kemdiktisaintek'),
    ).toBeVisible();
    await expectTitleFocused(page);
  });

  test('Hapus lomba: Batal sends nothing; Hapus removes the card', async ({
    page,
    api,
  }, testInfo) => {
    api.on('DELETE /api/competitions/:competitionId', writes.deleteCompetition);
    await page.goto('/layanan/lomba');
    const opsi = main(page).getByRole('button', {
      name: 'Opsi untuk Gemastik XIX',
    });
    await opsi.click();
    await page.getByRole('menuitem', { name: 'Hapus lomba' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Hapus lomba ini?' });
    await expect(
      confirm.getByText(
        'Gemastik XIX hilang dari Info Lomba untuk semua anggota. Ini tidak bisa diurungkan.',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'hapus-lomba', null);
    await confirm.getByRole('button', { name: 'Batal' }).click();
    await expect(confirm).toBeHidden();
    expect(api.calls('DELETE /api/competitions/:competitionId')).toHaveLength(
      0,
    );
    await opsi.click();
    await page.getByRole('menuitem', { name: 'Hapus lomba' }).click();
    await confirm.getByRole('button', { name: 'Hapus' }).click();
    await expect(confirm).toBeHidden();
    await expect(toastText(page, 'Lomba dihapus.')).toBeVisible();
    await expect.poll(() => names(page)).not.toContain('Gemastik XIX');
    await expectTitleFocused(page);
  });

  const openOpsi = async (page: Page, item: string) => {
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await page.getByRole('menuitem', { name: item }).click();
  };
  const hapusConfirm = (page: Page) =>
    page.getByRole('alertdialog', { name: 'Hapus lomba ini?' });

  test('regression (review M1): Ubah lomba with nothing changed sends nothing and closes, with no error', async ({
    page,
    api,
  }) => {
    api.on('PUT /api/competitions/:id', writes.updateCompetition);
    await page.goto('/layanan/lomba');
    await openOpsi(page, 'Ubah lomba');
    const d = dialog(page, 'Ubah lomba');
    await expect(d.getByLabel('Nama lomba')).toHaveValue('Gemastik XIX');
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    expect(api.calls('PUT /api/competitions/:id')).toHaveLength(0);
    await expect(toastText(page, FAILED.gagal)).toHaveCount(0);
    await expect(toastText(page, 'Lomba diperbarui.')).toHaveCount(0);
    // As Batal: focus back on the card's options button.
    await expect(
      main(page).getByRole('button', { name: 'Opsi untuk Gemastik XIX' }),
    ).toBeFocused();
  });

  test('regression (review m9): in the options menu, Ubah lomba lines up with Hapus lomba', async ({
    page,
  }) => {
    await page.goto('/layanan/lomba');
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    const x = async (name: string) =>
      (await page
        .getByRole('menuitem', { name })
        .getByText(name, { exact: true })
        .boundingBox())!.x;
    expect(
      Math.abs((await x('Ubah lomba')) - (await x('Hapus lomba'))),
    ).toBeLessThan(1);
  });

  test('regression (review m4): Hapus lomba while its request runs: Hapus is busy and deletes once', async ({
    page,
    api,
  }) => {
    api.on(
      'DELETE /api/competitions/:competitionId',
      slow(writes.deleteCompetition),
    );
    await page.goto('/layanan/lomba');
    await openOpsi(page, 'Hapus lomba');
    const button = hapusConfirm(page).getByRole('button', { name: 'Hapus' });
    await button.click();
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    await expect(hapusConfirm(page)).toBeHidden();
    await expect(toastText(page, 'Lomba dihapus.')).toBeVisible();
    expect(api.calls('DELETE /api/competitions/:competitionId')).toHaveLength(
      1,
    );
  });

  for (const { status, says } of FAILURES)
    test(`Hapus lomba answered ${status}: the confirmation stays, the error toast, the card stays, still signed in`, async ({
      page,
      api,
    }) => {
      api.on('DELETE /api/competitions/:competitionId', failWith(status));
      await page.goto('/layanan/lomba');
      await openOpsi(page, 'Hapus lomba');
      await hapusConfirm(page).getByRole('button', { name: 'Hapus' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(hapusConfirm(page)).toBeVisible();
      await expect(
        hapusConfirm(page).getByRole('button', { name: 'Hapus' }),
      ).not.toHaveAttribute('aria-disabled', 'true');
      // Behind the confirmation the page is hidden from assistive tech: close it, then look.
      await hapusConfirm(page).getByRole('button', { name: 'Batal' }).click();
      await expect(hapusConfirm(page)).toBeHidden();
      expect(await names(page)).toContain('Gemastik XIX');
      await expectStillSignedIn(page);
    });

  test('regression (review m3): resizing across 1024 px (a tablet turned) keeps Tambah lomba open with what was typed', async ({
    page,
  }) => {
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    await add(page).getByLabel('Nama lomba').fill('Hology 8');
    await add(page).getByRole('checkbox', { name: 'UI/UX' }).click();
    const size = page.viewportSize()!;
    await page.setViewportSize(
      size.width >= 1024
        ? { width: 834, height: 1112 }
        : { width: 1194, height: 834 },
    );
    await expect(add(page)).toBeVisible();
    await expect(add(page).getByLabel('Nama lomba')).toHaveValue('Hology 8');
    await page.setViewportSize(size);
    await expect(add(page)).toBeVisible();
    await expect(add(page).getByLabel('Nama lomba')).toHaveValue('Hology 8');
    await expect(
      add(page).getByRole('checkbox', { name: 'UI/UX' }),
    ).toBeChecked();
  });

  test('cnc taken away mid-session: Tambahkan is refused, nobody is signed out, and the actions go', async ({
    page,
    api,
    db,
  }) => {
    api.on('POST /api/competitions', writes.createCompetition);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    await fillHology(page);
    const checks = api.calls('GET /api/me').length;
    // An admin takes the role away; the next write answers 401 (roleMiddleware).
    db.me!.roles = db.me!.roles.filter((r) => r !== 'cnc');
    await add(page).getByRole('button', { name: 'Tambahkan' }).click();
    await expect(toastText(page, FAILED.tanpaAkses)).toBeVisible();
    await expect
      .poll(() => api.calls('GET /api/me').length)
      .toBeGreaterThan(checks);
    await expect(
      page.getByRole('button', { name: 'Tambah lomba' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Opsi untuk / }),
    ).toHaveCount(0);
    await expectStillSignedIn(page);
  });
});

/** A poster to pick: Garis v5's sample Hology poster, as a PNG image from the device (an SVG is never uploaded). */
const POSTER_FILE = {
  name: 'poster-hology-8.png',
  mimeType: 'image/png',
  buffer: readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../fixtures/posters/hology-uiux.png',
    ),
  ),
};
/** The uploaded poster's address (writes.presign: the name and its extension, the type swapped for .svg). */
const UPLOADED = /^\/__e2e__\/media\/upload-\d+-poster-hology-8\.svg$/;
const posterGroup = (d: Locator) => d.getByRole('group', { name: /^Poster/ });
const fileInput = (d: Locator) => d.locator('input[type="file"]');
const cardPoster = (page: Page, name: string) =>
  main(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) })
    .locator('.g-poster');

test.describe('cnc: the poster', () => {
  test.use({ roles: ['cnc'] });

  test('Tambah lomba with a poster: it uploads with its progress, Tambahkan waits, the POST carries its address, and Info Lomba shows it', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/competitions', writes.createCompetition)
      .on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await fillHology(page);
    const poster = posterGroup(d);
    await expect(poster.getByText('Tambah poster')).toBeVisible();
    await expect(
      poster.getByRole('button', { name: 'Hapus poster' }),
    ).toHaveCount(0);

    api.uploads.delayMs = 1500;
    await fileInput(d).setInputFiles(POSTER_FILE);
    await expect(
      poster.getByRole('status').filter({ hasText: /^Mengunggah/ }),
    ).toBeVisible();
    await expect(
      d.getByText('Tunggu posternya selesai diunggah.'),
    ).toBeVisible();
    const tambahkan = d.getByRole('button', { name: 'Tambahkan' });
    await expect(tambahkan).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for an aria-disabled button to be enabled; force presses it while it is blocked.
    await tambahkan.click({ force: true });
    await expect(d).toBeVisible();
    expect(posts(api)).toHaveLength(0);

    await expect(d.locator('[data-poster="done"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(d.getByText('Tunggu posternya selesai diunggah.')).toHaveCount(
      0,
    );
    await expect(tambahkan).not.toHaveAttribute('aria-disabled', 'true');
    await expect(poster.getByText('Ganti poster')).toBeVisible();
    await expect(poster.getByRole('img', { name: 'Poster' })).toBeVisible();
    expect(api.calls('POST /api/media/upload').map((r) => r.body)).toEqual([
      {
        fileName: 'poster-hology-8',
        fileType: 'png',
        fileSize: POSTER_FILE.buffer.length,
      },
    ]);
    await strictGates(page, testInfo, 'tambah-lomba-poster', null);

    await tambahkan.click();
    await expect(d).toBeHidden();
    const [post] = posts(api) as { body: Record<string, unknown> }[];
    expect(post.body).toEqual({
      name: 'Hology 8',
      organizer: 'Universitas Brawijaya',
      categories: ['UI/UX'],
      registrationStart: '2026-10-07T17:00:00.000Z',
      registrationDeadline: '2026-10-10T16:59:00.000Z',
      price: null,
      registrationUrl: 'https://hology.ub.ac.id/daftar',
      sourceUrl: 'https://instagram.com/hology',
      mediaUrls: [expect.stringMatching(UPLOADED)],
    });
    await expect(toastText(page, 'Lomba ditambahkan.')).toBeVisible();
    // Info Lomba shows the uploaded poster on the new card, not the plain panel.
    const shown = cardPoster(page, 'Hology 8');
    await expect(shown).toHaveRole('button');
    await expect(shown.getByRole('img')).toHaveAttribute(
      'src',
      (post.body.mediaUrls as string[])[0],
    );
    await expect
      .poll(() =>
        shown
          .getByRole('img')
          .evaluate((i) => (i as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  });

  test('Ubah lomba: the stored poster shows; Ganti poster replaces it and sends only mediaUrls', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('PUT /api/competitions/:id', writes.updateCompetition)
      .on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    const before = await cardPoster(page, 'Gemastik XIX')
      .getByRole('img')
      .getAttribute('src');
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await page.getByRole('menuitem', { name: 'Ubah lomba' }).click();
    const d = dialog(page, 'Ubah lomba');
    const poster = posterGroup(d);
    await expect(poster.getByRole('img', { name: 'Poster' })).toHaveAttribute(
      'src',
      before!,
    );
    await expect(poster.getByText('Ganti poster')).toBeVisible();
    await expect(
      poster.getByRole('button', { name: 'Hapus poster' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'ubah-lomba-poster', null);

    await fileInput(d).setInputFiles(POSTER_FILE);
    await expect(d.locator('[data-poster="done"]')).toBeVisible({
      timeout: 10_000,
    });
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    const [put] = api.calls('PUT /api/competitions/:id');
    expect(put.body).toEqual({ mediaUrls: [expect.stringMatching(UPLOADED)] });
    await expect(toastText(page, 'Lomba diperbarui.')).toBeVisible();
    await expect(
      cardPoster(page, 'Gemastik XIX').getByRole('img'),
    ).toHaveAttribute('src', UPLOADED);
  });

  test('Ubah lomba: Hapus poster removes it, sends mediaUrls [] and the card shows the plain panel', async ({
    page,
    api,
  }) => {
    api.on('PUT /api/competitions/:id', writes.updateCompetition);
    await page.goto('/layanan/lomba');
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await page.getByRole('menuitem', { name: 'Ubah lomba' }).click();
    const d = dialog(page, 'Ubah lomba');
    const poster = posterGroup(d);
    await poster.getByRole('button', { name: 'Hapus poster' }).click();
    await expect(poster.getByRole('img')).toHaveCount(0);
    // Focus moves to the tile that adds one again.
    await expect(d.getByLabel('Tambah poster')).toBeFocused();
    await d.getByRole('button', { name: 'Simpan' }).click();
    await expect(d).toBeHidden();
    const [put] = api.calls('PUT /api/competitions/:id');
    expect(put.body).toEqual({ mediaUrls: [] });
    await expect(cardPoster(page, 'Gemastik XIX')).toHaveAttribute(
      'data-poster',
      'none',
    );
  });

  test('a failed upload says so on the poster, Tambahkan saves nothing, and Coba lagi uploads it', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/competitions', writes.createCompetition)
      .on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await fillHology(page);
    api.uploads.failNext = 1;
    await fileInput(d).setInputFiles(POSTER_FILE);
    const poster = posterGroup(d);
    const failed = poster.getByRole('alert');
    await expect(failed).toContainText('Gagal diunggah');
    // Icon, word and colour.
    await expect(failed.locator('svg').first()).toBeVisible();
    await expect(
      d.getByText('Posternya gagal diunggah. Coba lagi atau hapus posternya.'),
    ).toBeVisible();
    const tambahkan = d.getByRole('button', { name: 'Tambahkan' });
    await expect(tambahkan).toHaveAttribute('aria-disabled', 'true');
    await tambahkan.click({ force: true });
    await expect(d).toBeVisible();
    expect(posts(api)).toHaveLength(0);
    await strictGates(page, testInfo, 'tambah-lomba-poster-gagal', null);

    await failed.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(d.locator('[data-poster="done"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      d.getByText('Posternya gagal diunggah. Coba lagi atau hapus posternya.'),
    ).toHaveCount(0);
    await tambahkan.click();
    await expect(d).toBeHidden();
    expect(posts(api)).toHaveLength(1);
    expect(
      (posts(api)[0] as { body: { mediaUrls: string[] } }).body.mediaUrls,
    ).toEqual([expect.stringMatching(UPLOADED)]);
    // Two addresses asked for: the failed upload's and the retry's.
    expect(api.calls('POST /api/media/upload')).toHaveLength(2);
  });

  test('a failed upload removed with Hapus poster: Tambahkan saves without a poster', async ({
    page,
    api,
  }) => {
    api
      .on('POST /api/competitions', writes.createCompetition)
      .on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await fillHology(page);
    api.uploads.failNext = 1;
    await fileInput(d).setInputFiles(POSTER_FILE);
    await expect(posterGroup(d).getByRole('alert')).toContainText(
      'Gagal diunggah',
    );
    await posterGroup(d).getByRole('button', { name: 'Hapus poster' }).click();
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect('mediaUrls' in (posts(api)[0] as { body: object }).body).toBe(false);
  });

  test('regression (review): a file the API would refuse is refused before anything is sent, and says why', async ({
    page,
    api,
  }, testInfo) => {
    api
      .on('POST /api/competitions', writes.createCompetition)
      .on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await fillHology(page);
    const poster = posterGroup(d);
    // The picker offers only what the API takes: images, JFIF too, never SVG.
    const accept = await fileInput(d).getAttribute('accept');
    expect(accept).toContain('.jfif');
    expect(accept).toContain('image/png');
    expect(accept).not.toContain('svg');
    expect(accept).not.toContain('.pdf');

    await fileInput(d).setInputFiles({
      name: 'poster.svg',
      mimeType: 'image/svg+xml',
      buffer: readFileSync(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          '../fixtures/posters/hology-uiux.svg',
        ),
      ),
    });
    const said = poster.getByRole('alert');
    await expect(said).toHaveText('Jenis file poster.svg tidak didukung.');
    // Icon, word and colour.
    await expect(said.locator('svg').first()).toBeVisible();
    await expect(poster.getByRole('img')).toHaveCount(0);
    await strictGates(page, testInfo, 'tambah-lomba-poster-jenis', null);

    await fileInput(d).setInputFiles({
      name: 'poster-besar.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
    });
    await expect(said).toHaveText(
      'File poster-besar.png terlalu besar (maks. 25 MB).',
    );
    await expect(poster.getByRole('img')).toHaveCount(0);
    expect(api.calls('POST /api/media/upload')).toHaveLength(0);

    // A file that can go: the message goes, and it uploads.
    await fileInput(d).setInputFiles(POSTER_FILE);
    await expect(d.locator('[data-poster="done"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(said).toHaveCount(0);
    expect(api.calls('POST /api/media/upload')).toHaveLength(1);
  });

  test("regression (review): the API's refusal is said as its reason, not as a failure to try again", async ({
    page,
    api,
  }) => {
    api
      .on('POST /api/competitions', writes.createCompetition)
      .on('POST /api/media/upload', () =>
        reply.status(400, { error: 'File type not allowed' }),
      );
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await fillHology(page);
    const poster = posterGroup(d);
    await fileInput(d).setInputFiles(POSTER_FILE);
    await expect(poster.getByRole('alert')).toHaveText(
      'Jenis file poster-hology-8.png tidak didukung.',
    );
    await expect(poster.getByText('Gagal diunggah')).toHaveCount(0);
    await expect(poster.getByRole('button', { name: 'Coba lagi' })).toHaveCount(
      0,
    );
    await expect(poster.getByRole('img')).toHaveCount(0);
    // Nothing is left uploading or failed, so Tambahkan saves without a poster.
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect('mediaUrls' in (posts(api)[0] as { body: object }).body).toBe(false);
  });

  test('keyboard: Tab reaches Tambah poster, which opens the file picker; then Hapus poster and Ganti poster', async ({
    page,
    api,
  }) => {
    api.on('POST /api/media/upload', writes.presign);
    await page.goto('/layanan/lomba');
    await tambahLomba(page).click();
    const d = add(page);
    await d.getByLabel('Tautan sumber').focus();
    await page.keyboard.press('Tab');
    await expect(d.getByLabel('Tambah poster')).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Space');
    await (await chooser).setFiles(POSTER_FILE);
    await expect(d.locator('[data-poster="done"]')).toBeVisible({
      timeout: 10_000,
    });
    await d.getByLabel('Tautan sumber').focus();
    await page.keyboard.press('Tab');
    await expect(d.getByRole('button', { name: 'Hapus poster' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(d.getByLabel('Ganti poster')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(d.getByRole('button', { name: 'Batal' })).toBeFocused();
    // Every stop shows its focus.
    await expectVisibleFocus(page);
  });
});

test.describe('without cnc', () => {
  test('Nadia: no Tambah lomba and no options', async ({ page }) => {
    await page.goto('/layanan/lomba');
    await expect.poll(() => names(page)).toHaveLength(6);
    await expect(
      page.getByRole('button', { name: 'Tambah lomba' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: /^Opsi untuk / }),
    ).toHaveCount(0);
  });

  test.describe('Raka', () => {
    test.use({ persona: 'pengurus' });
    test('no Tambah lomba and no options', async ({ page }) => {
      await page.goto('/layanan/lomba');
      await expect.poll(() => names(page)).toHaveLength(6);
      await expect(
        page.getByRole('button', { name: 'Tambah lomba' }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /^Opsi untuk / }),
      ).toHaveCount(0);
    });
  });
});
