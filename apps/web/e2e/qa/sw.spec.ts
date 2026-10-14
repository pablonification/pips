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
  const paint = await page.evaluate(() => ({
    fcp:
      performance
        .getEntriesByType('paint')
        .find((e) => e.name === 'first-contentful-paint')?.startTime ?? null,
  }));
  await testInfo.attach('installed-offline-launch.json', {
    body: JSON.stringify({ launchMs, ...paint }),
    contentType: 'application/json',
  });
  // SPEC: the installed app's launch from the service worker paints within 1 s (unthrottled here: a floor, not the lab).
  expect(paint.fcp ?? Infinity).toBeLessThan(1000);
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
