import { checkGates } from '../support/audit';
import { visibleText } from '../support/app';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('a shared post link leads to sign-in, then to the post', async ({
    page,
    api,
    db,
  }, testInfo) => {
    await page.goto('/timeline/p1');
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      visibleText(page, 'Log in with your std email to get you in'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('button', { name: 'Log in with Google' })
        .locator('visible=true'),
    ).toBeVisible();
    // The production build has no test-login form, and nothing asked the API for the post.
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(0);
    expect(api.calls('GET /api/info/:infoId')).toHaveLength(0);
    await checkGates(page, testInfo, 'login');

    // Google's popup can't run here. After it, the API sets the session and the app caches the member, as below.
    db.signedIn = true;
    api.on('POST /api/info/:infoId/read', writes.markRead);
    await page.evaluate(
      (user) => localStorage.setItem('user', JSON.stringify(user)),
      db.me,
    );
    // Today's app forgets the link it was opened with, so the member opens it again.
    await page.goto('/timeline/p1');
    await expect(
      visibleText(page, 'Jadwal UTS Ganjil 2026/2027 sudah keluar'),
    ).toBeVisible();
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
});

test.describe('not installed', () => {
  test.use({ installed: false });

  test('a phone browser is asked to install the app first @phone-only', async ({
    page,
  }, testInfo) => {
    await page.goto('/home');
    await expect(page.getByText(/install/i).first()).toBeVisible();
    await expect(page.getByText('Hi, Nadia Putri!')).toHaveCount(0);
    await checkGates(page, testInfo, 'install');
  });

  test('a desktop browser opens the app without installing @desktop-only', async ({
    page,
  }) => {
    await page.goto('/home');
    await expect(visibleText(page, 'Hi, Nadia Putri!')).toBeVisible();
  });
});
