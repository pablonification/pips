/**
 * Screens with no locked target (F1 brief, step 7): where each one is captured, who built it and which report or
 * proposal names it. Most are captured by the specs the tasks wrote for their own reports, run again into the
 * review's folder (never into the tasks' folders, which are their record); the rest by e2e/review/stills.spec.ts,
 * which reuses the journeys' states. `pnpm --filter web review stills` runs them all at phone, tablet and desktop,
 * light and dark, and turns them into WebP.
 */
import type { Locator, Page } from '@playwright/test';
import type { Db } from '../fixtures/api';
import type { ApiMock } from '../support/mock';
import { reply } from '../support/mock';

export interface StillSource {
  id: string;
  owner: string;
  /** The spec that captures them, from apps/web. */
  spec: string;
  /** The environment variable that turns its captures on and names the folder. */
  env: string;
  /** Which projects run it: the fidelity projects (locked-screen sizes), the journeys' or the review's own. */
  projects: 'fidelity' | 'journeys' | 'review-stills';
  /** Where the task named them for the owner. */
  source: string;
  /** Reads a capture's file name: layout, state and theme. */
  parse: (file: string) => { layout: string; state: string; theme: string } | null;
}

const LAYOUT = (l: string) => (l === 'desk' ? 'desktop' : l);
const fidelityName = (prefix = '') => (file: string) => {
  const m = new RegExp(`^(phone|tablet|desk)-${prefix}(.+)-(light|dark)\\.png$`).exec(file);
  return m ? { layout: LAYOUT(m[1]), state: m[2], theme: m[3] } : null;
};

export const STILL_SOURCES: StillSource[] = [
  {
    id: 'P1-C',
    owner: 'P1-C',
    spec: 'e2e/fidelity/no-target.spec.ts',
    env: 'E2E_NO_TARGET_DIR',
    projects: 'fidelity',
    source: 'reports/P1-C-profil-layanan.md, "Screens with no locked target"; D2, D3, D5',
    parse: fidelityName(),
  },
  {
    id: 'P2-C',
    owner: 'P2-C',
    spec: 'e2e/fidelity/curhat-no-target.spec.ts',
    env: 'E2E_NO_TARGET_DIR',
    projects: 'fidelity',
    source: 'reports/P2-C-curhat.md; D7',
    parse: fidelityName('p2c-'),
  },
  {
    id: 'P3-C',
    owner: 'P3-C',
    spec: 'e2e/fidelity/curhat-inbox-no-target.spec.ts',
    env: 'E2E_NO_TARGET_DIR',
    projects: 'fidelity',
    source: 'reports/P3-C-curhat-inbox.md; proposals/P3-C/; D9',
    parse: fidelityName(),
  },
  {
    id: 'P3-B',
    owner: 'P3-B',
    spec: 'e2e/fidelity/proposals-p3-b.spec.ts',
    env: 'E2E_PROPOSALS_DIR',
    projects: 'fidelity',
    source: 'reports/P3-B-manage.md; proposals/P3-B/; D9',
    parse: fidelityName(),
  },
  {
    id: 'P2-A',
    owner: 'P2-A',
    spec: 'e2e/journeys/sparta.spec.ts',
    env: 'P2A_SHOTS',
    projects: 'journeys',
    source: 'reports/P2-A-form-sparta.md; reports/P2-A-sparta/; D4',
    parse: (file) => {
      const m = /^(phone|tablet|desktop)-(light|dark)-(\d+)-(.+)\.png$/.exec(file);
      return m ? { layout: m[1], state: m[4], theme: m[2] } : null;
    },
  },
  {
    id: 'F1',
    owner: 'by state',
    spec: 'e2e/review/stills.spec.ts',
    env: 'REVIEW_STILLS_DIR',
    projects: 'review-stills',
    source: 'by state',
    parse: (file) => {
      const m = /^(phone|tablet|desktop)-(.+)-(light|dark)\.png$/.exec(file);
      return m ? { layout: m[1], state: m[2], theme: m[3] } : null;
    },
  },
];

/** A state F1 captures itself because no task wrote a capture spec for it. */
export interface StillState {
  id: string;
  title: string;
  owner: string;
  source: string;
  persona: 'anggota' | 'pengurus' | null;
  signedIn?: boolean;
  path: string;
  setup?: (ctx: { api: ApiMock; db: Db; page: Page }) => void | Promise<void>;
  act?: (page: Page) => Promise<void>;
  ready: (page: Page) => Locator;
}

const main = (page: Page) => page.getByRole('main');
const P3A = 'reports/P3-A-kelola-live.md, "Screens with no locked target, for the owner"; D8';

