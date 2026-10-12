import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Testi Matkul by browsing: program, semester, course, testimonials', async ({
  page,
}, testInfo) => {
  await page.goto('/home/testimoni');
  await page
    .getByRole('link', { name: 'Teknik Informatika' })
    .locator('visible=true')
    .click();
  await page
    .getByRole('link', { name: 'Semester 3' })
    .locator('visible=true')
    .click();
  await expect(
    page.getByRole('link', { name: 'Sistem Operasi' }).locator('visible=true'),
  ).toBeVisible();
  // STI courses aren't in the IF list.
  await expect(
    page.getByRole('link', { name: 'Matematika Diskret' }),
  ).toHaveCount(0);
  await page
    .getByRole('link', { name: 'Algoritma dan Pemrograman II' })
    .locator('visible=true')
    .click();
  await expect(
    page
      .getByRole('heading', { name: 'IF2110 Algoritma dan Pemrograman II' })
      .locator('visible=true'),
  ).toBeVisible();
  await expect(visibleText(page, /Lanjutan Dasar Pemrograman/)).toBeVisible();
  await checkGates(page, testInfo, 'testi-course');
  await page
    .getByRole('button', { name: '2', exact: true })
    .locator('visible=true')
    .click();
  await expect(
    visibleText(page, /Konsep list berkait dan pohon/),
  ).toBeVisible();
});

test('Testi Matkul by searching a course code', async ({ page }) => {
  await page.goto('/home/testimoni/teknik-informatika/3');
  await page
    .getByPlaceholder('Search...')
    .locator('visible=true')
    .fill('IF2130');
  await expect(
    page.getByRole('link', { name: 'Sistem Operasi' }).locator('visible=true'),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Algoritma dan Pemrograman II' }),
  ).toHaveCount(0);
});

test('NIM Finder finds members by name and by NIM', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/home/nim-finder');
  const box = page
    .getByPlaceholder('Ketik nama atau NIM')
    .locator('visible=true');
  await box.fill('Rak');
  await expect(visibleText(page, 'Raka Pratama')).toBeVisible();
  await expect(visibleText(page, 'Rakai Prasetyo')).toBeVisible();
  await checkGates(page, testInfo, 'nim-finder');
  await box.fill('18225012');
  await expect(visibleText(page, 'Tasya Amelia')).toBeVisible();
  expect(
    api
      .calls('GET /api/user/nim')
      .some((c) => c.query.includes('search=18225012')),
  ).toBe(true);
});
