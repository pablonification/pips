import { checkGates } from '../support/audit';
import { pageText, visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Settings shows Nadia’s profile', async ({ page }, testInfo) => {
  await page.goto('/settings');
  await expect(
    page.getByRole('heading', { name: 'Nadia Putri' }).locator('visible=true'),
  ).toBeVisible();
  await expect.poll(() => pageText(page)).toMatch(/NIM ?13525045/);
  await expect
    .poll(() => pageText(page))
    .toMatch(/Jenis Keanggotaan ?Anggota Biasa/);
  await expect.poll(() => pageText(page)).toMatch(/Angkatan ?IF'2025/);
  await expect(
    page.getByRole('button', { name: 'Log out' }).locator('visible=true'),
  ).toBeVisible();
  await checkGates(page, testInfo, 'settings');
});

test('Set Courses lists this semester’s courses and SKS', async ({
  page,
}, testInfo) => {
  await page.goto('/settings');
  await page
    .getByRole('link', { name: 'Set Courses' })
    .locator('visible=true')
    .click();
  await expect(
    page.getByRole('heading', { name: 'Your Courses' }).locator('visible=true'),
  ).toBeVisible();
  await expect(visibleText(page, 'Algoritma dan Pemrograman II')).toBeVisible();
  await expect.poll(() => pageText(page)).toMatch(/Jumlah SKS ?18/);
  await checkGates(page, testInfo, 'courses');
});

test('adding a course searches the catalogue', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/settings/courses/add');
  await expect(
    page.getByRole('heading', { name: 'Add Courses' }).locator('visible=true'),
  ).toBeVisible();
  await page
    .getByPlaceholder('Search...')
    .locator('visible=true')
    .fill('Strategi');
  await expect(visibleText(page, 'Strategi Algoritma')).toBeVisible();
  expect(api.calls('GET /api/course').length).toBeGreaterThan(0);
  await checkGates(page, testInfo, 'courses-add');
});

test('notification switches, with required categories locked', async ({
  page,
}, testInfo) => {
  await page.goto('/settings/subscriptions');
  await expect(
    page.getByRole('heading', { name: 'Notification' }).locator('visible=true'),
  ).toBeVisible();
  const switches = page.getByRole('switch').locator('visible=true');
  await expect(switches).toHaveCount(6);
  await expect(switches.nth(1)).toBeDisabled(); // Himpunan is required
  await expect(switches.nth(0)).toBeEnabled();
  await checkGates(page, testInfo, 'notifications');
});

test('credits', async ({ page }) => {
  await page.goto('/settings/credits');
  await expect(
    visibleText(page, 'PIPS! dibuat dan dirawat oleh HMIF ITB.'),
  ).toBeVisible();
});
