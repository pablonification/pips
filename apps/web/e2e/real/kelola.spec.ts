/**
 * Roles against the real API: the server's roles decide what the app offers. The plain anggota is sent away from
 * Kelola; the pengurus (admin and akademik) sees their tools and Live Counting reads the real form.
 *
 * Adding a calendar event is left out: the API writes it to Google Calendar first and has no way to run without
 * Google, and these journeys reach no outside service.
 */
import type { Page } from '@playwright/test';
import { expect, test } from './support';

const main = (page: Page) => page.getByRole('main');
const tools = (page: Page) => main(page).getByRole('list').getByRole('link');

test('the plain anggota has no Kelola, and its pages send her to Layanan', async ({
  page,
  problems,
}) => {
  await page.goto('/layanan');
  await expect(
    main(page).getByRole('heading', { name: 'Kuliah' }),
  ).toBeVisible();
  await expect(main(page).getByRole('heading', { name: 'Kelola' })).toHaveCount(
    0,
  );
  for (const path of ['/kelola', '/kelola/live', '/kelola/curhat']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/layanan$/);
  }
  void problems;
});

test.describe('the pengurus', () => {
  test.use({ member: 'pengurus' });

  test('sees the tools of admin and akademik, and Live Counting reads the form', async ({
    page,
    problems,
  }) => {
    await page.goto('/kelola');
    await expect(tools(page)).toHaveCount(3);
    await expect(tools(page).nth(0)).toHaveAccessibleName(
      /^Live Counting & Rekap Form/,
    );
    await expect(tools(page).nth(1)).toHaveAccessibleName(
      /^Data SPARTA Magang/,
    );
    await expect(tools(page).nth(2)).toHaveAccessibleName(
      /^Tambah acara Akademik/,
    );
    // No Curhat inbox: that is Welfare's.
    await expect(
      main(page).getByRole('link', { name: /^Curhat Yuk!/ }),
    ).toHaveCount(0);

    await tools(page).nth(0).click();
    await expect(page).toHaveURL(/\/kelola\/live\/[^/]+$/);
    await expect(
      main(page).getByText('Form Analisis Kondisi PIXEL').first(),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    void problems;
  });
});
