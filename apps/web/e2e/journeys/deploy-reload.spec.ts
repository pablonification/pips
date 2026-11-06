/**
 * After a deploy (web-robust 6): the new service worker takes over open tabs and deletes the old build's files, so a
 * tab still on the old build can't load code it hasn't loaded yet. Here the old file "gone" is a 404 for its chunk.
 * - A route's code: TanStack Router's lazy routes already reload once (sessionStorage `tanstack_router_reload:…`);
 *   the first two tests hold that.
 * - Other code (Live Counting's socket code, lazy dialogs): `vite:preloadError` now reloads once
 *   (src/lib/preload-recovery.ts); before, Live Counting stayed off. The Live Counting recovery is in kelola.spec.ts.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

/** Counts full page loads. */
function countLoads(page: Page) {
  const seen = { loads: 0 };
  page.on('load', () => seen.loads++);
  return seen;
}

const dingdongLink = (page: Page) =>
  page.getByRole('main').getByRole('link', { name: /^Ding Dong/ });
const dingdongTitle = (page: Page) =>
  page.getByRole('heading', { name: 'Ding Dong', level: 1 });

test('a page whose code is gone after a deploy: one reload, then it opens', async ({
  page,
}) => {
  let gone = 1;
  await page.route('**/assets/dingdong-*.js', (route) =>
    gone-- > 0 ? route.fulfill({ status: 404, body: '' }) : route.fallback(),
  );
  const seen = countLoads(page);
  await page.goto('/layanan');
  await expect(dingdongLink(page)).toBeVisible();
  await dingdongLink(page).click();
  await expect.poll(() => seen.loads).toBe(2);
  // The failure may come from the link's preload (still on Layanan) or from opening it: either way, it opens now.
  if (!/\/layanan\/dingdong$/.test(page.url()))
    await dingdongLink(page).click();
  await expect(page).toHaveURL(/\/layanan\/dingdong$/);
  await expect(dingdongTitle(page)).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(seen.loads).toBe(2);
});

test('a file that is really missing: one reload only, then the error page (no loop)', async ({
  page,
}) => {
  await page.route('**/assets/dingdong-*.js', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  const seen = countLoads(page);
  await page.goto('/layanan/dingdong');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Bagian ini gagal dimuat.' }),
  ).toBeVisible();
  await page.waitForTimeout(1_500);
  expect(seen.loads).toBeLessThanOrEqual(2);
  const after = seen.loads;
  await page.waitForTimeout(1_500);
  expect(seen.loads).toBe(after);
});

test.describe('Raka (admin)', () => {
  test.use({ persona: 'pengurus' });
  // The gap: code that isn't a route's (Live Counting's socket code, lazy dialogs) had no such reload.
  test('Live Counting’s socket code really missing: one reload only, then the page without the live square (no loop)', async ({
    page,
  }) => {
    await page.route('**/assets/esm-*.js', (route) =>
      route.fulfill({ status: 404, body: '' }),
    );
    const seen = countLoads(page);
    await page.goto('/kelola/live/pixel');
    await expect.poll(() => seen.loads).toBe(2);
    await expect(
      page.getByRole('main').locator('.g-live-plaque .t-figure-xl'),
    ).toHaveText('142');
    await page.waitForTimeout(3_000);
    expect(seen.loads).toBe(2);
    await expect(page.locator('.g-live-plaque [data-live]')).toHaveCount(0);
  });
});
