/**
 * The states the "before" set recorded from today's app and `e2e:compare-before` re-captures in the redesigned one:
 * each destination's main view, the empty, loading, error and offline states, open overlays, the form steps and the
 * Kelola tables. Each state's path and steps reach the same state in the new app (C1), so F1 can show before next
 * to after; a state the new app no longer has carries a `removed` reason.
 *
 * Each state is captured at phone and desktop size in light and dark. Add a state by appending to STATES; ids
 * are file names (today's names: home, timeline, settings, admin), so never rename one that is already in a before
 * set.
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import type { PersonaKey } from '../fixtures/api';
import { navLink } from '../support/app';
import { fillPixelUpTo } from '../support/flows';
import { inFeed, P1 } from '../support/pengumuman';
import { reply, type ApiMock } from '../support/mock';
import * as writes from '../support/writes';

export interface CaptureState {
  id: string;
  /** What the state shows, for the gallery. */
  title: string;
  persona?: PersonaKey;
  signedIn?: boolean;
  installed?: boolean;
  /** Only one layout has this state. */
  only?: 'phone' | 'desktop';
  path: string;
  /** Steps before the page opens (init scripts, storage). */
  prepare?: (page: Page) => Promise<void>;
  /** Mock overrides, installed before the page opens. */
  mock?: (api: ApiMock) => void;
  /** Steps after the page opens, to reach the state. */
  act?: (
    page: Page,
    ctx: { api: ApiMock; context: BrowserContext },
  ) => Promise<void>;
  /** Visible when the state is ready to capture. */
  ready: (page: Page) => Locator;
  /**
   * Why the redesigned app no longer has this state. The state is still captured at its path, showing what opens
   * there now, and compare-before lists it as removed instead of changed (C1).
   */
  removed?: string;
}

/** P1-A: Beranda with every section's data (agenda, follow-ups, unread). */
const berandaReady = (p: Page) =>
  p
    .getByRole('main')
    .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
    .filter({ has: p.getByText('Notifikasi belum menyala') })
    .filter({ has: p.getByText('PIXEL, isi Form Analisis Kondisi ya!') });

const readPosts = (api: ApiMock) =>
  api.on('POST /api/info/:infoId/read', writes.markRead);

