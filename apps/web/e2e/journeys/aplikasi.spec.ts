/**
 * Apps connected through MCP: the consent page an app's sign-in sends the member to (`/hubungkan`), and
 * Profil › Aplikasi terhubung, where the member sees and revokes them.
 */
import type { Page } from '@playwright/test';
import { OAUTH_REQUEST_ID } from '../fixtures/api';
import { fakeGoogle, googleRequests } from '../support/google';
import { reply } from '../support/mock';
import { strictAudit, strictGates } from '../support/strict';
import { expect, test } from '../support/test';
import * as writes from '../support/writes';

const main = (page: Page) => page.getByRole('main');
const toastText = (page: Page, text: string) =>
  page.locator('.g-toast').filter({ hasText: text });
const CONSENT = `/hubungkan?permintaan=${OAUTH_REQUEST_ID}`;
/** The app's own address, where the browser goes after a choice. Answered here: no journey leaves for the internet. */
const APP = 'https://client.example';

async function appAnswers(page: Page) {
  await page.route(`${APP}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>app</title>' }),
  );
}

const approvals = (api: { calls: (k: string) => Array<{ body: unknown }> }) =>
  api.calls('POST /api/oauth/requests/:requestId/approve').map((c) => c.body);

test.describe('the consent page', () => {
  test('names the app as plain text, offers Write or Read, and Izinkan returns to the app with its code', async ({
    page,
    api,
  }, testInfo) => {
    await appAnswers(page);
    api.on(`POST /api/oauth/requests/:requestId/approve`, ({ params }) =>
      params.requestId === OAUTH_REQUEST_ID
        ? { redirectTo: `${APP}/callback?code=c0de&state=s1` }
        : reply.status(404, { error: 'Request not found' }),
    );
    await page.goto(CONSENT);
    await expect(
      page.getByRole('heading', {
        name: 'Claude ingin memakai PIPS! atas namamu',
      }),
    ).toBeVisible();
    await expect(page).toHaveTitle('Hubungkan aplikasi · PIPS!');
    await expect(
      main(page).getByText('Lalu kembali ke claude.ai.'),
    ).toBeVisible();
    const may = main(page).getByRole('group', {
      name: 'Yang boleh dilakukan aplikasi ini',
    });
    await expect(may.getByRole('radio')).toHaveCount(2);
    // What the app asked for is chosen first; Write says what it adds, Read needs no line.
    await expect(may.getByRole('radio', { name: /^Write/ })).toBeChecked();
    await expect(may.getByRole('radio', { name: /^Read/ })).not.toBeChecked();
    await expect(may).toContainText(
      'Juga mengirim, mengubah dan menghapus atas namamu',
    );
    await expect(main(page)).toContainText('Curhat Yuk! tidak termasuk.');
    // The app's name is never a link.
    await expect(main(page).getByRole('link', { name: /Claude/ })).toHaveCount(
      0,
    );
    // A focused flow: no tab bar or rail.
    await expect(
      page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .locator('visible=true'),
    ).toHaveCount(testInfo.project.name.includes('desktop') ? 1 : 0);
    await strictGates(page, testInfo, 'hubungkan', null);

    await main(page).getByRole('button', { name: 'Izinkan' }).click();
    await expect(page).toHaveURL(`${APP}/callback?code=c0de&state=s1`);
    expect(approvals(api)).toEqual([{ scopes: ['pips.read', 'pips.write'] }]);
  });

  test('Read lets the app read only: Izinkan sends only pips.read', async ({
    page,
    api,
  }, testInfo) => {
    await appAnswers(page);
    api.on('POST /api/oauth/requests/:requestId/approve', () => ({
      redirectTo: `${APP}/callback?code=c0de&state=s1`,
    }));
    await page.goto(CONSENT);
    const may = main(page).getByRole('group', {
      name: 'Yang boleh dilakukan aplikasi ini',
    });
    // The whole row is the target, and arrow keys move the choice.
    await may.getByText('Read', { exact: true }).click();
    await expect(may.getByRole('radio', { name: /^Read/ })).toBeChecked();
    await expect(may.getByRole('radio', { name: /^Write/ })).not.toBeChecked();
    await strictGates(page, testInfo, 'hubungkan-hanya-baca', null);
    await may.getByRole('radio', { name: /^Read/ }).focus();
    await page.keyboard.press('ArrowUp');
    await expect(may.getByRole('radio', { name: /^Write/ })).toBeChecked();
    await page.keyboard.press('ArrowDown');
    await expect(may.getByRole('radio', { name: /^Read/ })).toBeChecked();

    await main(page).getByRole('button', { name: 'Izinkan' }).click();
    await expect(page).toHaveURL(`${APP}/callback?code=c0de&state=s1`);
    expect(approvals(api)).toEqual([{ scopes: ['pips.read'] }]);
  });

  test('a read-only request shows only reading, with no choice; Tolak returns to the app with access_denied', async ({
    page,
    api,
    db,
  }) => {
    await appAnswers(page);
    db.oauthRequests[OAUTH_REQUEST_ID].scopes = ['pips.read'];
    api.on('POST /api/oauth/requests/:requestId/deny', () => ({
      redirectTo: `${APP}/callback?error=access_denied&state=s1`,
    }));
    await page.goto(CONSENT);
    const may = main(page).getByRole('list', {
      name: 'Yang boleh dilakukan aplikasi ini',
    });
    await expect(may.getByRole('listitem')).toHaveCount(1);
    await expect(may).toContainText('Read');
    await expect(main(page).getByRole('radio')).toHaveCount(0);
    await main(page).getByRole('button', { name: 'Tolak' }).click();
    await expect(page).toHaveURL(
      `${APP}/callback?error=access_denied&state=s1`,
    );
    expect(
      api.calls('POST /api/oauth/requests/:requestId/approve'),
    ).toHaveLength(0);
  });

  test('an app with no name, or a name with markup, is shown as text', async ({
    page,
    db,
  }) => {
    db.oauthRequests[OAUTH_REQUEST_ID].clientName =
      '<img src=x onerror=alert(1)>';
    await page.goto(CONSENT);
    await expect(
      page.getByRole('heading', {
        name: '<img src=x onerror=alert(1)> ingin memakai PIPS! atas namamu',
      }),
    ).toBeVisible();
    await expect(main(page).locator('img[src="x"]')).toHaveCount(0);

    db.oauthRequests[OAUTH_REQUEST_ID].clientName = '';
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: 'Aplikasi tanpa nama ingin memakai PIPS! atas namamu',
      }),
    ).toBeVisible();
  });

  test('an expired or answered request, or none in the address, says so and offers Beranda', async ({
    page,
  }, testInfo) => {
    await page.goto('/hubungkan?permintaan=sudah-habis');
    await expect(
      main(page).getByText('Permintaan ini sudah tidak berlaku'),
    ).toBeVisible();
    await expect(
      main(page).getByText(
        'Mulai lagi dari aplikasinya untuk menghubungkan PIPS!.',
      ),
    ).toBeVisible();
    await strictGates(page, testInfo, 'hubungkan-habis', null);
    await main(page).getByRole('link', { name: 'Ke Beranda' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/hubungkan');
    await expect(
      main(page).getByText('Permintaan ini sudah tidak berlaku'),
    ).toBeVisible();
  });

  test('a failed load says so with Coba lagi, which recovers', async ({
    page,
    api,
    db,
  }) => {
    let fail = true;
    api.on('GET /api/oauth/requests/:requestId', ({ params }) =>
      fail
        ? reply.status(500, { error: 'Something went wrong' })
        : db.oauthRequests[params.requestId],
    );
    await page.goto(CONSENT);
    await expect(
      main(page).getByText('Permintaan gagal dimuat.'),
    ).toBeVisible();
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'Claude ingin memakai PIPS! atas namamu',
      }),
    ).toBeVisible();
  });

  test('a failed Izinkan keeps the member on the page with a toast; a second press sends again', async ({
    page,
    api,
  }) => {
    await appAnswers(page);
    let fail = true;
    api.on('POST /api/oauth/requests/:requestId/approve', () =>
      fail
        ? reply.status(500, { error: 'Something went wrong' })
        : { redirectTo: `${APP}/callback?code=c0de` },
    );
    await page.goto(CONSENT);
    await main(page).getByRole('button', { name: 'Izinkan' }).click();
    await expect(
      toastText(
        page,
        'Pilihanmu gagal dikirim. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${CONSENT.replace('?', '\\?')}$`));
    fail = false;
    await main(page).getByRole('button', { name: 'Izinkan' }).click();
    await expect(page).toHaveURL(`${APP}/callback?code=c0de`);
  });
});

