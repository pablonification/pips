/**
 * P3-B: managing Info Lomba for `cnc` (proposals): Tambah lomba with each validation error, its request and the new
 * card in deadline order; Ubah lomba without `mediaUrls`; Hapus lomba cancelled and confirmed. Nadia and Raka see
 * none of it (FEATURES.md gap 3). Phone, tablet and desktop, light and dark, with strict gates.
 */
import type { Page } from '@playwright/test';
import {
  dialog,
  expectStillSignedIn,
  expectTitleFocused,
  failWith,
  FAILURES,
  slow,
  toastText,
} from '../support/manage';
import { expectLit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
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
    await expect.poll(() => names(page)).toHaveLength(4);
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
    // The gates resize the window; across 1024 px Tambah lomba moves between the top bar and the desktop head, which
    // closes the dialog it opened. Open it again.
    if (!(await d.isVisible())) await tambahLomba(page).click();

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
});

test.describe('without cnc', () => {
  test('Nadia: no Tambah lomba and no options', async ({ page }) => {
    await page.goto('/layanan/lomba');
    await expect.poll(() => names(page)).toHaveLength(4);
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
      await expect.poll(() => names(page)).toHaveLength(4);
      await expect(
        page.getByRole('button', { name: 'Tambah lomba' }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: /^Opsi untuk / }),
      ).toHaveCount(0);
    });
  });
});
