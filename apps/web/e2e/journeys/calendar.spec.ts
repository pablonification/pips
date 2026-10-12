import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';

test('the calendar opens on today with today’s events', async ({
  page,
  api,
}, testInfo) => {
  await page.goto('/calendar');
  await expect(
    page.getByRole('heading', { name: 'October 2026' }).locator('visible=true'),
  ).toBeVisible();
  await expect(
    visibleText(page, 'Sharing Session: Magang di Startup'),
  ).toBeVisible();
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  expect(
    api
      .calls('GET /api/calendar/me')
      .some(
        (c) => c.query.includes('month=10') && c.query.includes('year=2026'),
      ),
  ).toBe(true);
  await checkGates(page, testInfo, 'calendar');
});

test('choosing a day shows its events @phone-only', async ({ page }) => {
  await page.goto('/calendar');
  await page
    .getByText('19', { exact: true })
    .locator('visible=true')
    .first()
    .click();
  await expect(
    visibleText(page, 'Ruang dibagi per kelas; cek pengumuman jadwal UTS.'),
  ).toBeVisible();
});

test('the month grid lists the events of each day @desktop-only', async ({
  page,
}) => {
  await page.goto('/calendar');
  await expect(
    page.getByText('Deadline Tugas Besar 1').locator('visible=true').first(),
  ).toBeVisible();
  await expect(
    page.getByText('Bakti Sosial HMIF').locator('visible=true').first(),
  ).toBeVisible();
});

test.describe('Raka, akademik', () => {
  test.use({ persona: 'pengurus' });

  test('Raka can add an event @desktop-only', async ({ page }, testInfo) => {
    await page.goto('/calendar');
    await page.getByRole('button', { name: 'Add event' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await checkGates(page, testInfo, 'calendar-add-event');
  });
});
