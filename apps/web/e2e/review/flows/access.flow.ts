/**
 * Access and session (P1-C, P0-B): signin-shared-link, signin-refused, phone-browser, first-run, install,
 * session-hiccup, signout.
 */
import type { Page } from '@playwright/test';
import { greeting, navLink } from '../../support/app';
import { installPrompts, stubInstallPrompt, UA } from '../../support/device';
import { fakeGoogle, googleRequests } from '../../support/google';
import { reply } from '../../support/mock';
import * as writes from '../../support/writes';
import { expect, flow } from '../support';

const main = (page: Page) => page.getByRole('main');
const masuk = (page: Page) => page.getByRole('button', { name: /^Masuk dengan Google$|^Masuk…$/ });
const googleReady = (page: Page) =>
  expect.poll(async () => (await googleRequests(page)).clients.length).toBe(1);
const P1 = 'Jadwal UTS Ganjil 2026/2027 sudah keluar';
const toast = (page: Page, text: string) => page.locator('.g-toast').filter({ hasText: text });

flow('signin-shared-link', 'nadia', { signedIn: false }, async ({ page, f, api }) => {
  await fakeGoogle(page.context());
  await f.step('Signed out, a shared link to p1 goes to Masuk, keeping the way back', async () => {
    await f.open('/pengumuman/p1');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpengumuman%2Fp1$/);
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
    await expect(page).toHaveTitle('Masuk · PIPS!');
    expect(api.calls('GET /api/info/:infoId')).toHaveLength(0);
    await f.gate('login');
  });
  api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
  api.on('POST /api/info/:infoId/read', writes.markRead);
  await f.step('Masuk dengan Google opens the post itself', async () => {
    await googleReady(page);
    await masuk(page).click();
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(main(page).getByRole('heading', { name: P1 }).first()).toBeVisible();
    await f.gate('post-after-sign-in');
  });
  await f.step('It is now read', async () => {
    await expect.poll(() => api.calls('POST /api/info/:infoId/read').length).toBeGreaterThan(0);
    await f.hold();
  });
  await f.step('The old push path /timeline/p1 lands on the same post', async () => {
    await page.goto('/timeline/p1');
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(main(page).getByRole('heading', { name: P1 }).first()).toBeVisible();
    await f.hold();
  });
});

flow('signin-refused', 'signed-out', { signedIn: false }, async ({ page, f, api }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await fakeGoogle(page.context());
  api.on('POST /api/auth/login/accesstoken', writes.loginNotAMember);
  await f.step('Masuk', async () => {
    await f.open('/login');
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
    await googleReady(page);
  });
  await f.step('The API refuses the account: the message names both causes', async () => {
    await masuk(page).click();
    await expect(page.getByRole('alert')).toContainText(
      'Akun ini belum bisa masuk. Pakai email mahasiswa (NIM@std.stei.itb.ac.id); kalau sudah, akunmu mungkin belum ada di daftar anggota HMIF.',
    );
    await f.gate('login-401');
    await f.hold();
  });
  await f.step('No loop: still on Masuk, nothing to retry, no browser alert', async () => {
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(0);
    expect(dialogs).toEqual([]);
    expect(api.calls('POST /api/auth/login/accesstoken')).toHaveLength(1);
    await f.hold();
  });
});

flow('phone-browser', 'nadia', { installed: false }, async ({ page, f }) => {
  await f.step('A phone browser opens PIPS! straight away: no install wall', async () => {
    await f.open('/');
    await expect(greeting(page)).toBeVisible();
    await expect(page.getByText(/install/i)).toHaveCount(0);
    await f.gate('not-installed');
    await f.hold();
  });
  await f.step('Pengumuman works without installing', async () => {
    await navLink(page, 'Pengumuman').click();
    await expect(page).toHaveURL(/\/pengumuman$/);
    await f.hold();
  });
});

