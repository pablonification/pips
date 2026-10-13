/**
 * Sign-in (P1-C): Masuk dengan Google through a fake Google script (support/google.ts), shared links that survive
 * sign-in, and every way it can fail, said in Indonesian on the page (never `alert()`).
 */
import type { Page } from '@playwright/test';
import { checkGates } from '../support/audit';
import { greeting } from '../support/app';
import {
  E2E_GOOGLE_TOKEN,
  fakeGoogle,
  googleAnswers,
  googleRequests,
} from '../support/google';
import { reply } from '../support/mock';
import { strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const masuk = (page: Page) =>
  page.getByRole('button', { name: /^Masuk dengan Google$|^Masuk…$/ });
const alertText = (page: Page) => page.getByRole('alert');
/** Google's script has run and the token client exists (the button does nothing useful before). */
const googleReady = (page: Page) =>
  expect.poll(async () => (await googleRequests(page)).clients.length).toBe(1);
/** No browser dialog may open on this page (today's app used alert()). */
const noDialogs = (page: Page) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  return dialogs;
};

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('a shared post link leads to sign-in, then straight to the post', async ({
    page,
    api,
  }, testInfo) => {
    await fakeGoogle(page.context());
    await page.goto('/pengumuman/p1');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpengumuman%2Fp1$/);
    await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible();
    await expect(page).toHaveTitle('Masuk · PIPS!');
    await expect(
      page.getByText(
        'Pakai akun Google email mahasiswamu (NIM@std.stei.itb.ac.id).',
      ),
    ).toBeVisible();
    // The official logo, whole.
    const logo = page.locator('img[src="/logo/hmif.png"]');
    await expect(logo).toBeVisible();
    expect((await logo.boundingBox())!.width).toBeGreaterThanOrEqual(40);
    // The production build has no test-login form, and nothing asked the API for the post.
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0);
    await expect(page.getByText('Akun uji')).toHaveCount(0);
    expect(api.calls('GET /api/info/:infoId')).toHaveLength(0);
    await strictGates(page, testInfo, 'login', null);

    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await googleReady(page);
    await masuk(page).click();
    // Deep links survive sign-in (SPEC "Information architecture and shell"), and first run doesn't intercept them.
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(
      page
        .getByText('Jadwal UTS Ganjil 2026/2027 sudah keluar')
        .locator('visible=true')
        .first(),
    ).toBeVisible();
    expect(api.calls('POST /api/auth/login/accesstoken')[0].body).toEqual({
      accessToken: E2E_GOOGLE_TOKEN,
    });
  });

  test('today’s /timeline links still come back to the post', async ({
    page,
    api,
  }) => {
    await fakeGoogle(page.context());
    await page.goto('/timeline/p1');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpengumuman%2Fp1$/);
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await googleReady(page);
    await masuk(page).click();
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
  });

  test.describe('with notifications on and courses set', () => {
    test.use({ push: 'on' });

    test('a redirect to another site is ignored: sign-in goes to Beranda', async ({
      page,
      api,
    }) => {
      await fakeGoogle(page.context());
      api.on('POST /api/push/register', writes.registerPush);
      await page.goto(
        `/login?redirect=${encodeURIComponent('https://evil.example/')}`,
      );
      api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
      await googleReady(page);
      await masuk(page).click();
      await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
      await expect(greeting(page)).toBeVisible();
      expect(api.blocked.some((b) => b.path.includes('evil.example'))).toBe(
        false,
      );
      // A device that already had notifications on is linked to the new session, without asking.
      await expect
        .poll(() => api.calls('POST /api/push/register').length)
        .toBe(1);
    });
  });

  test('401: the Indonesian message naming both causes, no alert, nothing to retry', async ({
    page,
    api,
  }, testInfo) => {
    const dialogs = noDialogs(page);
    await fakeGoogle(page.context());
    api.on('POST /api/auth/login/accesstoken', writes.loginNotAMember);
    await page.goto('/login');
    await googleReady(page);
    await masuk(page).click();
    await expect(alertText(page)).toContainText(
      'Akun ini belum bisa masuk. Pakai email mahasiswa (NIM@std.stei.itb.ac.id); kalau sudah, akunmu mungkin belum ada di daftar anggota HMIF.',
    );
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toHaveCount(
      0,
    );
    await expect(page).toHaveURL(/\/login$/);
    expect(dialogs).toEqual([]);
    await strictGates(page, testInfo, 'login-401', null);
    // Another account: pressing again clears the message and asks Google again.
    await masuk(page).click();
    await expect
      .poll(async () => (await googleRequests(page)).requests)
      .toBe(2);
  });

  test('500: Coba lagi sends the same token again, and that works', async ({
    page,
    api,
  }, testInfo) => {
    const dialogs = noDialogs(page);
    await fakeGoogle(page.context());
    let fail = true;
    api.on('POST /api/auth/login/accesstoken', (req) =>
      fail ? writes.loginServerError(req) : writes.loginAccessToken(req),
    );
    await page.goto('/login?redirect=%2Fprofil');
    await googleReady(page);
    await masuk(page).click();
    await expect(alertText(page)).toContainText(
      'PIPS! belum bisa memproses masuk. Periksa koneksimu, lalu coba lagi.',
    );
    await strictGates(page, testInfo, 'login-500', null);
    fail = false;
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(page).toHaveURL(/\/profil$/);
    const bodies = api
      .calls('POST /api/auth/login/accesstoken')
      .map((c) => c.body);
    expect(bodies).toEqual([
      { accessToken: E2E_GOOGLE_TOKEN },
      { accessToken: E2E_GOOGLE_TOKEN },
    ]);
    // Google's popup opened once: Coba lagi reused the token.
    expect((await googleRequests(page)).requests).toBe(1);
    expect(dialogs).toEqual([]);
  });

  test('a dropped request says so with Coba lagi; waiting says Masuk…', async ({
    page,
    api,
  }) => {
    await fakeGoogle(page.context());
    let attempt = 0;
    api.on('POST /api/auth/login/accesstoken', (req) => {
      attempt += 1;
      return attempt === 1
        ? reply.abort('failed')
        : reply.delay(800, writes.loginAccessToken(req));
    });
    await page.goto('/login?redirect=%2Fprofil');
    await googleReady(page);
    await masuk(page).click();
    await expect(alertText(page)).toContainText(
      'PIPS! belum bisa memproses masuk.',
    );
    await page.getByRole('button', { name: 'Coba lagi' }).click();
    await expect(page.getByRole('button', { name: 'Masuk…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page).toHaveURL(/\/profil$/);
  });

  test('closing Google’s popup says nothing; a blocked popup says how to fix it', async ({
    page,
    api,
  }) => {
    await fakeGoogle(page.context());
    await page.goto('/login');
    await googleReady(page);
    await googleAnswers(page, 'closed');
    await masuk(page).click();
    await expect
      .poll(async () => (await googleRequests(page)).requests)
      .toBe(1);
    await page.waitForTimeout(200);
    await expect(page.locator('[role="alert"]')).toHaveText('');
    await googleAnswers(page, 'blocked');
    await masuk(page).click();
    await expect(alertText(page)).toContainText(
      'Jendela masuk Google diblokir browser. Izinkan pop-up untuk PIPS!, lalu coba lagi.',
    );
    expect(api.writes).toEqual([]);
  });

  test('Google unreachable: pressing says so instead of doing nothing', async ({
    page,
    api,
  }) => {
    // No fake script: the mock blocks accounts.google.com, as an offline or filtered network would.
    await page.goto('/login');
    await masuk(page).click();
    await expect(alertText(page)).toContainText(
      'PIPS! belum bisa memproses masuk.',
    );
    await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
    expect(api.writes).toEqual([]);
  });

  test('a stale session in the browser is sent back to sign-in', async ({
    page,
    db,
  }) => {
    await page.addInitScript(
      (user) => localStorage.setItem('user', JSON.stringify(user)),
      db.me,
    );
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a stale session on a deep page comes back to that page after sign-in', async ({
    page,
    api,
    db,
  }) => {
    await fakeGoogle(page.context());
    await page.addInitScript(
      (user) => localStorage.setItem('user', JSON.stringify(user)),
      db.me,
    );
    await page.goto('/layanan/nim?q=nadia');
    await expect(page).toHaveURL(
      /\/login\?redirect=%2Flayanan%2Fnim%3Fq%3Dnadia$/,
    );
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    await googleReady(page);
    await masuk(page).click();
    await expect(page).toHaveURL(/\/layanan\/nim\?q=nadia$/);
    await expect(
      page.getByPlaceholder('Ketik nama atau NIM').locator('visible=true'),
    ).toBeVisible();
  });
});

test('a signed-in member opening /login goes where sign-in would have gone', async ({
  page,
}) => {
  await page.goto('/login?redirect=%2Fprofil%2Fmatkul');
  await expect(page).toHaveURL(/\/profil\/matkul$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  await expect(greeting(page)).toBeVisible();
});

test.describe('not installed', () => {
  test.use({ installed: false });

  // SPEC "Removals": the install gate is gone. Before P0-B a phone browser got an install tutorial instead.
  test('a phone browser opens the app straight away, with no install wall @phone-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await expect(page.getByText(/install/i)).toHaveCount(0);
    await checkGates(page, testInfo, 'not-installed');
  });

  test('a desktop browser opens the app without installing @desktop-only', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
  });
});
