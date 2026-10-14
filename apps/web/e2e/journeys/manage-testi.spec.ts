/**
 * P3-B: Tambah testimoni on a Testi Matkul course page, for `akademik` (a proposal): IF sections on IF2110, STI
 * sections on II2110, "Tulis minimal satu bagian.", the request, the new testimonial in the pager and the course
 * list's count up by one. Not for `admin` alone, nor for members. Phone, tablet and desktop, light and dark, with
 * strict gates.
 */
import type { Page } from '@playwright/test';
import {
  dialog,
  expectStillSignedIn,
  expectTitleFocused,
  failWith,
  FAILURES,
  toastText,
} from '../support/manage';
import { expectLit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const IF2110 = '/layanan/testi/teknik-informatika/3/course-IF2110';
const II2110 = '/layanan/testi/sistem-dan-teknologi-informasi/3/course-II2110';
const main = (page: Page) => page.getByRole('main');
const tambah = (page: Page) =>
  page
    .getByRole('button', { name: 'Tambah testimoni' })
    .locator('visible=true');
const add = (page: Page) => dialog(page, 'Tambah testimoni');
const article = (page: Page, ke: number, jumlah: number) =>
  main(page).getByRole('article', { name: `Testimoni ${ke} dari ${jumlah}` });
const posts = (api: { calls: (s: string) => unknown[] }) =>
  api.calls('POST /api/testimoni');

test.describe('Raka (akademik)', () => {
  test.use({ persona: 'pengurus' });

  test('IF2110: the IF sections, the empty error, then the request, the new one in the pager', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/testimoni', writes.createTestimonial);
    await page.goto(IF2110);
    await expect(article(page, 1, 3)).toBeVisible();
    await expectLit(page, testInfo, 'Layanan');
    await tambah(page).click();
    const d = add(page);
    await expect(d).toBeVisible();
    await expect(
      d.getByText('IF2110 Algoritma dan Pemrograman II'),
    ).toBeVisible();
    await expect(d.getByLabel(/^Nama penulis/)).toBeFocused();
    await expect(d.getByText('Kosongkan untuk Anonim.')).toBeVisible();
    for (const name of ['Overview', 'Tugas', 'Review Dosen'])
      await expect(d.getByLabel(name, { exact: true })).toBeVisible();
    await expect(d.getByLabel('Kesan', { exact: true })).toHaveCount(0);

    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d.getByText('Tulis minimal satu bagian.')).toBeVisible();
    await expect(d.getByLabel('Overview', { exact: true })).toBeFocused();
    expect(posts(api)).toHaveLength(0);
    await strictGates(page, testInfo, 'tambah-testi-error', null);

    await d.getByLabel('Tugas', { exact: true }).fill('Tubes tiap dua minggu.');
    await d.getByLabel(/^Dosen/).fill('Dr. Rina');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect(posts(api).map((c) => (c as { body: unknown }).body)).toEqual([
      {
        courseId: 'course-IF2110',
        userName: null,
        overview: null,
        assignments: 'Tubes tiap dua minggu.',
        lecturer_review: null,
        lecturer: 'Dr. Rina',
      },
    ]);
    await expect(toastText(page, 'Testimoni ditambahkan.')).toBeVisible();
    // The new one, fourth of four, by Anonim.
    const fourth = article(page, 4, 4);
    await expect(fourth).toBeVisible();
    await expect(fourth.getByText('Tubes tiap dua minggu.')).toBeVisible();
    await expect(fourth.getByText('Anonim')).toBeVisible();
    await expectTitleFocused(page);

    // The course list counts it.
    await page.goto('/layanan/testi/teknik-informatika/3');
    await expect(
      main(page)
        .getByRole('link', { name: /IF2110/ })
        .getByText('4 testimoni'),
    ).toBeVisible();
  });

  test('II2110: the STI sections, with an author', async ({
    page,
    api,
  }, testInfo) => {
    api.on('POST /api/testimoni', writes.createTestimonial);
    await page.goto(II2110);
    await tambah(page).click();
    const d = add(page);
    for (const name of ['Kesan', 'Tantangan', 'Saran'])
      await expect(d.getByLabel(name, { exact: true })).toBeVisible();
    await expect(d.getByLabel('Overview', { exact: true })).toHaveCount(0);
    await strictGates(page, testInfo, 'tambah-testi-sti', null);
    await d.getByLabel(/^Nama penulis/).fill('Rani, STI 2024');
    await d
      .getByLabel('Saran', { exact: true })
      .fill('Latihan soal tiap pekan.');
    await d.getByRole('button', { name: 'Tambahkan' }).click();
    await expect(d).toBeHidden();
    expect(posts(api).map((c) => (c as { body: unknown }).body)).toEqual([
      {
        courseId: 'course-II2110',
        userName: 'Rani, STI 2024',
        impressions: null,
        challenges: null,
        advice: 'Latihan soal tiap pekan.',
        lecturer: null,
      },
    ]);
    await expect(article(page, 3, 3)).toBeVisible();
  });

  for (const { status, says } of FAILURES)
    test(`a ${status}: the dialog stays with what was typed, the error toast, still signed in`, async ({
      page,
      api,
    }) => {
      api.on('POST /api/testimoni', failWith(status));
      await page.goto(IF2110);
      await tambah(page).click();
      await add(page).getByLabel('Overview', { exact: true }).fill('Seru.');
      await add(page).getByRole('button', { name: 'Tambahkan' }).click();
      await expect(toastText(page, says)).toBeVisible();
      await expect(add(page)).toBeVisible();
      await expect(
        add(page).getByLabel('Overview', { exact: true }),
      ).toHaveValue('Seru.');
      await expectStillSignedIn(page);
    });

  test('Batal: no request, focus back on Tambah testimoni', async ({
    page,
    api,
  }) => {
    await page.goto(IF2110);
    await tambah(page).click();
    await add(page).getByRole('button', { name: 'Batal' }).click();
    await expect(add(page)).toBeHidden();
    await expect(tambah(page)).toBeFocused();
    expect(posts(api)).toHaveLength(0);
  });
});