export const STATES: CaptureState[] = [
  // Sign-in and the app shell
  {
    id: 'login',
    title: 'Sign-in',
    signedIn: false,
    path: '/login',
    // P1-C replaced today's sign-in ("Log in with your std email to get you in").
    ready: (p) => p.getByRole('button', { name: 'Masuk dengan Google' }),
  },
  {
    id: 'install-prompt',
    title: 'Install tutorial in a phone browser',
    installed: false,
    only: 'phone',
    path: '/',
    // The state keeps its id and path, so compare-before shows the before (tutorial) next to what a phone browser
    // opens now: Beranda.
    ready: (p) => berandaReady(p),
    removed:
      'P0-B removed the install gate (SPEC "Removals"): a phone browser opens the app.',
  },
  {
    id: 'app-loading',
    title: 'App loading the session',
    path: '/',
    // Shown only before the member is cached on the device, while /api/me is pending.
    prepare: async (p) => {
      await p.addInitScript(() => localStorage.removeItem('user'));
    },
    mock: (api) => api.on('GET /api/me', reply.hang()),
    // F2-002: the Garis loading status, named "Memuat…" (it was an English "Loading...").
    ready: (p) => p.getByRole('status', { name: 'Memuat…' }),
  },

  // Beranda (P1-A reaches today's Home states on it)
  {
    id: 'home',
    title: 'Beranda',
    path: '/',
    ready: (p) => berandaReady(p),
  },
  {
    id: 'home-schedule-loading',
    title: 'Beranda, agenda loading',
    path: '/',
    mock: (api) => api.on('GET /api/calendar/me', reply.hang()),
    ready: (p) => p.getByRole('status', { name: 'Memuat acara…' }),
  },
  {
    id: 'home-other-day',
    title: 'Beranda, Friday chosen on the day strip',
    path: '/',
    act: async (p) => {
      await berandaReady(p).waitFor();
      await p.getByRole('button', { name: /^Jumat, 9 Oktober/ }).click();
    },
    ready: (p) =>
      p
        .getByRole('region', { name: '8 hari ke depan' })
        .getByText('Deadline Tugas Besar 1'),
  },
  {
    id: 'home-pengurus',
    title: 'Beranda for Raka (Kelola)',
    persona: 'pengurus',
    path: '/',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF3170 Inteligensi Buatan') })
        .filter({ has: p.getByText('Cari tim Gemastik XIX? Isi form ini') })
        .filter({ has: p.getByText('142', { exact: true }) }),
  },

  // Pengumuman (P1-B reaches today's Timeline states on it)
  {
    id: 'timeline',
    title: 'Pengumuman',
    path: '/pengumuman',
    ready: (p) => inFeed(p, P1),
  },
  {
    id: 'timeline-loading',
    title: 'Pengumuman loading',
    path: '/pengumuman',
    mock: (api) => api.on('GET /api/info', reply.hang()),
    ready: (p) => p.getByRole('status', { name: 'Memuat pengumuman…' }).first(),
  },
  {
    id: 'timeline-error',
    title: 'Pengumuman, the API failing (503)',
    path: '/pengumuman',
    mock: (api) => api.on('GET /api/info', reply.status(503)),
    // The app retries a failing request three times before giving up.
    act: async (_p, { api }) => {
      for (let i = 0; i < 100 && api.calls('GET /api/info').length < 4; i++)
        await new Promise((r) => setTimeout(r, 200));
    },
    ready: (p) => p.getByText('Pengumuman gagal dimuat.'),
  },
  {
    id: 'timeline-empty',
    title: 'Pengumuman with no posts',
    path: '/pengumuman',
    mock: (api) => api.on('GET /api/info', { infos: [] }),
    ready: (p) => p.getByText('Tidak ada yang ditampilkan'),
  },
  {
    id: 'timeline-offline',
    title: 'Pengumuman opened while offline',
    path: '/',
    act: async (p, { api }) => {
      await p.getByText('Kuis 2').waitFor();
      // Since P0-B each route's code is its own file, which the installed app's service worker precaches. The
      // harness blocks service workers, so load the Timeline's code first (focusing its link preloads it), as
      // the precache would have it, then go offline. Its data is not loaded: the screen is the same as before.
      await navLink(p, 'Pengumuman').focus();
      await p.waitForLoadState('networkidle');
      // A keyboard focus ring would show in the capture; the member taps, which draws none.
      await navLink(p, 'Pengumuman').blur();
      await api.setOffline(true);
      await navLink(p, 'Pengumuman').click();
    },
    ready: (p) => p.getByRole('heading', { level: 1, name: 'Pengumuman' }),
  },
  {
    id: 'timeline-unread',
    // Today's desktop timeline has no unread toggle or filter drawer.
    only: 'phone',
    title: 'Pengumuman, unread only',
    path: '/pengumuman',
    act: async (p) => {
      await inFeed(p, P1).waitFor();
      await p.getByRole('button', { name: /^Belum dibaca/ }).click();
      await p.waitForURL(/unread=true/);
    },
    ready: (p) => inFeed(p, P1),
  },
  {
    id: 'timeline-filter',
    // Today's desktop timeline has no unread toggle or filter drawer.
    only: 'phone',
    title: 'Pengumuman filter open',
    path: '/pengumuman',
    act: async (p) => {
      await inFeed(p, P1).waitFor();
      await p.getByRole('button', { name: /^Kategori/ }).click();
    },
    ready: (p) => p.getByRole('dialog', { name: 'Kategori yang ditampilkan' }),
  },
  {
    id: 'timeline-card-menu',
    title: 'Pengumuman, a post’s menu open',
    path: '/pengumuman',
    act: async (p) => {
      await inFeed(p, P1).waitFor();
      await p
        .getByRole('button', {
          name: 'Opsi untuk Jadwal UTS Ganjil 2026/2027 sudah keluar',
        })
        .first()
        .click();
    },
    ready: (p) => p.getByRole('menuitem', { name: 'Tandai sudah dibaca' }),
  },
  {
    id: 'post',
    title: 'Post with comments',
    path: '/pengumuman/p1',
    mock: readPosts,
    ready: (p) => p.getByText('Kak, IF2123 K01 sama K02 ruangnya beda ya?'),
  },
  {
    id: 'post-reactions',
    title: 'Post, reaction picker open',
    path: '/pengumuman/p2',
    mock: readPosts,
    act: async (p) => {
      await p.getByText('Cari tim Gemastik XIX? Isi form ini').waitFor();
      await p.getByRole('button', { name: 'Beri reaksi', exact: true }).click();
    },
    ready: (p) => p.getByRole('group', { name: 'Pilih reaksi' }),
  },
  {
    id: 'composer',
    title: 'New announcement',
    path: '/pengumuman/tulis',
    ready: (p) => p.getByRole('textbox', { name: 'Isi pengumuman' }),
  },
  {
    id: 'composer-categories',
    title: 'New announcement, categories open',
    path: '/pengumuman/tulis',
    // The redesign shows the categories as chips; an empty submit shows what is missing.
    act: async (p) => p.getByRole('button', { name: 'Umumkan' }).click(),
    ready: (p) => p.getByText('Pilih minimal satu kategori.'),
  },

  // Calendar
  {
    id: 'calendar',
    title: 'Kalender',
    path: '/kalender',
    ready: (p) =>
      p.getByRole('button', {
        name: /^19\.00 21\.00 Sharing Session: Magang di Startup/,
      }),
  },
  {
    id: 'calendar-pengurus',
    title: 'Kalender for Raka (can add events)',
    persona: 'pengurus',
    path: '/kalender',
    ready: (p) => p.getByRole('button', { name: /\d\d\.\d\d Kuis 1/ }),
  },
  {
    id: 'calendar-add-event',
    title: 'Add event dialog (Raka)',
    persona: 'pengurus',
    only: 'desktop',
    path: '/kalender',
    act: async (p) => p.getByRole('button', { name: 'Tambah acara' }).click(),
    // P3-B replaced today's desktop form (the before set's state) with the locked dialog, once its courses load.
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Tambah acara Akademik' })
        .getByLabel('Mata kuliah'),
  },

  // Services
  {
    id: 'dingdong',
    title: 'Ding Dong',
    path: '/layanan/dingdong',
    // P2-B: the redesigned row shows the code over the name, so the row is found by its link.
    ready: (p) => p.getByRole('link', { name: /^IF2110\s*Algoritma/ }),
  },
  {
    id: 'testi-programs',
    title: 'Testi Matkul: programs',
    path: '/layanan/testi',
    ready: (p) => p.getByText('Teknik Informatika'),
  },
  {
    id: 'testi-courses',
    title: 'Testi Matkul: IF semester 3',
    path: '/layanan/testi/teknik-informatika/3',
    // Every row's count has arrived (P2-B: each row asks for its own; a skeleton line stands in until then).
    ready: (p) =>
      p
        .locator('main:not(:has(.g-skel-bar))')
        .getByRole('link', { name: /^IF2130 Sistem Operasi/ }),
  },
  {
    id: 'testi-course',
    title: 'Testi Matkul: IF2110',
    path: '/layanan/testi/teknik-informatika/3/course-IF2110',
    ready: (p) => p.getByText(/Lanjutan Dasar Pemrograman/),
  },
  {
    id: 'nim-finder',
    title: 'NIM Finder',
    path: '/layanan/nim',
    ready: (p) =>
      p.getByPlaceholder('Ketik nama atau NIM').locator('visible=true'),
  },
  {
    id: 'nim-finder-results',
    title: 'NIM Finder, results for “Rak”',
    path: '/layanan/nim',
    act: async (p) =>
      p
        .getByPlaceholder('Ketik nama atau NIM')
        .locator('visible=true')
        .fill('Rak'),
    ready: (p) => p.getByText('Rakai Prasetyo'),
  },
  {
    id: 'competition',
    title: 'Info Lomba',
    path: '/layanan/lomba',
    ready: (p) => p.getByRole('heading', { name: 'Find IT! 2026' }),
  },
  // P2-C: the redesigned member screens (rows are links; the room reads its unread message on opening).
  {
    id: 'curhat',
    title: 'Curhat Yuk! rooms',
    path: '/layanan/curhat',
    ready: (p) =>
      p.getByRole('main').getByRole('link', { name: /^Amber Heron/ }),
  },
  {
    id: 'curhat-room',
    title: 'Curhat Yuk! room',
    path: '/layanan/curhat',
    mock: (api) =>
      api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom),
    act: async (p) =>
      p
        .getByRole('main')
        .getByRole('link', { name: /^Teal Koala/ })
        .click(),
    ready: (p) => p.getByRole('log', { name: 'Percakapan Teal Koala' }),
  },
  {
    id: 'curhat-empty',
    title: 'Curhat Yuk! with no rooms (Raka)',
    persona: 'pengurus',
    path: '/layanan/curhat',
    ready: (p) => p.getByRole('main').getByText('Belum ada ruang cerita'),
  },

  // Form (PIXEL)
  {
    id: 'form-list',
    title: 'Form list',
    path: '/layanan/form',
    // P2-A: the card is a link named by its title.
    ready: (p) =>
      p
        .getByRole('main')
        .getByRole('link', { name: /Form Analisis Kondisi PIXEL/ }),
  },
  {
    id: 'form-empty',
    title: 'Form list, nothing to fill (Raka)',
    persona: 'pengurus',
    path: '/layanan/form',
    ready: (p) => p.getByText('Belum ada form untukmu'),
  },
  ...[1, 2, 3, 4, 5].map((n): CaptureState => ({
    id: `form-step-${n}`,
    title: `PIXEL form, section ${n}`,
    path: '/layanan/form/pixel',
    act: async (p) => fillPixelUpTo(p, n - 1),
    ready: (p) =>
      p.getByRole('heading', { level: 2 }).locator('visible=true').first(),
  })),
  {
    id: 'form-required',
    title: 'PIXEL form, required questions missing',
    path: '/layanan/form/pixel',
    act: async (p) => p.getByRole('button', { name: 'Lanjut' }).click(),
    ready: (p) => p.getByText('Pertanyaan ini wajib diisi').first(),
  },
  {
    id: 'form-confirm',
    title: 'PIXEL form, confirm sending',
    path: '/layanan/form/pixel',
    act: async (p) => {
      // P2-A: after the five sections comes the check page, which sends.
      await fillPixelUpTo(p, 5);
      await p.getByRole('button', { name: 'Kirim jawaban' }).click();
    },
    ready: (p) => p.getByRole('alertdialog', { name: 'Kirim jawaban?' }),
  },
  {
    id: 'form-done',
    title: 'PIXEL form, sent',
    path: '/layanan/form/pixel',
    mock: (api) => api.on('POST /api/form/:formId/response', writes.submitForm),
    act: async (p) => {
      await fillPixelUpTo(p, 5);
      await p.getByRole('button', { name: 'Kirim jawaban' }).click();
      await p.getByRole('button', { name: 'Kirim', exact: true }).click();
      // Let the success toast leave so the capture shows the page itself. Wait for it to appear first: waiting
      // only for "hidden" passed at once while the request was still running, and the toast then showed up in
      // some captures and not in others.
      const toast = p.getByText('Form berhasil dikirim!');
      await toast.waitFor({ state: 'visible', timeout: 10_000 });
      await toast.waitFor({ state: 'hidden', timeout: 10_000 });
    },
    ready: (p) => p.getByText('Terima kasih sudah mengisi!'),
  },

  // Profil (P1-C reaches today's Settings states on it)
  {
    id: 'settings',
    title: 'Profil',
    path: '/profil',
    // P1-C replaced today's settings (a list item with the NIM): Profil once its counts have loaded.
    ready: (p) => p.getByRole('main').getByText('6 mata kuliah · 18 SKS'),
  },
  {
    id: 'settings-courses',
    title: 'Set Courses',
    path: '/profil/matkul',
    ready: (p) => p.getByText('Jumlah SKS').locator('visible=true').first(),
  },
  {
    id: 'settings-courses-add',
    title: 'Add courses',
    path: '/profil/matkul/tambah',
    ready: (p) => p.getByText('Strategi Algoritma'),
  },
  {
    id: 'settings-notifications',
    title: 'Notification',
    path: '/profil/notifikasi',
    ready: (p) => p.getByRole('switch').locator('visible=true').last(),
  },
  {
    id: 'settings-credits',
    title: 'Credits',
    path: '/profil/kredit',
    ready: (p) => p.getByText('PIPS! dibuat dan dirawat oleh HMIF ITB.'),
  },

  // Kelola (Raka; P3-A reaches today's Admin states on it)
  {
    id: 'admin',
    title: 'Kelola hub',
    persona: 'pengurus',
    path: '/kelola',
    ready: (p) => p.getByRole('link', { name: /Data SPARTA Magang/ }),
  },
  {
    id: 'admin-forms',
    title: 'Kelola: Live Counting',
    persona: 'pengurus',
    path: '/kelola/live',
    // P3-A: one active form, so the forms entry forwards to its live page.
    ready: (p) => p.locator('.g-live-plaque').getByText('142'),
  },
  {
    id: 'admin-live',
    title: 'Live Counting & Rekap Form',
    persona: 'pengurus',
    path: '/kelola/live/pixel',
    // P3-A: the plaque, the newest five and both charts.
    ready: (p) => p.locator('.g-hbars').nth(1),
  },
  {
    id: 'sparta-table',
    title: 'Data SPARTA Magang table',
    persona: 'pengurus',
    path: '/kelola/sparta',
    ready: (p) =>
      p
        .locator('a[href="/kelola/sparta/sub-13525071"]')
        .locator('visible=true'),
  },
  {
    id: 'sparta-submission',
    title: 'SPARTA submission detail',
    persona: 'pengurus',
    path: '/kelola/sparta/sub-13525071',
    ready: (p) => p.getByText('Prioritas 1: Akademik'),
  },
  // P2-B: the redesigned services' finished states (for VISUAL_STATES once recorded in the CI container).
  {
    id: 'dingdong-empty',
    title: 'Ding Dong, no courses set',
    path: '/layanan/dingdong',
    mock: (api) => api.on('GET /api/course/take/current', []),
    ready: (p) => p.getByRole('main').getByText('Belum ada mata kuliah'),
  },
  {
    id: 'dingdong-loading',
    title: 'Ding Dong, loading',
    path: '/layanan/dingdong',
    mock: (api) => api.on('GET /api/course/take/current', reply.hang()),
    ready: (p) => p.getByRole('status', { name: 'Memuat mata kuliahmu…' }),
  },
  {
    id: 'dingdong-error',
    title: 'Ding Dong, failed to load',
    path: '/layanan/dingdong',
    mock: (api) => api.on('GET /api/course/take/current', reply.status(503)),
    ready: (p) => p.getByRole('main').getByText('Mata kuliahmu gagal dimuat.'),
  },
  {
    id: 'dingdong-offline',
    title: 'Ding Dong, offline with the kept list',
    path: '/layanan/dingdong',
    act: async (p, { api }) => {
      await p.getByRole('link', { name: /^IF2110\s*Algoritma/ }).waitFor();
      await p.waitForLoadState('networkidle');
      await api.setOffline(true);
    },
    ready: (p) => p.getByRole('main').getByText(/^Offline · diperbarui/),
  },
  {
    id: 'testi-search',
    title: 'Testi Matkul, searching “if2110”',
    path: '/layanan/testi?q=if2110',
    ready: (p) =>
      p
        .getByRole('main')
        .getByRole('link', { name: /^IF2110 .* 3 testimoni$/ }),
  },
  {
    id: 'testi-course-empty',
    title: 'Testi Matkul, a course with no testimonials',
    path: '/layanan/testi/teknik-informatika/3/course-IF2120',
    ready: (p) => p.getByRole('main').getByText('Belum ada testimoni'),
  },
  {
    id: 'lomba-error',
    title: 'Info Lomba, failed to load',
    path: '/layanan/lomba',
    mock: (api) => api.on('GET /api/competitions', reply.status(503)),
    ready: (p) => p.getByRole('main').getByText('Lomba gagal dimuat.'),
  },
];