export const STILL_STATES: StillState[] = [
  {
    id: 'kelola-forms-list',
    title: 'Live Counting with two forms open: the forms list',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/live',
    setup: ({ db }) => {
      const second = {
        ...db.adminForms[0],
        id: 'kesan',
        slug: 'kesan',
        title: 'Form Kesan Welcoming Party',
        opensAt: '2026-10-01T06:00:00.000Z',
        closesAt: '2026-10-07T16:59:00.000Z',
        order: 1,
      };
      db.adminForms.push(second);
      db.formDetails.kesan = { ...db.formDetails.pixel, ...second };
      db.adminResponses.kesan = [];
      db.formAnalytics.kesan = { totalResponses: 0, questions: [] };
    },
    ready: (page) => main(page).getByRole('link', { name: /^Form Kesan Welcoming Party/ }),
  },
  {
    id: 'kelola-rekap',
    title: 'Rekap Form',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/live/pixel/rekap',
    ready: (page) => main(page).getByText('142 hasil.'),
  },
  {
    id: 'kelola-rekap-no-match',
    title: 'Rekap Form with no match',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/live/pixel/rekap?q=zzz',
    ready: (page) => main(page).getByText('0 hasil.'),
  },
  {
    id: 'kelola-sparta',
    title: 'Data SPARTA Magang (a table from 1024 px, labelled rows below)',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/sparta',
    ready: (page) => main(page).getByText('3 pendaftar'),
  },
  {
    id: 'kelola-sparta-no-match',
    title: 'Data SPARTA Magang with no match',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/sparta?q=zzz',
    ready: (page) => main(page).getByText('Tidak ada pendaftar yang cocok'),
  },
  {
    id: 'kelola-sparta-empty',
    title: 'Data SPARTA Magang with no submissions',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/sparta',
    setup: ({ db }) => {
      db.internshipSubmissions = [];
    },
    ready: (page) => main(page).getByText('Belum ada pendaftar'),
  },
  {
    id: 'kelola-sparta-submission',
    title: 'A submission: Bima’s four choices',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/sparta/sub-13525071',
    ready: (page) => main(page).getByText('13525071 · IF · IF K2'),
  },
  {
    id: 'kelola-sparta-draft',
    title: 'A partial draft: Nadia’s, with “–” where nothing was chosen',
    owner: 'P3-A',
    source: P3A,
    persona: 'pengurus',
    path: '/kelola/sparta/sub-13525045',
    setup: ({ db }) => {
      const nadia = db.internshipSubmissions.find((s) => s.id === 'sub-13525045');
      if (nadia) Object.assign(nadia, { kelas: '', idLine: '' });
    },
    ready: (page) => main(page).getByText('13525045 · IF · –'),
  },
  {
    id: 'route-error',
    title: 'A page that failed to load: “Bagian ini gagal dimuat.”',
    owner: 'P0-B',
    source: 'reports/P0-B-infrastructure.md; D10',
    persona: 'anggota',
    path: '/layanan',
    act: async (page) => {
      await page.context().route('**/assets/dingdong-*.js', (r) => r.abort('failed'));
      await main(page).getByRole('link', { name: /^Ding Dong/ }).first().click();
    },
    ready: (page) => page.getByText('Bagian ini gagal dimuat.'),
  },
  {
    id: 'session-error',
    title: 'No connection and no member kept: “PIPS! belum bisa terhubung.”',
    owner: 'P0-B',
    source: 'reports/P0-B-infrastructure.md; D10',
    persona: 'anggota',
    signedIn: false,
    path: '/',
    setup: ({ api, db }) => {
      db.signedIn = true;
      api.on('GET /api/me', reply.status(503));
    },
    ready: (page) => page.getByText('PIPS! belum bisa terhubung. Periksa koneksimu, lalu coba lagi.'),
  },
  {
    id: 'pengumuman-offline',
    title: 'Pengumuman offline: the banner with the last update time',
    owner: 'P1-B',
    source: 'reports/P1-B-pengumuman.md (states); D10',
    persona: 'anggota',
    path: '/pengumuman',
    act: async (page) => {
      await page.locator('[data-post-link], [data-post-row]').first().waitFor();
      await page.context().setOffline(true);
      await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    },
    ready: (page) => main(page).getByRole('status').filter({ hasText: /^Offline · diperbarui/ }),
  },
];

/** The app's own icons as it ships them (apps/web/public), for D11 and HMIF's sign-off; P0-C built them. */
export const APP_ICONS = [
  { file: 'favicon.ico', title: 'Favicon' },
  { file: 'favicon-16x16.png', title: 'Favicon, 16 px' },
  { file: 'favicon-32x32.png', title: 'Favicon, 32 px' },
  { file: 'apple-touch-icon.png', title: 'iPhone home-screen icon' },
  { file: 'android-chrome-192x192.png', title: 'App icon, 192 px' },
  { file: 'android-chrome-384x384.png', title: 'App icon, 384 px' },
  { file: 'android-chrome-512x512.png', title: 'App icon, 512 px; the splash shows it on ink (the manifest’s background)' },
  { file: 'android-chrome-maskable-192x192.png', title: 'Android adaptive icon, 192 px' },
  { file: 'android-chrome-maskable-512x512.png', title: 'Android adaptive icon, 512 px' },
  { file: 'mstile-150x150.png', title: 'Windows tile' },
  { file: 'push-icon-192x192.png', title: 'Push notification icon' },
  { file: 'push-badge-96x96.png', title: 'Push badge (D11: a plain square on Android)' },
];
/** Old files nothing uses, kept by C1 until HMIF's sign-off (C1's open question 4): listed, not shown as the app's. */
export const OLD_ICONS = ['splash.png', 'icon.png', 'icon-background.png', 'icon-foreground.png', 'logo-nobg.png', 'logo-nobg-96x96.png', 'logo-nobg-256x256.png'];
