import { checkGates } from '../support/audit';
import { greeting, pageText, visibleText } from '../support/app';
import { expect, test } from '../support/test';

test.use({ persona: 'pengurus' });

test('the Admin hub lists what Raka manages', async ({ page }, testInfo) => {
  // Beranda's Kelola section (P1-A; today's Home had an Admin tile) leads to the hub.
  await page.goto('/');
  await page
    .getByRole('main')
    .getByRole('heading', { name: 'Kelola', exact: true })
    .locator('xpath=../..')
    .getByRole('link', { name: /^Semua/ })
    .click();
  await expect(page).toHaveURL(/\/kelola$/);
  await expect(
    page.getByRole('link', { name: /Live Counting & Rekap Form/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Data SPARTA Magang/ }),
  ).toBeVisible();
  await checkGates(page, testInfo, 'admin');
});

test('Live Counting shows the count, the latest submitters and a live update', async ({
  page,
  api,
  db,
}, testInfo) => {
  await page.goto('/kelola/live');
  await page.getByRole('link', { name: /Form Analisis Kondisi PIXEL/ }).click();
  await expect(page).toHaveURL(/\/kelola\/live\/pixel$/);
  await expect(visibleText(page, '142')).toBeVisible();
  await expect
    .poll(() => pageText(page))
    .toMatch(/13525103 ?(Nama )?Farah Nabila/);
  await expect(visibleText(page, 'Halaman 1 dari 8')).toBeVisible();
  await checkGates(page, testInfo, 'live-counting');

  await expect
    .poll(() =>
      [...api.socket.sessions.values()].some(
        (s) => s.connected && s.auth.formAdminId === 'pixel',
      ),
    )
    .toBe(true);
  // The API saves a new response, then tells the admin room about it.
  db.adminResponses.pixel.unshift({
    id: 'resp-new',
    userId: 'user-13525150',
    nim: '13525150',
    fullName: 'Pengisi Baru',
    major: 'IF',
    angkatan: 2025,
    answers: [],
    submittedAt: '2026-10-08T06:36:00.000Z',
  });
  api.socket.emit('form:new-response', {
    total: 143,
    nim: '13525150',
    fullName: 'Pengisi Baru',
    submittedAt: '2026-10-08T06:36:00.000Z',
  });
  await expect(visibleText(page, '143')).toBeVisible();
});

test('the SPARTA Magang admin table and a submission', async ({
  page,
}, testInfo) => {
  await page.goto('/kelola');
  await page.getByRole('link', { name: /Data SPARTA Magang/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Data Pilihan Magang SPARTA' }),
  ).toBeVisible();
  await expect.poll(() => pageText(page)).toMatch(/Bima Santoso.*13525071/);
  await expect
    .poll(() => pageText(page))
    .toMatch(/Nadia Putri.*13525045.*Draft/);
  await checkGates(page, testInfo, 'sparta-table');
  await page
    .locator('a[href="/kelola/sparta/sub-13525071"]')
    .locator('visible=true')
    .click();
  await expect(
    page.getByRole('heading', { name: 'Bima Santoso' }),
  ).toBeVisible();
  await expect(visibleText(page, 'Prioritas 1: Akademik')).toBeVisible();
});

test.describe('Nadia, anggota', () => {
  test.use({ persona: 'anggota' });

  test('Nadia sees no Admin tile', async ({ page }) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(page.getByText('Admin', { exact: true })).toHaveCount(0);
  });
});