flow('first-run', 'nadia', { signedIn: false, installed: false, push: 'off' }, async ({ page, f, api, db, layout }) => {
  db.myCourses = [];
  await fakeGoogle(page.context());
  api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
  api.on('PUT /api/course/take/batch', writes.takeCourses);
  api.on('POST /api/push/register', writes.registerPush);
  const steps = main(page).getByRole('list', { name: 'Langkah memulai' });
  const step = (title: string) => steps.getByRole('listitem').filter({ hasText: title });
  await f.step('Sign-in', async () => {
    await f.open('/login');
    await googleReady(page);
    await masuk(page).click();
  });
  await f.step('First run: "Halo, Nadia" and the steps, with no tab bar', async () => {
    await expect(page).toHaveURL(/\/mulai$/);
    await expect(page.getByRole('heading', { name: 'Halo, Nadia' })).toBeVisible();
    await expect(step('Atur mata kuliah semester ini')).toContainText('Ding Dong dan acara Akademik masih kosong.');
    await expect(step('Notifikasi belum menyala')).toBeVisible();
    await expect(step('Pasang PIPS!')).toContainText('Pilihan: buka PIPS! langsung dari layar utama.');
    await expect(
      page.getByRole('navigation', { name: 'Navigasi utama' }).locator('visible=true'),
    ).toHaveCount(layout === 'desktop' ? 1 : 0);
    await f.gate('mulai');
  });
  await f.step('Atur opens Tambah mata kuliah, nothing pre-selected', async () => {
    await step('Atur mata kuliah semester ini').getByRole('link', { name: 'Atur' }).click();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah\?dari=mulai$/);
    await expect(main(page).getByRole('radio', { checked: true })).toHaveCount(0);
    await f.gate('mulai-tambah');
  });
  await f.step('IF2110 K2 and IF2120 K1 picked', async () => {
    const search = main(page).getByRole('searchbox', { name: 'Cari mata kuliah' });
    await f.type(search, 'IF2110');
    await main(page).getByRole('radiogroup', { name: 'Kelas IF2110' }).getByRole('radio', { name: 'K2' }).click();
    await f.type(search, 'IF2120');
    await main(page).getByRole('radiogroup', { name: 'Kelas IF2120' }).getByRole('radio', { name: 'K1' }).click();
  });
  await f.step('Tambahkan: back on Mulai, the step reads Selesai', async () => {
    await page.getByRole('button', { name: /^Tambahkan/ }).locator('visible=true').click();
    await expect(page).toHaveURL(/\/mulai$/);
    await expect(step('Atur mata kuliah semester ini')).toContainText('Selesai');
    await expect(step('Atur mata kuliah semester ini')).toContainText('2 mata kuliah · 6 SKS');
  });
  await f.step('Nyalakan explains first, then allowed', async () => {
    await step('Notifikasi belum menyala').getByRole('button', { name: 'Nyalakan' }).click();
    const prompt = page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });
    await expect(prompt).toBeVisible();
    await f.gate('mulai-prompt');
    await f.hold();
    await prompt.getByRole('button', { name: 'Nyalakan' }).click();
    await expect(step('Notifikasi menyala di perangkat ini')).toContainText('Selesai');
  });
  await f.step('Pasang PIPS! is left undone; Ke Beranda', async () => {
    await expect(step('Pasang PIPS!')).not.toContainText('Selesai');
    await main(page).getByRole('button', { name: 'Ke Beranda' }).click();
    await expect(greeting(page)).toBeVisible();
    await f.hold();
  });
});

const openPasang = async (page: Page) => {
  await main(page).getByRole('button', { name: 'Pasang PIPS!' }).click();
  await expect(page.getByRole('dialog', { name: 'Pasang PIPS!' })).toBeVisible();
};
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Pasang PIPS!' });

flow('install', 'android', { userAgent: UA.androidChrome, installed: false }, async ({ page, f }) => {
  await stubInstallPrompt(page.context(), 'accepted');
  await f.step('Profil, Pasang PIPS!', async () => {
    await f.open('/profil');
    await openPasang(page);
    await f.gate('pasang-android');
    await f.hold();
  });
  await f.step('Android: the browser’s own install prompt, then a toast', async () => {
    await sheet(page).getByRole('button', { name: 'Pasang PIPS!' }).click();
    await expect(sheet(page)).toBeHidden();
    expect(await installPrompts(page)).toBe(1);
    await expect(toast(page, 'PIPS! terpasang di perangkat ini.')).toBeVisible();
    await f.hold();
  });
  await f.step('Installed now: Pasang PIPS! says so', async () => {
    await openPasang(page);
    await expect(sheet(page)).toContainText('PIPS! sudah terpasang di perangkat ini.');
    await f.hold();
  });
});

