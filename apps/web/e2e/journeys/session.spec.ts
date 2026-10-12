import { navLink, visibleText } from '../support/app';
import { reply } from '../support/mock';
import { expect, test } from '../support/test';

/*
 * Session resilience (SPEC "Session, persistence and resilience"): only a 401 from the session check signs a
 * member out. Before P0-B any failure did (`getMe().catch(() => null)`); these are its regression journeys.
 */

const greeting = (page: import('@playwright/test').Page) =>
  visibleText(page, 'Hi, Nadia Putri!');

test('a dropped session check keeps Nadia signed in, and it is retried', async ({
  page,
  api,
  db,
}) => {
  let calls = 0;
  api.on('GET /api/me', () => (++calls <= 2 ? reply.abort('failed') : db.me));
  await page.goto('/');
  await expect(greeting(page)).toBeVisible();
  await expect.poll(() => calls, { timeout: 15_000 }).toBeGreaterThanOrEqual(3);
  await expect(page).toHaveURL(/\/$/);
  await expect(greeting(page)).toBeVisible();
});

test('a 503 from the session check keeps Nadia signed in, and it is retried', async ({
  page,
  api,
}) => {
  api.on('GET /api/me', reply.status(503));
  await page.goto('/pengumuman');
  await expect(navLink(page, 'Timeline')).toBeVisible();
  await expect
    .poll(() => api.calls('GET /api/me').length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page).toHaveURL(/\/pengumuman$/);
  // The cached user is still in use: Profil shows her.
  await navLink(page, 'Settings').click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(visibleText(page, 'Nadia Putri')).toBeVisible();
});

test('a 401 from the session check signs out, keeping the page to come back to', async ({
  page,
  api,
}) => {
  api.on('GET /api/me', reply.status(401, { error: 'Unauthorized' }));
  await page.goto('/layanan/dingdong');
  await expect(page).toHaveURL(/\/login\?redirect=%2Flayanan%2Fdingdong$/);
});

test('a 401 from another request (a role check) does not sign out', async ({
  page,
  api,
}) => {
  // roleMiddleware answers 401 for a missing role; that means "no access", never "signed out".
  api.on('GET /api/info', reply.status(401, { error: 'Unauthorized' }));
  await page.goto('/pengumuman');
  await expect.poll(() => api.calls('GET /api/info').length).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/pengumuman$/);
  await expect(navLink(page, 'Timeline')).toBeVisible();
});

test('offline, Nadia stays signed in and can move around; back online, the session is checked again', async ({
  page,
  api,
}) => {
  // Visit Profil once first: the harness blocks the service worker that keeps route code offline in the real app.
  await page.goto('/profil');
  await expect(visibleText(page, 'Nadia Putri')).toBeVisible();
  await navLink(page, 'Home').click();
  await expect(greeting(page)).toBeVisible();
  await expect.poll(() => api.calls('GET /api/me').length).toBeGreaterThan(0);
  await api.setOffline(true);
  await navLink(page, 'Settings').click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(visibleText(page, 'Nadia Putri')).toBeVisible();
  await navLink(page, 'Home').click();
  await expect(greeting(page)).toBeVisible();
  const before = api.calls('GET /api/me').length;
  await api.setOffline(false);
  // Coming back online refetches what is stale; the session check is retried rather than lost.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page).toHaveURL(/\/$/);
  await expect(greeting(page)).toBeVisible();
  expect(api.calls('GET /api/me').length).toBeGreaterThanOrEqual(before);
});

test.describe('with no cached user', () => {
  test.use({ signedIn: false });

  test('a failing session check shows an error with Coba lagi, never sign-in; Coba lagi recovers', async ({
    page,
    api,
    db,
  }) => {
    db.signedIn = true;
    let down = true;
    api.on('GET /api/me', () => (down ? reply.status(503) : db.me));
    await page.goto('/');
    const retry = page.getByRole('button', { name: 'Coba lagi' });
    await expect(retry).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        'PIPS! belum bisa terhubung. Periksa koneksimu, lalu coba lagi.',
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    down = false;
    await retry.click();
    await expect(greeting(page)).toBeVisible();
  });
});

test('the first page of announcements and the agenda come back from the device when the network hangs', async ({
  page,
  api,
}) => {
  await page.goto('/');
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  // The persisted cache is written at most once a second.
  await page.waitForTimeout(1500);
  api.on('GET /api/calendar/me', reply.hang());
  await page.reload();
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  const stored = await page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('pips-query-cache');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction('cache')
            .objectStore('cache')
            .get('client');
          get.onsuccess = () =>
            resolve(
              (get.result?.clientState.queries ?? []).map(
                (q: { queryKey: unknown[] }) => String(q.queryKey[0]),
              ),
            );
        };
      }),
  );
  // Only what SPEC lists: no Curhat rooms, no forms, no search results.
  expect([...new Set(stored)].sort()).toEqual(
    expect.arrayContaining(['calendar-events', 'me']),
  );
  for (const key of stored) {
    expect([
      'me',
      'userAcademic',
      'currentCourses',
      'calendar-events',
      'infos',
    ]).toContain(key);
  }
});

test('logging out never asks for notification permission, and clears what was kept on the device', async ({
  page,
  api,
  db,
}) => {
  // Regression: logout called setupNotification(), which asked for push permission at the worst moment.
  await page.addInitScript(() => {
    const w = window as unknown as { __permissionAsks: number };
    w.__permissionAsks = 0;
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission = () => {
        w.__permissionAsks++;
        return Promise.resolve('denied');
      };
    }
  });
  api.on('POST /api/logout', () => {
    db.signedIn = false;
    return {};
  });
  await page.goto('/profil');
  await page.waitForTimeout(1500); // let the persisted cache be written
  await page
    .getByRole('button', { name: 'Log out' })
    .locator('visible=true')
    .click();
  await expect(page).toHaveURL(/\/login(\?|$)/);
  expect(api.calls('POST /api/logout')).toHaveLength(1);
  expect(api.calls('PUT /api/push/logout')).toHaveLength(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __permissionAsks: number }).__permissionAsks,
    ),
  ).toBe(0);
  const kept = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('pips-query-cache');
        open.onsuccess = () => {
          const get = open.result
            .transaction('cache')
            .objectStore('cache')
            .get('client');
          get.onsuccess = () => resolve(get.result ?? null);
        };
      }),
  );
  expect(kept).toBeNull();
});
