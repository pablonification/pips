/** States (P0-A, P0-B; P3-B's forwarding routes): errors-offline, old-links. */
import type { Page } from '@playwright/test';
import { greeting, navLink } from '../../support/app';
import { reply } from '../../support/mock';
import * as writes from '../../support/writes';
import { failsWith } from '../findings';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');

flow('errors-offline', 'nadia', {}, async ({ page, f, api, layout }) => {
  let feed: 'fail' | 'ok' = 'fail';
  api.on('GET /api/info', (req) => {
    if (new URLSearchParams(req.query).get('unread') === 'true') return { infos: [] };
    return feed === 'fail' ? reply.status(503) : { infos: req.db.infos.slice(0, 10) };
  });
  await f.step('Pengumuman fails (503): it says so, with Coba lagi', async () => {
    await f.open('/pengumuman');
    await expect(page.getByText('Pengumuman gagal dimuat.')).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/pengumuman$/);
    await f.gate('feed-error');
    await f.hold();
  });
  await f.step('Coba lagi: it loads', async () => {
    feed = 'ok';
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      layout === 'desktop' ? page.locator('[data-post-row="p1"]') : page.locator('[data-post-link="p1"]'),
    ).toBeVisible();
    await f.hold();
  });
  await f.step('Offline, Kalender: the kept month under the offline line', async () => {
    await navLink(page, 'Kalender').click();
    await expect(main(page).getByText('Kuis 2').first()).toBeVisible();
    await api.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(main(page).getByRole('status').filter({ hasText: /^Offline · diperbarui/ })).toBeVisible();
    await f.hold();
  });
  await f.step('A month not kept on the device says so, not endless loading', async () => {
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await main(page).getByRole('button', { name: 'Bulan berikutnya' }).click();
    await expect(main(page).getByRole('alert')).toContainText('Acara bulan ini belum tersimpan di perangkat ini.');
    await expect(page.getByRole('status', { name: 'Memuat acara…' })).toHaveCount(0);
    await f.gate('kalender-offline-not-kept');
    await f.hold();
  });
  await f.step('Back online, the month loads', async () => {
    await api.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(main(page).getByRole('alert')).toHaveCount(0, { timeout: 15_000 });
    await f.hold();
  });
  await f.step('A page whose code fails to load: "Bagian ini gagal dimuat." with Coba lagi and Ke Beranda; the shell stays', async () => {
    await navLink(page, 'Layanan').click();
    await expect(page).toHaveURL(/\/layanan$/);
    await page.context().route('**/assets/dingdong-*.js', (r) => r.abort('failed'));
    await main(page).getByRole('link', { name: /^Ding Dong/ }).first().click();
    await expect(page.getByText('Bagian ini gagal dimuat.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
    await expect(navLink(page, 'Beranda')).toBeVisible();
    await f.gate('route-error');
    await f.hold();
  });
  await f.step('Ke Beranda', async () => {
    await page.getByRole('link', { name: 'Ke Beranda' }).click();
    await expect(greeting(page)).toBeVisible();
    await f.hold();
  });
}, { fails: failsWith('F1-2'), failsWhere: { themes: ['dark'] } });

flow('old-links', 'raka', {}, async ({ page, f, api }) => {
  api.on('POST /api/info/:infoId/read', writes.markRead);
  const lands = async (from: string, to: RegExp) => {
    await page.goto(from);
    await expect(page).toHaveURL(to);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.getByText('Halaman ini gagal dimuat.')).toHaveCount(0);
    await expect(page.getByText('Bagian ini gagal dimuat.')).toHaveCount(0);
    await f.hold(1000);
  };
  await f.step('/timeline → Pengumuman', async () => {
    await f.open('/timeline');
    await expect(page).toHaveURL(/\/pengumuman$/);
    await f.gate('old-timeline');
  });
  await f.step('A push to /timeline/p1 → the post', () => lands('/timeline/p1', /\/pengumuman\/p1$/));
  await f.step('/calendar → Kalender', () => lands('/calendar', /\/kalender/));
  await f.step('/home/testimoni/teknik-informatika/3 → Testi Matkul’s list', () =>
    lands('/home/testimoni/teknik-informatika/3', /\/layanan\/testi\/teknik-informatika\/3$/),
  );
  await f.step('/settings/courses → Mata kuliahku', () => lands('/settings/courses', /\/profil\/matkul$/));
  await f.step('/home/admin → Kelola', () => lands('/home/admin', /\/kelola$/));
  await f.step('/kelola/acara → Tambah acara Akademik over Kalender', async () => {
    await lands('/kelola/acara', /\/kalender\?(.*&)?tambah=acara/);
    await expect(page.getByRole('dialog', { name: 'Tambah acara Akademik' })).toBeVisible();
  });
  await f.step('/kelola/lomba → Info Lomba', () => lands('/kelola/lomba', /\/layanan\/lomba$/));
  await f.step('/kelola/testi → Testi Matkul', () => lands('/kelola/testi', /\/layanan\/testi$/));
});
