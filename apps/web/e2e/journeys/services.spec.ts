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

test('external services keep their s.hmif.dev links, now over https in a new tab', async ({
  page,
}, testInfo) => {
  // Regression (P1-A rule 15): today's Home opened Mading Beasiswa and Bayar Kas! in the same tab, two over plain
  // http. Beranda's tiles (phones and tablets) and Pintasan (desktop) open them over https in a new tab.
  await page.goto('/');
  const desk = testInfo.project.name.startsWith('desktop');
  const links = desk
    ? [['Bayar Kas! (situs luar)', 'https://s.hmif.dev/BayarKasHMIF']]
    : [
        ['Beasiswa (situs luar)', 'https://s.hmif.dev/MadingBeasiswa'],
        ['Bayar Kas! (situs luar)', 'https://s.hmif.dev/BayarKasHMIF'],
      ];
  for (const [name, href] of links) {
    const link = page.getByRole('main').getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }
});
