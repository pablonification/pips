import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Ding Dong lists this semester’s course folders', async ({
  page,
}, testInfo) => {
  await page.goto('/home/dingdong');
  await expect(visibleText(page, 'IF SEMESTER 3')).toBeVisible();
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
  await page.goto('/home/competition');
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

test('external services keep their s.hmif.dev links', async ({ page }) => {
  await page.goto('/home');
  // Stand in for the external site, so the test never leaves this machine.
  await page.route('http://s.hmif.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Mading Beasiswa</title>',
    }),
  );
  await page
    .getByRole('button', { name: 'Mading Beasiswa' })
    .locator('visible=true')
    .click();
  // Today's app opens it in the same tab, over plain http.
  await expect(page).toHaveURL('http://s.hmif.dev/MadingBeasiswa');
});
