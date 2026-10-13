import { checkGates } from '../support/audit';
import { greeting, isPhone, navLink, visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('Home greets Nadia and shows today and the services', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(greeting(page)).toBeVisible();
  // Today's time-of-day line lives in today's phone Home; on desktop it was in the old sidebar, which the shell
  // (P0-C) replaced with its own greeting above.
  if (isPhone(testInfo))
    await expect(visibleText(page, 'Good Afternoon')).toBeVisible();
  for (const service of [
    'Ding Dong',
    'Calendar',
    'NIM Finder',
    'Testi Matkul',
    'Info Lomba',
    'Curhat Yuk',
    'Mading Beasiswa',
    'Bayar Kas',
  ]) {
    await expect(
      page
        .getByRole('button', { name: service, exact: true })
        .locator('visible=true'),
    ).toBeVisible();
  }
  // Today's schedule: Himpunan events for everyone and Akademik events for Nadia's courses.
  await expect(
    visibleText(page, 'Sharing Session: Magang di Startup'),
  ).toBeVisible();
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  // Raka's Kuis 1 is for a course Nadia doesn't take.
  await expect(page.getByText('Pencarian dan heuristik.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Admin' })).toHaveCount(0);
  await expect(navLink(page, 'Beranda')).toBeVisible();
  await checkGates(page, testInfo, 'home');
});

test('choosing another day on Home shows that day', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: '9 Fri' })
    .locator('visible=true')
    .click();
  await expect(visibleText(page, 'Deadline Tugas Besar 1')).toBeVisible();
  await expect(page.getByText('Kuis 2').locator('visible=true')).toHaveCount(0);
});

test('a service tile opens the service', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'NIM Finder', exact: true })
    .locator('visible=true')
    .click();
  await expect(page).toHaveURL(/\/layanan\/nim$/);
  // The page's h1. P2-B's NIM Finder has no heading of its own inside the page, as in the locked prototype: the
  // shell's top bar is the h1 on phones and tablets, the desktop head on desktop.
  await expect(
    page.getByRole('heading', { level: 1, name: 'NIM Finder' }),
  ).toBeVisible();
  // And the page's body rendered, not only the shell's top bar (as strong as the check before P2-B).
  await expect(
    page
      .getByRole('main')
      .getByRole('searchbox', { name: 'Cari nama atau NIM' }),
  ).toBeVisible();
});

test.describe('Raka, pengurus', () => {
  test.use({ persona: 'pengurus' });

  test('Home shows Raka his courses and the Admin tile', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page, 'Raka')).toBeVisible();
    if (isPhone(testInfo))
      await expect(visibleText(page, 'Hi, Raka Pratama!')).toBeVisible();
    await expect(visibleText(page, 'Kuis 1')).toBeVisible();
    await expect(page.getByText('Kuis 2').locator('visible=true')).toHaveCount(
      0,
    );
    await expect(visibleText(page, 'Admin')).toBeVisible();
    await checkGates(page, testInfo, 'home-pengurus');
  });
});
