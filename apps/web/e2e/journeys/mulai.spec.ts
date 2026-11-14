/**
 * First run (`/mulai`): after a sign-in with no shared link, on a device
 * that hasn't finished or skipped it, while a step is open. Courses first, then notifications, then Beranda.
 */
import { devices, type Page } from '@playwright/test';
import { greeting } from '../support/app';
import { fakeGoogle, googleRequests } from '../support/google';
import { E2E_SUBSCRIPTION, pushDevice } from '../support/push';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const steps = (page: Page) =>
  main(page).getByRole('list', { name: 'Langkah memulai' });
const step = (page: Page, title: string) =>
  steps(page).getByRole('listitem').filter({ hasText: title });
const prompt = (page: Page) =>
  page.getByRole('dialog', { name: 'Nyalakan notifikasi?' });

async function signIn(page: Page) {
  await page.goto('/login');
  await expect
    .poll(async () => (await googleRequests(page)).clients.length)
    .toBe(1);
  await page.getByRole('button', { name: 'Masuk dengan akun STEI' }).click();
}

test.describe('a new member', () => {
  test.use({ signedIn: false });

  test.beforeEach(async ({ page, api, db }) => {
    db.myCourses = [];
    await fakeGoogle(page.context());
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
  });

  test('sign-in → first run → Atur → pick two → Tambahkan → back, done → Nyalakan → Beranda', async ({
    page,
    api,
    db,
  }, testInfo) => {
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    api.on('POST /api/push/register', writes.registerPush);
    await signIn(page);
    await expect(page).toHaveURL(/\/mulai$/);
    await expect(
      page.getByRole('heading', { name: 'Halo, Nadia' }),
    ).toBeVisible();
    await expect(page).toHaveTitle('Mulai · PIPS!');
    await expect(step(page, 'Atur mata kuliah semester ini')).toContainText(
      'Ding Dong dan acara Akademik masih kosong.',
    );
    await expect(step(page, 'Notifikasi belum menyala')).toBeVisible();
    // A focused flow: no tab bar or rail.
    await expect(
      page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .locator('visible=true'),
    ).toHaveCount(testInfo.project.name.includes('desktop') ? 1 : 0);
    await strictGates(page, testInfo, 'mulai', null);

    await step(page, 'Atur mata kuliah semester ini')
      .getByRole('link', { name: 'Atur' })
      .click();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah\?dari=mulai$/);
    const search = main(page).getByRole('searchbox', {
      name: 'Cari mata kuliah',
    });
    await search.fill('IF2110');
    await main(page)
      .getByRole('button', { name: /^IF2110 / })
      .click();
    await search.fill('IF2120');
    await main(page)
      .getByRole('button', { name: /^IF2120 / })
      .click();
    await page
      .getByRole('button', { name: /^Tambahkan/ })
      .locator('visible=true')
      .click();
    await expect(page).toHaveURL(/\/mulai$/);
    expect(api.calls('PUT /api/course/take/batch')[0].body).toEqual([
      { courseId: 'course-IF2110' },
      { courseId: 'course-IF2120' },
    ]);
    const courses = step(page, 'Atur mata kuliah semester ini');
    await expect(courses).toContainText('Selesai');
    await expect(courses).toContainText('2 mata kuliah · 6 SKS');
    // Tambahkan goes back to /mulai instead of forward, so Back does not return to an empty Tambah mata kuliah.
    await expect(
      page.getByRole('button', { name: 'Kembali ke Tambah mata kuliah' }),
    ).toHaveCount(0);

    await step(page, 'Notifikasi belum menyala')
      .getByRole('button', { name: 'Nyalakan' })
      .click();
    await expect(prompt(page)).toBeVisible();
    await strictAudit(page, testInfo, 'mulai-prompt');
    await prompt(page).getByRole('button', { name: 'Nyalakan' }).click();
    await expect(
      step(page, 'Notifikasi menyala di perangkat ini'),
    ).toContainText('Selesai');
    expect((await pushDevice(page)).asks).toBe(1);
    expect(api.calls('POST /api/push/register').map((c) => c.body)).toEqual([
      E2E_SUBSCRIPTION,
    ]);
    expect(db.pushSubscriptions).toEqual([E2E_SUBSCRIPTION]);

    await main(page).getByRole('button', { name: 'Ke Beranda' }).click();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
    await expect(greeting(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pips:mulai'))).toBe(
      'selesai',
    );
  });

  test('Lewati goes to Beranda, and the device remembers it after a reload and the next sign-in', async ({
    page,
    db,
  }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/mulai$/);
    await main(page).getByRole('button', { name: 'Lewati' }).click();
    await expect(greeting(page)).toBeVisible();
    await page.reload();
    await expect(greeting(page)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('pips:mulai'))).toBe(
      'lewati',
    );
    // The session ends on the server; signing in again skips first run on this device.
    db.signedIn = false;
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/login');
    await expect
      .poll(async () => (await googleRequests(page)).clients.length)
      .toBe(1);
    await page.getByRole('button', { name: 'Masuk dengan akun STEI' }).click();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
    await expect(greeting(page)).toBeVisible();
  });

  test('a shared link always wins over first run', async ({ page }) => {
    await page.goto('/profil/notifikasi');
    await expect(page).toHaveURL(/redirect=%2Fprofil%2Fnotifikasi/);
    await expect
      .poll(async () => (await googleRequests(page)).clients.length)
      .toBe(1);
    await page.getByRole('button', { name: 'Masuk dengan akun STEI' }).click();
    await expect(page).toHaveURL(/\/profil\/notifikasi$/);
  });
});

