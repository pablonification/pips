/**
 * The strict gate's 16 px check for touch layouts (support/strict.ts, `touchInputsUnder16`). A field under 16 px
 * makes a phone zoom on focus, so it fails; a file input takes no typed text and never zooms, so it doesn't count.
 * Regression (F1): Buat pengumuman's visually hidden photo input failed the gate.
 */
import { touchInputsUnder16 } from '../support/strict';
import { expect, test } from '../support/test';

test('Buat pengumuman’s hidden photo input doesn’t count; a text field under 16 px does @phone-only', async ({
  page,
}) => {
  await page.goto('/pengumuman/tulis');
  const title = page.getByRole('main').getByRole('textbox', { name: /^Judul/ });
  await expect(title).toBeVisible();
  await expect(page.locator('input[type="file"]')).toBeAttached();
  expect(await touchInputsUnder16(page)).toEqual([]);
  await page.addStyleTag({
    content:
      'input[type="text"], input:not([type]) { font-size: 14px !important; }',
  });
  expect((await touchInputsUnder16(page)).length).toBeGreaterThan(0);
});
