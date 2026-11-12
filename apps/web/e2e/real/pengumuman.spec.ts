/**
 * Pengumuman against the real API: the feed holds what Nadia's angkatan may see, and a reaction and a comment are
 * saved by the server (they are still there after a reload). The journeys may run again on the same database, so
 * each one works from whatever an earlier run left.
 */
import { expect, test } from './support';

const POST = 'Rapat anggota akhir semester';
const detail = (page: import('@playwright/test').Page) =>
  page.locator('article.g-detail');

test('the feed shows posts for everyone and for her angkatan, not for another angkatan', async ({
  page,
  problems,
}) => {
  await page.goto('/pengumuman');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Pengumuman' }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: new RegExp(`^${POST}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: /^Kumpul angkatan PIXEL hari Sabtu/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('article', { name: /^Jadwal kuis Struktur Data/ }),
  ).toBeVisible();
  await expect(page.getByText('Pendataan peminatan angkatan 2024')).toHaveCount(
    0,
  );
  void problems;
});

test('a reaction and a comment on a post are still there after a reload', async ({
  page,
  problems,
}) => {
  await page.goto('/pengumuman/seed-info-semua');
  await expect(detail(page).getByRole('heading', { name: POST })).toBeVisible();
  // The seed's comment, from another member.
  await expect(detail(page).getByText('Siap, nanti aku datang!')).toBeVisible();

  // React with whichever kind isn't hers yet.
  await detail(page)
    .getByRole('button', { name: /^(Beri|Ganti) reaksi$/ })
    .click();
  const picker = page.getByRole('group', { name: 'Pilih reaksi' });
  const keren = picker.getByRole('button', { name: 'Keren' });
  await expect(keren).toBeVisible();
  const choice =
    (await keren.getAttribute('aria-pressed')) === 'true'
      ? 'Senyum lebar'
      : 'Keren';
  const saved = page.waitForResponse(
    (r) => r.url().includes('/api/reaction') && r.request().method() !== 'GET',
  );
  await picker.getByRole('button', { name: choice }).click();
  expect((await saved).ok()).toBe(true);

  const comment = `Komentar uji ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Tulis komentar' }).fill(comment);
  await page.getByRole('button', { name: 'Kirim komentar' }).click();
  await expect(page.getByText('Komentar terkirim.')).toBeVisible();

  await page.reload();
  await expect(detail(page).getByRole('heading', { name: POST })).toBeVisible();
  await expect(detail(page).getByText(comment)).toBeVisible();
  await expect(
    detail(page).getByRole('button', { name: 'Ganti reaksi', exact: true }),
  ).toBeVisible();
  await detail(page)
    .getByRole('button', { name: 'Ganti reaksi', exact: true })
    .click();
  await expect(
    page
      .getByRole('group', { name: 'Pilih reaksi' })
      .getByRole('button', { name: choice }),
  ).toHaveAttribute('aria-pressed', 'true');
  void problems;
});