flow('install', 'iphone', { userAgent: UA.iphone, installed: false }, async ({ page, f }) => {
  await f.step('Profil, Pasang PIPS! on an iPhone: the steps', async () => {
    await f.open('/profil');
    await openPasang(page);
    await expect(sheet(page).getByRole('listitem')).toHaveText([
      '1. Ketuk Bagikan di bilah bawah Safari.',
      '2. Pilih Tambahkan ke Layar Utama.',
      '3. Ketuk Tambah, lalu buka PIPS! dari layar utama.',
    ]);
    await f.gate('pasang-iphone');
    await f.hold();
  });
  await f.step('Escape closes it, focus back on Pasang PIPS!', async () => {
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(main(page).getByRole('button', { name: 'Pasang PIPS!' })).toBeFocused();
  });
});

flow('install', 'line', { userAgent: UA.line, installed: false }, async ({ page, f }) => {
  await f.step('Inside LINE: open PIPS! in Chrome or Safari first', async () => {
    await f.open('/profil');
    await openPasang(page);
    await expect(sheet(page)).toContainText(
      'Browser di dalam LINE tidak bisa memasang aplikasi. Buka PIPS! di Chrome atau Safari dulu',
    );
    await expect(sheet(page).getByRole('listitem')).toHaveCount(0);
    await f.gate('pasang-line');
    await f.hold();
  });
});

flow('install', 'desktop', { installed: false }, async ({ page, f }) => {
  await f.step('A desktop browser: Pasang PIPS! shows this browser’s own state', async () => {
    await f.open('/profil');
    await openPasang(page);
    await expect(sheet(page)).not.toBeEmpty();
    await f.gate('pasang-desktop');
    await f.hold();
  });
});

flow('session-hiccup', 'nadia', {}, async ({ page, f, api, db }) => {
  let calls = 0;
  api.on('GET /api/me', () => {
    calls += 1;
    if (calls === 1) return reply.abort('failed');
    if (calls === 2) return reply.status(503);
    return db.me;
  });
  await f.step('The session check is dropped, then answered 503: Nadia stays signed in', async () => {
    await f.open('/');
    await expect(greeting(page)).toBeVisible();
    await f.gate('beranda-hiccup');
  });
  await f.step('The app retries until it is answered', async () => {
    await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
    await expect(page).toHaveURL(/\/$/);
    await expect(greeting(page)).toBeVisible();
  });
  await f.step('Offline: the banner with the last update time, over what was kept', async () => {
    await api.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(
      main(page).getByRole('status').filter({ hasText: /^Offline · diperbarui \d\d\.\d\d$/ }),
    ).toBeVisible();
    await expect(main(page).getByText('Kuis 2').first()).toBeVisible();
    await f.gate('beranda-offline');
    await f.hold();
  });
  await f.step('Back online: the banner goes', async () => {
    await api.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(main(page).getByRole('status').filter({ hasText: /^Offline/ })).toHaveCount(0);
    await f.hold();
  });
});

flow('signout', 'nadia', {}, async ({ page, f, api, db }) => {
  api.on('POST /api/logout', () => {
    db.signedIn = false;
    return {};
  });
  await f.step('Profil, Keluar', async () => {
    await f.open('/profil');
    await main(page).getByRole('button', { name: 'Keluar' }).click();
  });
  await f.step('The confirmation', async () => {
    const confirm = page.getByRole('alertdialog', { name: 'Keluar dari PIPS!?' });
    await expect(confirm).toBeVisible();
    await f.gate('keluar');
    await f.hold();
  });
  await f.step('Keluar: the sign-in page', async () => {
    await page.getByRole('alertdialog', { name: 'Keluar dari PIPS!?' }).getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
    expect(api.calls('POST /api/logout')).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('userAcademic'))).toBeNull();
    await f.hold();
  });
});
