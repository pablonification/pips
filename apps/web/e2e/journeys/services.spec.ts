import { expect, test } from '../support/test';

// Ding Dong and Info Lomba are checked in dingdong.spec.ts and lomba.spec.ts (P2-B), which replaced today's tests
// here.

test('external services keep their s.hmif.dev links', async ({ page }) => {
  await page.goto('/');
  // Stand in for the external site, so the test never leaves this machine.
  await page.route('http://s.hmif.dev/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<title>Mading Beasiswa</title>',
    }),
  );
  await page
    .getByRole('button', { name: 'Mading Beasiswa' })
    .locator('visible=true')
    .click();
  // Today's app opens it in the same tab, over plain http.
  await expect(page).toHaveURL('http://s.hmif.dev/MadingBeasiswa');
});
