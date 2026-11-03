/**
 * P3-B's proposals (OPEN-QUESTIONS D9: no locked design), captured in every layout and theme for the owner. Runs only
 * with E2E_PROPOSALS_DIR set (the fidelity report skips it), like P1-C's no-target spec:
 *
 *   E2E_PROPOSALS_DIR=../../../ops/redesign/proposals/P3-B pnpm exec playwright test -c e2e \
 *     e2e/fidelity/proposals-p3-b.spec.ts --project=fidelity-phone-light --project=fidelity-phone-dark \
 *     --project=fidelity-tablet-light --project=fidelity-tablet-dark --project=fidelity-desk-light \
 *     --project=fidelity-desk-dark
 *
 * Files: `<layout>-<proposal>-<theme>.png`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locator, Page } from '@playwright/test';
import { stableScreenshot } from '../support/capture';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const dir = process.env.E2E_PROPOSALS_DIR;
test.skip(!dir, 'Set E2E_PROPOSALS_DIR to capture P3-B’s proposals.');
test.use({ platform: 'Linux x86_64' });

async function shot(page: Page, name: string, ready: Locator) {
  await expect(ready).toBeVisible({ timeout: 15_000 });
  const [, layout, theme] = /^fidelity-(\w+)-(\w+)$/.exec(
    test.info().project.name,
  )!;
  mkdirSync(dir!, { recursive: true });
  writeFileSync(
    path.join(dir!, `${layout}-${name}-${theme}.png`),
    await stableScreenshot(page),
  );
}

const main = (page: Page) => page.getByRole('main');
const desk = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024;
const detail = (page: Page) =>
  desk(page)
    ? page.getByRole('region', { name: 'Acara hari terpilih' })
    : page.getByRole('dialog', { name: 'Detail acara' });

test.describe('ring1 only', () => {
  test.use({ roles: { only: ['ring1'] } });
  test('Tambah acara Himpunan', async ({ page }) => {
    await page.goto('/kalender?tambah=acara');
    await shot(
      page,
      'acara-himpunan',
      page
        .getByRole('dialog', { name: 'Tambah acara Himpunan' })
        .getByLabel('Judul', { exact: true }),
    );
  });
});

test.describe('akademik and ring1', () => {
  test.use({ persona: 'pengurus', roles: ['ring1'] });
  test('the Seg, on Akademik and on Himpunan', async ({ page }) => {
    await page.goto('/kalender?tambah=acara');
    const d = page.getByRole('dialog', { name: 'Tambah acara Akademik' });
    await shot(page, 'acara-seg-akademik', d.getByLabel('Mata kuliah'));
    await d.getByRole('radio', { name: 'Himpunan' }).check();
    await shot(
      page,
      'acara-seg-himpunan',
      page.getByRole('dialog', { name: 'Tambah acara Himpunan' }),
    );
  });
});

test.describe('Raka', () => {
  test.use({ persona: 'pengurus' });

  test('the event options, Ubah acara and Hapus acara', async ({ page }) => {
    const open = async () => {
      await page.goto('/kalender?hari=2026-10-08&acara=b1');
      await detail(page)
        .getByRole('button', { name: 'Opsi acara Kuis 1' })
        .click();
    };
    await open();
    await shot(page, 'acara-opsi', page.getByRole('menu'));
    await page.getByRole('menuitem', { name: 'Ubah acara' }).click();
    await shot(
      page,
      'acara-ubah',
      page
        .getByRole('dialog', { name: 'Ubah acara' })
        .getByLabel('Judul', { exact: true }),
    );
    await open();
    await page.getByRole('menuitem', { name: 'Hapus acara' }).click();
    await shot(
      page,
      'acara-hapus',
      page.getByRole('alertdialog', { name: 'Hapus acara ini?' }),
    );
  });

  test('Tambah testimoni, IF and STI', async ({ page }) => {
    const tambah = () =>
      page
        .getByRole('button', { name: 'Tambah testimoni' })
        .locator('visible=true')
        .click();
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110');
    await tambah();
    const d = page.getByRole('dialog', { name: 'Tambah testimoni' });
    await shot(page, 'testi-if', d.getByLabel('Overview', { exact: true }));
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await shot(
      page,
      'testi-if-galat',
      d.getByText('Tulis minimal satu bagian.'),
    );
    await page.goto(
      '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110',
    );
    await tambah();
    await shot(page, 'testi-sti', d.getByLabel('Kesan', { exact: true }));
  });

  test('the course page with Tambah testimoni', async ({ page }) => {
    await page.goto('/layanan/testi/teknik-informatika/3/course-IF2110');
    await shot(
      page,
      'testi-course',
      page
        .getByRole('button', { name: 'Tambah testimoni' })
        .locator('visible=true'),
    );
  });
});

test.describe('cnc', () => {
  test.use({ roles: ['cnc'] });

  test('Info Lomba with Tambah lomba and the card options', async ({
    page,
  }) => {
    await page.goto('/layanan/lomba');
    await shot(
      page,
      'lomba',
      main(page).getByRole('button', { name: 'Opsi untuk Gemastik XIX' }),
    );
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await shot(page, 'lomba-opsi', page.getByRole('menu'));
  });

  test('Tambah lomba, empty and with every error', async ({ page }) => {
    await page.goto('/layanan/lomba');
    await page
      .getByRole('button', { name: 'Tambah lomba' })
      .locator('visible=true')
      .click();
    const d = page.getByRole('dialog', { name: 'Tambah lomba' });
    await shot(
      page,
      'lomba-tambah',
      d.getByRole('checkbox', { name: 'UI/UX' }),
    );
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await shot(
      page,
      'lomba-tambah-galat',
      d.getByText('Isi tanggal dan jamnya.'),
    );
  });

  test('Ubah lomba and Hapus lomba', async ({ page }) => {
    const opsi = async (item: string) => {
      await page.goto('/layanan/lomba');
      await main(page)
        .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
        .click();
      await page.getByRole('menuitem', { name: item }).click();
    };
    await opsi('Ubah lomba');
    await shot(
      page,
      'lomba-ubah',
      page.getByRole('dialog', { name: 'Ubah lomba' }).getByLabel('Nama lomba'),
    );
    await opsi('Hapus lomba');
    await shot(
      page,
      'lomba-hapus',
      page.getByRole('alertdialog', { name: 'Hapus lomba ini?' }),
    );
  });
  // The poster field (owner's decision, 2026-11-03): uploaded, failed, and Ubah lomba's stored poster.
  test('the poster in Tambah lomba and Ubah lomba', async ({ page, api }) => {
    api.on('POST /api/media/upload', writes.presign);
    const file = {
      name: 'poster-hology-8.svg',
      mimeType: 'image/svg+xml',
      buffer: readFileSync(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          '../fixtures/posters/hology-uiux.svg',
        ),
      ),
    };
    const field = (d: Locator) => d.getByRole('group', { name: /^Poster/ });
    const into = async (d: Locator) => {
      await field(d).scrollIntoViewIfNeeded();
      return field(d);
    };
    await page.goto('/layanan/lomba');
    await page
      .getByRole('button', { name: 'Tambah lomba' })
      .locator('visible=true')
      .click();
    const d = page.getByRole('dialog', { name: 'Tambah lomba' });
    await d.getByLabel('Nama lomba').fill('Hology 8');
    await shot(
      page,
      'lomba-tambah-poster-kosong',
      (await into(d)).getByText('Tambah poster'),
    );
    await d.locator('input[type="file"]').setInputFiles(file);
    await shot(
      page,
      'lomba-tambah-poster',
      (await into(d)).locator('[data-poster="done"]'),
    );
    api.uploads.failNext = 1;
    await d.locator('input[type="file"]').setInputFiles(file);
    await shot(
      page,
      'lomba-tambah-poster-gagal',
      (await into(d)).getByRole('alert'),
    );

    await page.goto('/layanan/lomba');
    await main(page)
      .getByRole('button', { name: 'Opsi untuk Gemastik XIX' })
      .click();
    await page.getByRole('menuitem', { name: 'Ubah lomba' }).click();
    const u = page.getByRole('dialog', { name: 'Ubah lomba' });
    await shot(
      page,
      'lomba-ubah-poster',
      (await into(u)).getByRole('img', { name: 'Poster' }),
    );
  });
});