test.describe('Raka (akademik), one Tambah testimoni', () => {
  test.use({ persona: 'pengurus' });
  test('regression (F2-003, F1-5): Tambah testimoni is in the page once, where the layout shows it', async ({
    page,
  }) => {
    await page.goto(IF2110);
    await expect(tambah(page)).toHaveCount(1);
    // Before the fix a second copy stayed in the page, hidden by CSS (the header row's on desktop, the desk head's
    // below 1024 px).
    await expect(
      page.locator('button', { hasText: 'Tambah testimoni' }),
    ).toHaveCount(1);
  });

  test('regression (F2-003): turning a tablet across 1024 px keeps Tambah testimoni open with what was typed', async ({
    page,
  }) => {
    await page.goto(IF2110);
    await tambah(page).click();
    const box = add(page).getByRole('textbox').first();
    await box.fill('Tetap di sini');
    const size = page.viewportSize()!;
    await page.setViewportSize(
      size.width >= 1024
        ? { width: 834, height: 1112 }
        : { width: 1280, height: 900 },
    );
    await expect(add(page)).toBeVisible();
    await expect(add(page).getByRole('textbox').first()).toHaveValue(
      'Tetap di sini',
    );
    await page.setViewportSize(size);
    await expect(add(page).getByRole('textbox').first()).toHaveValue(
      'Tetap di sini',
    );
  });
});

test.describe('admin only', () => {
  test.use({ persona: 'pengurus', roles: { only: ['admin'] } });
  test('no Tambah testimoni (the API allows akademik alone)', async ({
    page,
  }) => {
    await page.goto(IF2110);
    await expect(article(page, 1, 3)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Tambah testimoni' }),
    ).toHaveCount(0);
  });
});

test('Nadia: no Tambah testimoni', async ({ page }) => {
  await page.goto(IF2110);
  await expect(article(page, 1, 3)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Tambah testimoni' }),
  ).toHaveCount(0);
});
