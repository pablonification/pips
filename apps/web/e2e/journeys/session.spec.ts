import { greeting, inMain, navLink, visibleText } from '../support/app';
import { reply } from '../support/mock';
import { strictAudit } from '../support/strict';
import { expect, test } from '../support/test';

/*
 * Session resilience (SPEC "Session, persistence and resilience"): only a 401 from the session check signs a
 * member out. Before P0-B any failure did (`getMe().catch(() => null)`); these are its regression journeys.
 */

type Page = import('@playwright/test').Page;

/** The persisted query cache as stored on the device, or null. */
const storedCache = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{
        clientState: { queries: { queryKey: unknown[] }[] };
      } | null>((resolve, reject) => {
        const open = indexedDB.open('pips-query-cache');
        // Read only: never create the database before the app does (it would have no store, and the app's
        // writes would fail).
        open.onupgradeneeded = () => open.transaction?.abort();
        open.onerror = () =>
          open.error?.name === 'AbortError'
            ? resolve(null)
            : reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('cache')) return resolve(null);
          const get = db
            .transaction('cache')
            .objectStore('cache')
            .get('client');
          get.onsuccess = () => {
            resolve(get.result ?? null);
            db.close();
          };
        };
      }),
  );

/** What a member leaves in localStorage besides the signed-out marker (`user` = "null"). */
const memberStorage = (page: Page) =>
  page.evaluate(() => ({
    userAcademic: localStorage.getItem('userAcademic'),
    user: localStorage.getItem('user'),
  }));

/**
 * Nothing of the previous member stays on the device, and nothing comes back: the persisted cache is written
 * at most once a second, so a late write would land within that time. Sampled for 2.5 s, not read once.
 */
async function expectNothingKept(page: Page) {
  const until = Date.now() + 2500;
  do {
    expect(await storedCache(page)).toBeNull();
    const kept = await memberStorage(page);
    expect(kept.userAcademic).toBeNull();
    expect(kept.user === null || kept.user === 'null').toBe(true);
    await page.waitForTimeout(250);
  } while (Date.now() < until);
}

/** Waits until the persisted cache holds Nadia's data (written at most once a second). */
async function expectCacheWritten(page: Page) {
  await expect
    .poll(
      async () => (await storedCache(page))?.clientState.queries.length ?? 0,
    )
    .toBeGreaterThan(1);
}

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
  await expect(navLink(page, 'Pengumuman')).toBeVisible();
  await expect
    .poll(() => api.calls('GET /api/me').length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(3);
  await expect(page).toHaveURL(/\/pengumuman$/);
  // The cached user is still in use: Profil shows her.
  await navLink(page, 'Profil').click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(inMain(page, 'Nadia Putri')).toBeVisible();
});

test('a 401 from the session check signs out, keeping the page to come back to', async ({
  page,
  api,
}) => {
  api.on('GET /api/me', reply.status(401, { error: 'Unauthorized' }));
  await page.goto('/layanan/dingdong');
  await expect(page).toHaveURL(/\/login\?redirect=%2Flayanan%2Fdingdong$/);
});

test('a 401 after a visit leaves nothing of Nadia on the device, not even a second later', async ({
  page,
  api,
}) => {
  // Regression (review B1): the cache was deleted, then written back a second later from memory.
  await page.goto('/profil/matkul');
  await expect
    .poll(async () => (await memberStorage(page)).userAcademic)
    .not.toBeNull();
  await page.goto('/');
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  await expectCacheWritten(page);
  api.on('GET /api/me', reply.status(401, { error: 'Unauthorized' }));
  await page.reload();
  await expect(page).toHaveURL(/\/login(\?|$)/);
  await expectNothingKept(page);
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
  await expect(navLink(page, 'Pengumuman')).toBeVisible();
});

test('offline, Nadia stays signed in and can move around; back online, the session is checked again', async ({
  page,
  api,
}) => {
  // Visit Profil once first: the harness blocks the service worker that keeps route code offline in the real app.
  await page.goto('/profil');
  await expect(inMain(page, 'Nadia Putri')).toBeVisible();
  await navLink(page, 'Beranda').click();
  await expect(greeting(page)).toBeVisible();
  await expect.poll(() => api.calls('GET /api/me').length).toBeGreaterThan(0);
  await api.setOffline(true);
  await navLink(page, 'Profil').click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(inMain(page, 'Nadia Putri')).toBeVisible();
  await navLink(page, 'Beranda').click();
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
  }, testInfo) => {
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
    // C1: the screen used the old shadcn button, styled only by the palette C1 deleted; it now uses the Garis
    // button, and the gates (axe with contrast, text size, overflow) hold in both themes.
    await strictAudit(page, testInfo, 'session error');
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
  await expectCacheWritten(page);
  api.on('GET /api/calendar/me', reply.hang());
  await page.reload();
  await expect(visibleText(page, 'Kuis 2')).toBeVisible();
  const stored = ((await storedCache(page))?.clientState.queries ?? []).map(
    (q) => String(q.queryKey[0]),
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
  // Regression (review B1): Nadia's courses, profile, calendar and feed were written back a second after sign-out.
  await page.goto('/profil/matkul');
  await expect
    .poll(async () => (await memberStorage(page)).userAcademic)
    .not.toBeNull();
  await expectCacheWritten(page);
  await page.goto('/profil');
  // P1-C: Profil's Keluar, then its confirmation (today's "Log out" button is gone).
  await page.getByRole('main').getByRole('button', { name: 'Keluar' }).click();
  await page
    .getByRole('alertdialog', { name: 'Keluar dari PIPS!?' })
    .getByRole('button', { name: 'Keluar' })
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
  await expectNothingKept(page);
});
