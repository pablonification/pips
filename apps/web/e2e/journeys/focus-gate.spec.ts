/**
 * The strict gate's focus check (support/strict.ts, review m7) must fail on a control with no focus style. Garis
 * buttons, switches and chips carry a shadow at rest, which the first version of the gate took for a focus ring.
 * Each case removes one component's focus style on a redesigned screen and expects the gate to fail on it; the
 * same screens pass the gate unchanged in their own journeys (profil, notifikasi, matkul).
 */
import { expectVisibleFocus } from '../support/strict';
import { expect, test } from '../support/test';

const CASES = [
  {
    what: 'a Garis button (Keluar)',
    url: '/profil',
    ready: 'Keluar',
    css: '.g-btn:focus-visible { outline: none !important; }',
    fails: /focus indicator on BUTTON\|\|Keluar\|/,
  },
  {
    what: 'a Garis switch (a category)',
    url: '/profil/notifikasi',
    ready: 'Lomba',
    css: '.g-switch:focus-visible { outline: none !important; }',
    fails: /focus indicator on BUTTON\[switch\]\|/,
  },
  {
    what: 'a Garis chip (a class K1–K3)',
    url: '/profil/matkul/tambah',
    ready: 'K1',
    css: '.g-chip:focus-visible { outline: none !important; }',
    fails: /focus indicator on BUTTON\[radio\]\|\|K1\|/,
  },
] as const;

for (const c of CASES) {
  test(`the focus gate fails on ${c.what} with no focus style`, async ({
    page,
  }) => {
    await page.goto(c.url);
    await expect(
      page.getByRole('main').getByText(c.ready, { exact: true }).first(),
    ).toBeVisible();
    await page.addStyleTag({ content: c.css });
    await expect(expectVisibleFocus(page, 80)).rejects.toThrow(c.fails);
  });
}

test('the focus gate passes the same screens with their focus styles', async ({
  page,
}) => {
  for (const c of CASES) {
    await page.goto(c.url);
    await expect(
      page.getByRole('main').getByText(c.ready, { exact: true }).first(),
    ).toBeVisible();
    await expectVisibleFocus(page, 80);
  }
});
