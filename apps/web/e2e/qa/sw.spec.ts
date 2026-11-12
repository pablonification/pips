/**
 * F2 (brief steps 7, 10 and 15) on the qa-sw project, the only one where the app's service worker runs
 * (`serviceWorkers: 'allow'`): the installed app opening with no network. Once the worker controls the page, the
 * network goes and the app is opened again: the shell comes from the worker's precache and the saved data from
 * IndexedDB, under the offline line. Also the share target: a photo shared to PIPS! opens Buat pengumuman with it.
 */
import { greeting } from '../support/app';
import { expect, test } from '../support/test';

test.describe.configure({ mode: 'serial' });

async function controlled(page: import('@playwright/test').Page) {
  // The app registers its worker once the page has settled and the browser is idle (src/lib/sw-register.ts).
  await page
    .waitForFunction(() => !!navigator.serviceWorker?.controller, undefined, {
      timeout: 45_000,
    })
    .catch(async () => {
      await page.reload();
      await page.waitForFunction(
        () => !!navigator.serviceWorker?.controller,
        undefined,
        {
          timeout: 30_000,
        },
      );
    });
}

test('a cold start offline as the installed app: the shell and the saved Beranda, under the offline line', async ({
  page,
  api,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'qa-sw', 'qa-sw');
  await page.goto('/');
  await expect(greeting(page)).toBeVisible();
  await controlled(page);
  // Let the persisted cache be written (at most once a second).
  await page.waitForTimeout(1500);
  await api.setOffline(true);
  const t0 = Date.now();
  await page.reload();
  await expect(greeting(page)).toBeVisible({ timeout: 15_000 });
  const launchMs = Date.now() - t0;
  await expect(page.getByText(/^Offline/).first()).toBeVisible();
  const fcp = await page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        new PerformanceObserver((list) => {
          const e = list
            .getEntries()
            .find((x) => x.name === 'first-contentful-paint');
          if (e) resolve(e.startTime);
        }).observe({ type: 'paint', buffered: true });
        setTimeout(() => resolve(null), 2000);
      }),
  );
  await testInfo.attach('installed-offline-launch.json', {
    body: JSON.stringify({ launchMs, fcp }),
    contentType: 'application/json',
  });
  // SPEC: the installed app's launch from the service worker, FCP ≤ 1 s and LCP ≤ 2 s. Unthrottled here, so this is
  // a floor, not the lab: the page's content (the greeting) within 2 s of the reload.
  expect(launchMs).toBeLessThan(2000);
  if (fcp !== null) expect(fcp).toBeLessThan(1000);
  await api.setOffline(false);
});

test('the share target opens Buat pengumuman with what was shared', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'qa-sw', 'qa-sw');
  await page.goto('/');
  await expect(greeting(page)).toBeVisible();
  await controlled(page);
  // What Android sends when a member shares a link to the installed app (manifest share_target, POST multipart).
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/share-file-handler';
    form.enctype = 'multipart/form-data';
    for (const [k, v] of [
      ['title', 'Lomba UI/UX'],
      ['text', 'Pendaftaran dibuka sampai Jumat'],
      ['url', 'https://example.com/lomba'],
    ]) {
      const input = document.createElement('input');
      input.name = k;
      input.value = v;
      form.append(input);
    }
    document.body.append(form);
    form.submit();
  });
  await expect(page).toHaveURL(/\/pengumuman\/tulis$/);
  await expect(page.getByRole('textbox').first()).toBeVisible();
  const fields = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      ),
    ]
      .map((f) => f.value)
      .join(' | '),
  );
  expect(fields).toContain('Lomba UI/UX');
});

test('another website cannot fill in Buat pengumuman through the share target', async ({
  page,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'qa-sw', 'qa-sw');
  await page.goto('/');
  await expect(greeting(page)).toBeVisible();
  await controlled(page);
  // The same server under another name is another site: its form posts carry its own origin.
  const elsewhere = `${baseURL!.replace('127.0.0.1', 'localhost')}/elsewhere`;
  await page.route(elsewhere, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<form method="post" enctype="multipart/form-data" action="${baseURL}/share-file-handler">
        <input name="title" value="Judul dari situs lain">
        <input name="text" value="Teks dari situs lain">
      </form>`,
    }),
  );
  await page.goto(elsewhere);
  await page.evaluate(() => document.querySelector('form')!.submit());
  await page.waitForURL((url) => url.origin === baseURL);
  await page.goto('/pengumuman/tulis');
  await expect(page.getByRole('textbox').first()).toBeVisible();
  const fields = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      ),
    ]
      .map((f) => f.value)
      .join(' | '),
  );
  expect(fields).not.toContain('situs lain');
});

test.describe('a new version while writing', () => {
  // The real clock: the service worker's install and takeover run on the browser's own timers.
  test.use({ now: null });

  test('a new version arriving while Buat pengumuman holds text waits; the text stays, and the next page loads it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'qa-sw', 'qa-sw');
    await page.goto('/');
    await expect(greeting(page)).toBeVisible();
    await controlled(page);
    // The app registers its worker on each page once it has settled; it listens for a new version from then on.
    const registering = page.waitForRequest(/workbox-window/, {
      timeout: 30_000,
    });
    await page.goto('/pengumuman/tulis');
    const body = page.getByRole('textbox', { name: 'Isi pengumuman' });
    await expect(body).toBeVisible();
    await registering;
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    let loads = 0;
    page.on('load', () => loads++);
    await page.getByRole('textbox', { name: /^Judul/ }).fill('Kuis 2');
    await body.fill('Kuis 2 dimajukan.');

    // A deploy: a worker the page didn't register takes over, as the next version does. (The preview server's ETag
    // doesn't change with the file, and a worker's update check isn't routed, so a changed sw.js can't stand in.)
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          navigator.serviceWorker.addEventListener('controllerchange', () =>
            resolve(),
          );
          navigator.serviceWorker
            .register('/sw.js?e2e=next-version')
            .catch(reject);
        }),
    );
    // The new version controls the page; the app was told and may reload now if it is going to.
    await page.waitForTimeout(2_000);
    expect(loads, 'no reload while text is in the composer').toBe(0);
    await expect(page.getByRole('textbox', { name: /^Judul/ })).toHaveValue(
      'Kuis 2',
    );
    await expect(body).toHaveValue('Kuis 2 dimajukan.');

    // Leaving for another page applies it.
    await page.getByRole('button', { name: 'Batal' }).click();
    await expect.poll(() => loads).toBe(1);
    await expect(page).toHaveURL(/\/pengumuman$/);
  });
});
