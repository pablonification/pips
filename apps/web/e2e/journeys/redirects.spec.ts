import { expect, test } from '../support/test';

/*
 * Every path in today's route tree still works: it lands, with its search string, on the screen's new URL
 * (src/lib/legacy-redirects.ts), and the screen renders. Shared links, bookmarks, the installed app's history
 * and push notifications (/timeline/<id>) use these. Raka, so the Kelola pages render too.
 */
test.use({ persona: 'pengurus' });

const REDIRECTS: Array<[from: string, to: string]> = [
  ['/home', '/'],
  ['/home/dingdong', '/layanan/dingdong'],
  ['/home/testimoni', '/layanan/testi'],
  ['/home/testimoni/teknik-informatika', '/layanan/testi/teknik-informatika'],
  [
    '/home/testimoni/teknik-informatika/3',
    '/layanan/testi/teknik-informatika/3',
  ],
  [
    '/home/testimoni/teknik-informatika/3/course-IF2110?page=1',
    '/layanan/testi/teknik-informatika/3/course-IF2110?page=1',
  ],
  ['/home/nim-finder', '/layanan/nim'],
  ['/home/competition', '/layanan/lomba'],
  ['/home/curhat', '/layanan/curhat'],
  ['/home/form', '/layanan/form'],
  ['/home/form/pixel', '/layanan/form/pixel'],
  ['/home/internship', '/layanan/sparta'],
  ['/home/internship/admin', '/kelola/sparta'],
  ['/home/internship/admin/sub-13525071', '/kelola/sparta/sub-13525071'],
  ['/home/admin', '/kelola'],
  ['/home/admin/forms', '/kelola/live'],
  ['/home/admin/forms/pixel', '/kelola/live/pixel'],
  ['/home/rekomendasi/voucher-1', '/'],
  ['/socket', '/'],
  ['/timeline', '/pengumuman'],
  ['/timeline?showAnnounce=true', '/pengumuman?showAnnounce=true'],
  ['/timeline/p1', '/pengumuman/p1'],
  ['/add-announcement', '/pengumuman/tulis'],
  ['/calendar', '/kalender'],
  ['/settings', '/profil'],
  ['/settings/courses', '/profil/matkul'],
  ['/settings/courses/add', '/profil/matkul/tambah'],
  ['/settings/subscriptions', '/profil/notifikasi'],
  ['/settings/credits', '/profil/kredit'],
];

for (const [from, to] of REDIRECTS) {
  test(`${from} → ${to}`, async ({ page, api }) => {
    api.on('POST /api/info/:infoId/read', () => ({}));
    await page.goto(from);
    // The new path with the old link's search string; a screen may add its own view params (today's Kalender
    // writes the day it opens on).
    const expected = new URL(to, 'http://x');
    await expect
      .poll(() => {
        const url = new URL(page.url());
        const kept = [...expected.searchParams].every(
          ([key, value]) => url.searchParams.get(key) === value,
        );
        return `${url.pathname}${kept ? expected.search : url.search}`;
      })
      .toBe(to);
    await expect(page.locator('#root')).not.toBeEmpty();
    // The old path doesn't stay in history: Back doesn't bounce through it. Checked once the screen has
    // settled, so a navigation the screen makes itself would be counted too.
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => history.length)).toBe(2);
    await expect(page.getByText('Halaman ini gagal dimuat.')).toHaveCount(0);
    await expect(page.getByText('Bagian ini gagal dimuat.')).toHaveCount(0);
  });
}

// Review m4: a value the page doesn't expect (a number for `unread`, an object for `sort`, text for a date
// number) is dropped and the page opens, never an error page.
for (const from of [
  '/timeline?unread=1',
  '/timeline?sort=%7B%22a%22%3A1%7D&excludeCategories=akademik',
  '/pengumuman?search=5&showAnnounce=ya',
  '/calendar?selectedDate=abc&selectedMonth=%7B%7D',
  '/home/testimoni/teknik-informatika/3/course-IF2110?page=satu',
]) {
  test(`a bad value in an old link still opens the page: ${from}`, async ({
    page,
    api,
  }) => {
    api.on('POST /api/info/:infoId/read', () => ({}));
    await page.goto(from);
    await expect
      .poll(() => new URL(page.url()).pathname)
      .not.toMatch(/^\/(timeline|calendar|home)/);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(
      page
        .getByRole('link', { name: 'Home', exact: true })
        .locator('visible=true')
        .first(),
    ).toBeVisible();
    await expect(page.getByText('Halaman ini gagal dimuat.')).toHaveCount(0);
    await expect(page.getByText('Bagian ini gagal dimuat.')).toHaveCount(0);
  });
}