test.describe('a member with everything set', () => {
  test.use({ signedIn: false, push: 'on' });

  test('goes straight to Beranda', async ({ page, api }) => {
    await fakeGoogle(page.context());
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    api.on('POST /api/push/register', writes.registerPush);
    await signIn(page);
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
    await expect(greeting(page)).toBeVisible();
  });
});

test.describe('not installed', () => {
  test.use({ installed: false });

  test('Pasang PIPS! is an optional step that opens the install sheet', async ({
    page,
  }) => {
    await page.goto('/mulai');
    const pasang = step(page, 'Pasang PIPS!');
    await expect(pasang).toContainText(
      'Pilihan: buka PIPS! langsung dari layar utama.',
    );
    await pasang.getByRole('button', { name: 'Pasang' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Pasang PIPS!' }),
    ).toBeVisible();
  });
});

test.describe('an iPhone outside the installed app @phone-only', () => {
  test.use({ installed: false, userAgent: devices['iPhone 15'].userAgent });

  test('one Pasang button, on the Pasang PIPS! step; the notification step says why it waits', async ({
    page,
  }) => {
    await page.goto('/mulai');
    const notif = step(page, 'Notifikasi belum menyala');
    await expect(notif).toContainText('Perlu dipasang ke layar utama');
    await expect(notif.getByRole('button')).toHaveCount(0);
    await expect(
      main(page).getByRole('button', { name: 'Pasang' }),
    ).toHaveCount(1);
    await step(page, 'Pasang PIPS!')
      .getByRole('button', { name: 'Pasang' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Pasang PIPS!' }),
    ).toBeVisible();
    expect((await pushDevice(page)).asks).toBe(0);
  });
});

test.describe('first run on the real clock', () => {
  // A toast store that calls setTimeout as its own method throws "Illegal invocation" in a real browser, so
  // Tambahkan from first run would save the courses but never come back to Mulai. The harness's fake clock
  // hides that; this journey runs without it.
  test.use({ now: null });

  test('Atur → pick → Tambahkan → back on Mulai, with the courses done', async ({
    page,
    api,
    db,
  }) => {
    db.myCourses = [];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    api.on('PUT /api/course/take/batch', writes.takeCourses);
    await page.goto('/mulai');
    await step(page, 'Atur mata kuliah semester ini')
      .getByRole('link', { name: 'Atur' })
      .click();
    await expect(page).toHaveURL(/\/profil\/matkul\/tambah\?dari=mulai$/);
    await main(page)
      .getByRole('searchbox', { name: 'Cari mata kuliah' })
      .fill('IF2110');
    await main(page)
      .getByRole('button', { name: /^IF2110 / })
      .click();
    await page
      .getByRole('button', { name: /^Tambahkan/ })
      .locator('visible=true')
      .click();
    await expect(page).toHaveURL(/\/mulai$/);
    await expect(step(page, 'Atur mata kuliah semester ini')).toContainText(
      'Selesai',
    );
    expect(errors).toEqual([]);
  });
});
