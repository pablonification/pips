/**
 * Kalender and Mata kuliahku against the real API: this month's seeded events (an Akademik one through Nadia's
 * course, a Himpunan one for everyone), her two courses, and adding then removing a third.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support';

const main = (page: Page) => page.getByRole('main');
const course = (page: Page, code: string) =>
  main(page).locator('.g-course').filter({ hasText: code });

test('Kalender shows this month’s events from her course and from the Himpunan', async ({
  page,
  problems,
}) => {
  await page.goto('/kalender');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Kalender' }),
  ).toBeVisible();
  // The seed puts them on the next two days, or both on the month's last day: open each day that has an event.
  const busyDays = main(page).getByRole('button', { name: /, \d+ acara$/ });
  await expect(busyDays.first()).toBeVisible();
  const seen: string[] = [];
  for (const day of await busyDays.all()) {
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await expect(main(page)).toContainText(/Kuis Algoritma|Malam keakraban/);
    seen.push(await main(page).innerText());
  }
  expect(seen.join('\n')).toContain('Kuis Algoritma dan Struktur Data');
  expect(seen.join('\n')).toContain('Malam keakraban HMIF');
  void problems;
});

test('Mata kuliahku lists her courses; one added and removed again is saved each time', async ({
  page,
  problems,
}) => {
  await page.goto('/profil/matkul');
  await expect(course(page, 'IF2110')).toBeVisible();
  await expect(course(page, 'IF2120')).toBeVisible();
  // An earlier run may have stopped with IF2121 still taken.
  if (await course(page, 'IF2121').count()) {
    await main(page)
      .getByRole('button', { name: /^Hapus IF2121 / })
      .click();
    await expect(course(page, 'IF2121')).toHaveCount(0);
  }

  await main(page).getByRole('link', { name: 'Tambah mata kuliah' }).click();
  await main(page)
    .getByRole('searchbox', { name: 'Cari mata kuliah' })
    .fill('IF2121');
  await main(page)
    .getByRole('button', { name: /^IF2121 / })
    .click();
  await page
    .getByRole('button', { name: /^Tambahkan/ })
    .locator('visible=true')
    .click();
  await expect(page).toHaveURL(/\/profil\/matkul$/);
  await expect(course(page, 'IF2121')).toBeVisible();

  await page.reload();
  await expect(course(page, 'IF2121')).toBeVisible();
  const removed = page.waitForResponse(
    (r) =>
      r.url().includes('/api/course/take/batch') &&
      r.request().method() === 'DELETE',
  );
  await main(page)
    .getByRole('button', { name: /^Hapus IF2121 / })
    .click();
  expect((await removed).ok()).toBe(true);
  await page.reload();
  await expect(course(page, 'IF2110')).toBeVisible();
  await expect(course(page, 'IF2121')).toHaveCount(0);
  void problems;
});
