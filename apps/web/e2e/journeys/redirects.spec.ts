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
    await expect
      .poll(() => {
        const url = new URL(page.url());
        return `${url.pathname}${url.search}`;
      })
      .toBe(to);
    // The old path doesn't stay in history: Back doesn't bounce through it.
    expect(await page.evaluate(() => history.length)).toBe(2);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByText('Halaman ini gagal dimuat.')).toHaveCount(0);
    await expect(page.getByText('Bagian ini gagal dimuat.')).toHaveCount(0);
  });
}
