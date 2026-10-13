/**
 * Visual regression: screenshots compared with committed reference images (`toHaveScreenshot`).
 *
 * Each redesign task added a state to VISUAL_STATES for the screens it finished and recorded the references with
 * `pnpm --filter web e2e:update` (in e2e/visual/visual.spec.ts-snapshots/). References change only through that
 * command, and their diffs are reviewed in the pull request. They are per platform: the macOS ones come from this
 * command, the Linux ones from the `visual references` workflow in CI's container.
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
