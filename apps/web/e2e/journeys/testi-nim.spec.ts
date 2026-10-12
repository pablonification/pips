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
  const semesterUrl = page.url().replace(/\/[^/]+\/?$/, '');
  // Regression (T4): pages other than the current one have no background. Under tailwind-merge 3 their
  // 'bg-none!' class let the button's black background through.
  const pageTwo = page
    .getByRole('button', { name: '2', exact: true })
    .locator('visible=true');
  await expect(pageTwo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await pageTwo.click();
  await expect(
    visibleText(page, /Konsep list berkait dan pohon/),
  ).toBeVisible();
  // Back leads to the semester's courses (T4 spelled out the path that '..' led to).
  await page
    .getByRole('link', { name: 'Back' })
    .locator('visible=true')
    .click();
  await expect(page).toHaveURL(semesterUrl);
  await expect(
    page.getByRole('link', { name: 'Sistem Operasi' }).locator('visible=true'),
  ).toBeVisible();
});

test('Testi Matkul by searching a course code', async ({ page }) => {
  // Known bug in today's app: it lowercases the query, then compares it with upper-case course codes
  // (routes/_app/_left-navbar/home/testimoni/$type/$semester/index.tsx), so a code never matches.
  // Kept as an expected failure; when the redesign fixes search, remove this line.
  test.fail(true, 'today’s app cannot find a course by its code');
  await page.goto('/home/testimoni/teknik-informatika/3');
  await expect(
    page.getByRole('link', { name: 'Sistem Operasi' }).locator('visible=true'),
  ).toBeVisible();
  await page
    .getByPlaceholder('Search...')
    .locator('visible=true')
    .fill('IF2130');
  // First the filter applies (other courses leave), then the match must remain.
  await expect(
    page.getByRole('link', { name: 'Algoritma dan Pemrograman II' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Sistem Operasi' }).locator('visible=true'),
  ).toBeVisible({ timeout: 3_000 });
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
