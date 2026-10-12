/**
 * Visual regression: screenshots compared with committed reference images (`toHaveScreenshot`).
 *
 * Today's app has none; the redesign adds a state to VISUAL_STATES for each screen it finishes, then records
 * the references with `pnpm --filter web e2e:update` and commits them (in e2e/visual/visual.spec.ts-snapshots/).
 * References change only through that command, and their diffs are reviewed in the pull request. Produce them in
 * the CI container (the e2e job uploads its results), so font rendering matches where they are checked.
 */
import { expect, test } from '../support/test';
import type { CaptureState } from '../capture/states';

/** States with committed references. Same shape as capture/states.ts. */
export const VISUAL_STATES: CaptureState[] = [];

for (const state of VISUAL_STATES) {
  test.describe(state.id, () => {
    test.use({
      persona: state.persona ?? 'anggota',
      signedIn: state.signedIn ?? true,
      installed: state.installed ?? true,
    });
    const tag =
      state.only === 'phone'
        ? ' @phone-only'
        : state.only === 'desktop'
          ? ' @desktop-only'
          : '';
    test(`${state.id}${tag}`, async ({ page, api, context }) => {
      await state.prepare?.(page);
      state.mock?.(api);
      await page.goto(state.path);
      await state.act?.(page, { api, context });
      await expect(state.ready(page)).toBeVisible();
      await expect(page).toHaveScreenshot(`${state.id}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.001,
      });
    });
  });
}
