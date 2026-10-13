import type { Page } from '@playwright/test';
import { checkGates } from '../support/audit';
import { greeting, visibleText } from '../support/app';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

/**
 * Google Identity Services, faked for this page: the "Log in with Google" button gets an access token at once,
 * as if the member had picked their std account in Google's popup. Every other origin stays blocked.
 */
async function fakeGoogleSignIn(page: Page) {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.google = { accounts: {
        id: { initialize() {}, prompt() {}, renderButton() {}, disableAutoSelect() {}, cancel() {} },
        oauth2: {
          initTokenClient(config) {
            return { requestAccessToken() {
              setTimeout(() => config.callback({ access_token: 'e2e-google-token', token_type: 'Bearer', expires_in: 3599, scope: config.scope }), 0);
            } };
          },
          initCodeClient() { return { requestCode() {} }; },
          hasGrantedAllScopes() { return true; },
        },
      } };`,
    }),
  );
}

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('a shared post link (today’s /timeline path) leads to sign-in, then straight to the post', async ({
    page,
    api,
    db,
  }, testInfo) => {
    await fakeGoogleSignIn(page);
    await page.goto('/timeline/p1');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpengumuman%2Fp1$/);
    await expect(
      visibleText(page, 'Log in with your std email to get you in'),
    ).toBeVisible();
    // The production build has no test-login form, and nothing asked the API for the post.
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0);
    expect(api.calls('GET /api/info/:infoId')).toHaveLength(0);
    await checkGates(page, testInfo, 'login');

    api.on('POST /api/auth/login/accesstoken', () => {
      db.signedIn = true;
      return db.me;
    });
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page
      .getByRole('button', { name: 'Log in with Google' })
      .locator('visible=true')
      .click();
    // Deep links survive sign-in (SPEC "Information architecture and shell").
    await expect(page).toHaveURL(/\/pengumuman\/p1$/);
    await expect(
      visibleText(page, 'Jadwal UTS Ganjil 2026/2027 sudah keluar'),
    ).toBeVisible();
    expect(api.calls('POST /api/auth/login/accesstoken')[0].body).toEqual({
      accessToken: 'e2e-google-token',
    });
  });

  test('a redirect to another site is ignored: sign-in goes to Beranda', async ({
    page,
    api,
    db,
  }) => {
    await fakeGoogleSignIn(page);
    await page.goto(
      `/login?redirect=${encodeURIComponent('https://evil.example/')}`,
    );
    api.on('POST /api/auth/login/accesstoken', () => {
      db.signedIn = true;
      return db.me;
    });
    await page
      .getByRole('button', { name: 'Log in with Google' })
      .locator('visible=true')
      .click();
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
    await expect(greeting(page)).toBeVisible();
    expect(api.blocked.some((b) => b.path.includes('evil.example'))).toBe(
      false,
    );
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
    await fakeGoogleSignIn(page);
    await page.addInitScript(
      (user) => localStorage.setItem('user', JSON.stringify(user)),
      db.me,
    );
    await page.goto('/layanan/nim?q=nadia');
    await expect(page).toHaveURL(
      /\/login\?redirect=%2Flayanan%2Fnim%3Fq%3Dnadia$/,
    );
    // Review m5: the return itself, not only the kept page.
    api.on('POST /api/auth/login/accesstoken', () => {
      db.signedIn = true;
      return db.me;
    });
    await page
      .getByRole('button', { name: 'Log in with Google' })
      .locator('visible=true')
      .click();
    await expect(page).toHaveURL(/\/layanan\/nim\?q=nadia$/);
    await expect(
      page.getByPlaceholder('Ketik nama atau NIM').locator('visible=true'),
    ).toBeVisible();
  });
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