test.describe('signed out', () => {
  test.use({ signedIn: false });

  test('the consent page leads to sign-in, then straight back to the request', async ({
    page,
    api,
  }) => {
    await fakeGoogle(page.context());
    await page.goto(CONSENT);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?redirect=${encodeURIComponent(CONSENT)}$`),
    );
    expect(api.calls('GET /api/oauth/requests/:requestId')).toHaveLength(0);
    api.on('POST /api/auth/login/accesstoken', writes.loginAccessToken);
    await expect
      .poll(async () => (await googleRequests(page)).clients.length)
      .toBe(1);
    await page
      .getByRole('button', { name: /^Masuk dengan akun STEI$/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`${CONSENT.replace('?', '\\?')}$`));
    await expect(
      page.getByRole('heading', {
        name: 'Claude ingin memakai PIPS! atas namamu',
      }),
    ).toBeVisible();
  });
});

test.describe('Profil › Aplikasi terhubung', () => {
  test('Profil opens it; each app says whether it may only read or also change, and when it was connected and last used', async ({
    page,
  }, testInfo) => {
    await page.goto('/profil');
    await main(page)
      .getByRole('link', { name: /^Aplikasi terhubung$/ })
      .click();
    await expect(page).toHaveURL(/\/profil\/aplikasi$/);
    await expect(page).toHaveTitle('Aplikasi terhubung · PIPS!');
    const row = main(page).getByRole('listitem').filter({ hasText: 'Claude' });
    await expect(row).toContainText('Write · Terhubung');
    await expect(row).toContainText('Terakhir dipakai 1 jam lalu');
    const readOnly = main(page)
      .getByRole('listitem')
      .filter({ hasText: 'Catatan Kuliah' });
    await expect(readOnly).toContainText('Read · Terhubung');
    await expect(
      row.getByRole('button', { name: 'Putuskan Claude' }),
    ).toBeVisible();
    await strictGates(page, testInfo, 'aplikasi', 'Profil');
  });

  test('Putuskan asks first, then revokes; the list is then empty and says how to connect one', async ({
    page,
    api,
    db,
  }, testInfo) => {
    db.connectedApps = db.connectedApps.filter((a) => a.name === 'Claude');
    api.on('DELETE /api/oauth/apps/:clientId', ({ params }) => {
      const before = db.connectedApps.length;
      db.connectedApps = db.connectedApps.filter(
        (a) => a.clientId !== params.clientId,
      );
      return db.connectedApps.length < before
        ? {}
        : reply.status(404, { error: 'App not connected' });
    });
    await page.goto('/profil/aplikasi');
    await main(page).getByRole('button', { name: 'Putuskan Claude' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Putuskan Claude?' });
    await expect(dialog).toContainText(
      'Claude tidak bisa lagi memakai PIPS! atas namamu.',
    );
    await strictAudit(page, testInfo, 'aplikasi-putuskan');
    await dialog.getByRole('button', { name: 'Batal' }).click();
    await expect(dialog).toBeHidden();
    expect(api.calls('DELETE /api/oauth/apps/:clientId')).toHaveLength(0);

    await main(page).getByRole('button', { name: 'Putuskan Claude' }).click();
    await dialog.getByRole('button', { name: 'Putuskan' }).click();
    await expect(toastText(page, 'Claude diputus dari PIPS!.')).toBeVisible();
    expect(
      api.calls('DELETE /api/oauth/apps/:clientId').map((c) => c.path),
    ).toEqual(['/api/oauth/apps/pips_client_claude']);
    await expect(
      main(page).getByText('Belum ada aplikasi terhubung'),
    ).toBeVisible();
    await expect(main(page)).toContainText('/mcp');
    await strictGates(page, testInfo, 'aplikasi-kosong', 'Profil');
  });

  test('a failed revoke keeps the app and says so', async ({ page, api }) => {
    api.on(
      'DELETE /api/oauth/apps/:clientId',
      reply.status(500, { error: 'Something went wrong' }),
    );
    await page.goto('/profil/aplikasi');
    await main(page).getByRole('button', { name: 'Putuskan Claude' }).click();
    await page
      .getByRole('alertdialog', { name: 'Putuskan Claude?' })
      .getByRole('button', { name: 'Putuskan' })
      .click();
    await expect(
      toastText(
        page,
        'Claude gagal diputus. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(
      main(page).getByRole('button', { name: 'Putuskan Claude' }),
    ).toBeVisible();
  });

  test('a failed load says so with Coba lagi, which recovers', async ({
    page,
    api,
    db,
  }, testInfo) => {
    let fail = true;
    api.on('GET /api/oauth/apps', () =>
      fail
        ? reply.status(500, { error: 'Something went wrong' })
        : { apps: db.connectedApps },
    );
    await page.goto('/profil/aplikasi');
    await expect(
      main(page).getByText('Aplikasi terhubung gagal dimuat.'),
    ).toBeVisible();
    await strictGates(page, testInfo, 'aplikasi-gagal', 'Profil');
    fail = false;
    await main(page).getByRole('button', { name: 'Coba lagi' }).click();
    await expect(
      main(page).getByRole('button', { name: 'Putuskan Claude' }),
    ).toBeVisible();
  });
});
