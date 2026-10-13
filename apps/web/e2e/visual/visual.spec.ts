/**
 * Visual regression: screenshots compared with committed reference images (`toHaveScreenshot`).
 *
 * Today's app has none; the redesign adds a state to VISUAL_STATES for each screen it finishes, then records
 * the references with `pnpm --filter web e2e:update` and commits them (in e2e/visual/visual.spec.ts-snapshots/).
 * References change only through that command, and their diffs are reviewed in the pull request. Produce them in
 * the CI container (the e2e job uploads its results), so font rendering matches where they are checked.
 */
import { expect, test } from '../support/test';
import { STATES, type CaptureState } from '../capture/states';

const fromStates = (ids: string[]) =>
  ids.map((id) => {
    const state = STATES.find((s) => s.id === id);
    if (!state) throw new Error(`visual: no capture state ${id}`);
    return state;
  });

/** States with committed references. Same shape as capture/states.ts. */
export const VISUAL_STATES: CaptureState[] = [
  // P3-A: Live Counting and the Data SPARTA Magang table.
  {
    id: 'kelola-live',
    title: 'Live Counting',
    persona: 'pengurus',
    path: '/kelola/live/pixel',
    ready: (p) => p.getByRole('main').getByText('Tidak tertarik'),
  },
  {
    id: 'kelola-sparta',
    title: 'Data SPARTA Magang',
    persona: 'pengurus',
    path: '/kelola/sparta',
    ready: (p) => p.getByRole('main').getByText('3 pendaftar'),
  },
  // P2-B: Ding Dong, Testi Matkul, NIM Finder and Info Lomba.
  ...fromStates([
    'dingdong',
    'dingdong-empty',
    'dingdong-loading',
    'dingdong-error',
    'dingdong-offline',
    'testi-programs',
    'testi-courses',
    'testi-course',
    'testi-search',
    'testi-course-empty',
    'nim-finder',
    'nim-finder-results',
    'competition',
    'lomba-error',
  ]),
];

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
