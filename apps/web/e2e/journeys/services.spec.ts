import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Ding Dong lists this semester’s course folders', async ({
  page,
}, testInfo) => {
  await page.goto('/layanan/dingdong');
  // The phone layout heads the list with the semester; desktop has only the page title.
  await expect(
    page
      .getByRole('heading', { name: 'Dingdong' })
      .locator('visible=true')
      .first(),
  ).toBeVisible();
  const folder = page
    .getByRole('link', { name: 'Folder IF2110 Algoritma dan Pemrograman II' })
    .locator('visible=true');
  await expect(folder).toHaveAttribute(
    'href',
    'https://drive.google.com/drive/folders/e2e-IF2110',
  );
  await expect(
    page.getByRole('link', { name: /^Folder IF/ }).locator('visible=true'),
  ).toHaveCount(6);
  await checkGates(page, testInfo, 'dingdong');
});

test('Info Lomba lists open competitions', async ({ page }, testInfo) => {
  await page.goto('/layanan/lomba');
  await expect(
    page
      .getByRole('heading', { name: 'COMPFEST 18: Capture The Flag' })
      .locator('visible=true'),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Gemastik XIX' }).locator('visible=true'),
  ).toBeVisible();
  await expect(visibleText(page, 'Rp 150.000')).toBeVisible();
  await expect(visibleText(page, 'FREE')).toBeVisible();
  await checkGates(page, testInfo, 'competition');
});

// The external services (https, a new tab, named "situs luar, tab baru") are checked in layanan.spec.ts, which
// replaced today's same-tab, plain-http assertion here (P1-C).
