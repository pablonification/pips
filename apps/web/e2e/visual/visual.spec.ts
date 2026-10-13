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
export const VISUAL_STATES: CaptureState[] = [
  // P1-A: Beranda's and Kalender's main views, the event sheet and search.
  {
    id: 'beranda',
    title: 'Beranda',
    path: '/',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
        .filter({ has: p.getByText('Notifikasi belum menyala') })
        .filter({ has: p.getByText('PIXEL, isi Form Analisis Kondisi ya!') }),
  },
  {
    id: 'kalender',
    title: 'Kalender',
    path: '/kalender',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
        .filter({
          has: p.getByRole('button', { name: /^Senin, 19 Oktober, 1 acara/ }),
        }),
  },
  {
    id: 'kalender-event-sheet',
    title: 'Kalender, Deadline Tugas Besar 1 open',
    only: 'phone',
    path: '/kalender?hari=2026-10-09&acara=a3',
    ready: (p) =>
      p.getByRole('dialog', { name: 'Detail acara' }).filter({
        has: p.getByText('Kumpulkan di Edunex. Satu kelompok tiga orang.'),
      }),
  },
  {
    id: 'search-start',
    title: 'Global search, nothing typed',
    path: '/',
    act: async (page) => {
      await page
        .getByRole('main')
        .filter({ has: page.getByText('PIXEL, isi Form Analisis Kondisi ya!') })
        .waitFor();
      await page.keyboard.press('ControlOrMeta+k');
    },
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Pencarian global' })
        .filter({ has: p.getByRole('option', { name: /^Bayar Kas!/ }) }),
  },
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
      // The same picture on every run and machine (CI records the Linux references): the web fonts and every image
      // on the page are in before the screenshot, not a fallback face or an empty logo.
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((img) =>
            img.complete ? null : img.decode().catch(() => null),
          ),
        );
      });
      await expect(page).toHaveScreenshot(`${state.id}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.001,
      });
    });
  });
}
