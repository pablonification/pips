/** Beranda against the real API: every section shows the seed's data, with no error anywhere. */
import { expect, test } from './support';

test('Beranda shows the seed: the greeting, the coming events and unread announcements', async ({
  page,
  problems,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Halo, Nadia' }),
  ).toBeVisible();

  // The next eight days hold the seed's two events of this month (or none, on the month's last day).
  const agenda = page.getByRole('region', { name: '8 hari ke depan' });
  const busyDays = agenda.getByRole('button', { name: /, \d+ acara$/ });
  const titles: string[] = [];
  for (const day of await busyDays.all()) {
    await day.click();
    await expect(day).toHaveAttribute('aria-pressed', 'true');
    await expect(agenda).toContainText(/Kuis Algoritma|Malam keakraban/);
    titles.push(await agenda.innerText());
  }
  if (titles.length > 0) {
    expect(titles.join('\n')).toContain('Kuis Algoritma dan Struktur Data');
    expect(titles.join('\n')).toContain('Malam keakraban HMIF');
  }

  // For Nadia's angkatan (2025); not the one for 2024. No journey opens it, so it stays unread.
  await expect(
    page.getByText('Kumpul angkatan PIXEL hari Sabtu'),
  ).toBeVisible();
  await expect(page.getByText('Pendataan peminatan angkatan 2024')).toHaveCount(
    0,
  );
  await expect(page.getByText(/gagal dimuat/)).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  void problems;
});
