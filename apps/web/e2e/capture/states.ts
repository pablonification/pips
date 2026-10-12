/**
 * The states the "before" set records and `e2e:compare-before` re-captures: each destination's main view, the
 * empty, loading, error and offline states today's app has, open overlays, the form steps and the admin tables.
 *
 * Each state is captured at phone and desktop size in light and dark. Add a state by appending to STATES; ids
 * are file names, so never rename one that is already in a before set.
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import type { PersonaKey } from '../fixtures/api';
import { navLink, timelineTitle, visibleText } from '../support/app';
import { fillPixelUpTo } from '../support/flows';
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
  /** Mock overrides, installed before the page opens. */
  mock?: (api: ApiMock) => void;
  /** Steps after the page opens, to reach the state. */
  act?: (
    page: Page,
    ctx: { api: ApiMock; context: BrowserContext },
  ) => Promise<void>;
  /** Visible when the state is ready to capture. */
  ready: (page: Page) => Locator;
}

const heading = (page: Page, name: string, level?: number) =>
  page
    .getByRole('heading', { name, exact: true, level })
    .locator('visible=true')
    .first();
const readPosts = (api: ApiMock) =>
  api.on('POST /api/info/:infoId/read', writes.markRead);

export const STATES: CaptureState[] = [
  // Sign-in and the app shell
  {
    id: 'login',
    title: 'Sign-in',
    signedIn: false,
    path: '/login',
    ready: (p) => visibleText(p, 'Log in with your std email to get you in'),
  },
  {
    id: 'install-prompt',
    title: 'Install tutorial in a phone browser',
    installed: false,
    only: 'phone',
    path: '/home',
    ready: (p) => p.getByText(/install/i).first(),
  },
  {
    id: 'app-loading',
    title: 'App loading the session',
    path: '/home',
    mock: (api) => api.on('GET /api/me', reply.hang()),
    ready: (p) => p.getByText('Loading...'),
  },

  // Home
  {
    id: 'home',
    title: 'Home',
    path: '/home',
    ready: (p) => visibleText(p, 'Kuis 2'),
  },
  {
    id: 'home-schedule-loading',
    title: 'Home, schedule loading',
    path: '/home',
    mock: (api) => api.on('GET /api/calendar/me', reply.hang()),
    ready: (p) => visibleText(p, 'Hi, Nadia Putri!'),
  },
  {
    id: 'home-other-day',
    title: 'Home, Friday chosen on the week strip',
    path: '/home',
    act: async (p) =>
      p.getByRole('button', { name: '9 Fri' }).locator('visible=true').click(),
    ready: (p) => visibleText(p, 'Deadline Tugas Besar 1'),
  },
  {
    id: 'home-pengurus',
    title: 'Home for Raka (Admin tile)',
    persona: 'pengurus',
    path: '/home',
    ready: (p) => visibleText(p, 'Kuis 1'),
  },

  // Timeline (announcements)
  {
    id: 'timeline',
    title: 'Timeline',
    path: '/timeline',
    ready: (p) => heading(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar', 4),
  },
  {
    id: 'timeline-loading',
    title: 'Timeline loading',
    path: '/timeline',
    mock: (api) => api.on('GET /api/info', reply.hang()),
    ready: timelineTitle,
  },
  {
    id: 'timeline-error',
    title: 'Timeline, the API failing (503)',
    path: '/timeline',
    mock: (api) => api.on('GET /api/info', reply.status(503)),
    // The app retries a failing request three times before giving up.
    act: async (_p, { api }) => {
      for (let i = 0; i < 100 && api.calls('GET /api/info').length < 4; i++)
        await new Promise((r) => setTimeout(r, 200));
    },
    ready: timelineTitle,
  },
  {
    id: 'timeline-empty',
    title: 'Timeline with no posts',
    path: '/timeline',
    mock: (api) => api.on('GET /api/info', { infos: [] }),
    ready: timelineTitle,
  },
  {
    id: 'timeline-offline',
    title: 'Timeline opened while offline',
    path: '/home',
    act: async (p, { api }) => {
      await visibleText(p, 'Kuis 2').waitFor();
      await api.setOffline(true);
      await navLink(p, 'Timeline').click();
    },
    ready: timelineTitle,
  },
  {
    id: 'timeline-unread',
    title: 'Timeline, unread only',
    path: '/timeline',
    act: async (p) => {
      await heading(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar', 4).waitFor();
      await p
        .getByRole('button', { name: 'A button' })
        .locator('visible=true')
        .first()
        .click();
    },
    ready: (p) => heading(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar', 4),
  },
  {
    id: 'timeline-filter',
    title: 'Timeline filter open',
    path: '/timeline',
    act: async (p) => {
      await heading(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar', 4).waitFor();
      await p
        .getByRole('button', { name: 'A button' })
        .locator('visible=true')
        .nth(1)
        .click();
    },
    ready: (p) => p.getByRole('dialog').locator('visible=true').first(),
  },
  {
    id: 'timeline-card-menu',
    title: 'Timeline, a post’s menu open',
    path: '/timeline',
    act: async (p) => {
      await heading(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar', 4).waitFor();
      await p
        .locator('button[aria-haspopup="dialog"]')
        .locator('visible=true')
        .first()
        .click();
    },
    ready: (p) => p.getByRole('button', { name: /Mark as (un)?read/ }).first(),
  },
  {
    id: 'post',
    title: 'Post with comments',
    path: '/timeline/p1',
    mock: readPosts,
    ready: (p) => visibleText(p, 'Kak, IF2123 K01 sama K02 ruangnya beda ya?'),
  },
  {
    id: 'post-reactions',
    title: 'Post, reaction picker open',
    path: '/timeline/p2',
    mock: readPosts,
    act: async (p) => {
      await heading(p, 'Cari tim Gemastik XIX? Isi form ini', 1).waitFor();
      await p.getByRole('button', { name: 'like' }).first().click();
    },
    ready: (p) => p.getByRole('button', { name: 'party' }),
  },
  {
    id: 'composer',
    title: 'New announcement',
    path: '/add-announcement',
    ready: (p) =>
      p.getByPlaceholder('What do you want announce?').locator('visible=true'),
  },
  {
    id: 'composer-categories',
    title: 'New announcement, categories open',
    path: '/add-announcement',
    act: async (p) =>
      p
        .getByRole('button', { name: 'Enter Categories' })
        .locator('visible=true')
        .click(),
    ready: (p) => p.getByText('Umum').locator('visible=true').first(),
  },

  // Calendar
  {
    id: 'calendar',
    title: 'Calendar',
    path: '/calendar',
    ready: (p) => visibleText(p, 'Sharing Session: Magang di Startup'),
  },
  {
    id: 'calendar-pengurus',
    title: 'Calendar for Raka (can add events)',
    persona: 'pengurus',
    path: '/calendar',
    ready: (p) => visibleText(p, 'Kuis 1'),
  },
  {
    id: 'calendar-add-event',
    title: 'Add event dialog (Raka)',
    persona: 'pengurus',
    only: 'desktop',
    path: '/calendar',
    act: async (p) => p.getByRole('button', { name: 'Add event' }).click(),
    ready: (p) => p.getByRole('dialog'),
  },

  // Services
  {
    id: 'dingdong',
    title: 'Ding Dong',
    path: '/home/dingdong',
    ready: (p) => visibleText(p, 'IF2110 Algoritma dan Pemrograman II'),
  },
  {
    id: 'testi-programs',
    title: 'Testi Matkul: programs',
    path: '/home/testimoni',
    ready: (p) => visibleText(p, 'Teknik Informatika'),
  },
  {
    id: 'testi-courses',
    title: 'Testi Matkul: IF semester 3',
    path: '/home/testimoni/teknik-informatika/3',
    ready: (p) => visibleText(p, 'Sistem Operasi'),
  },
  {
    id: 'testi-course',
    title: 'Testi Matkul: IF2110',
    path: '/home/testimoni/teknik-informatika/3/course-IF2110',
    ready: (p) => visibleText(p, /Lanjutan Dasar Pemrograman/),
  },
  {
    id: 'nim-finder',
    title: 'NIM Finder',
    path: '/home/nim-finder',
    ready: (p) =>
      p.getByPlaceholder('Ketik nama atau NIM').locator('visible=true'),
  },
  {
    id: 'nim-finder-results',
    title: 'NIM Finder, results for “Rak”',
    path: '/home/nim-finder',
    act: async (p) =>
      p
        .getByPlaceholder('Ketik nama atau NIM')
        .locator('visible=true')
        .fill('Rak'),
    ready: (p) => visibleText(p, 'Rakai Prasetyo'),
  },
  {
    id: 'competition',
    title: 'Info Lomba',
    path: '/home/competition',
    ready: (p) => visibleText(p, 'Find IT! 2026'),
  },
  {
    id: 'curhat',
    title: 'Curhat Yuk! rooms',
    path: '/home/curhat',
    ready: (p) => p.getByRole('heading', { name: 'Amber Heron' }),
  },
  {
    id: 'curhat-room',
    title: 'Curhat Yuk! room',
    path: '/home/curhat',
    act: async (p) => p.getByRole('heading', { name: 'Teal Koala' }).click(),
    ready: (p) =>
      visibleText(
        p,
        'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?',
      ),
  },
  {
    id: 'curhat-empty',
    title: 'Curhat Yuk! with no rooms (Raka)',
    persona: 'pengurus',
    path: '/home/curhat',
    ready: (p) =>
      p
        .getByRole('button', { name: 'create chatroom' })
        .locator('visible=true'),
  },

  // Form (PIXEL)
  {
    id: 'form-list',
    title: 'Form list',
    path: '/home/form',
    ready: (p) => heading(p, 'Form Analisis Kondisi PIXEL', 2),
  },
  {
    id: 'form-empty',
    title: 'Form list, nothing to fill (Raka)',
    persona: 'pengurus',
    path: '/home/form',
    ready: (p) => visibleText(p, 'Belum ada form untuk kamu'),
  },
  ...[1, 2, 3, 4, 5].map(
    (n): CaptureState => ({
      id: `form-step-${n}`,
      title: `PIXEL form, section ${n}`,
      path: '/home/form/pixel',
      act: async (p) => fillPixelUpTo(p, n - 1),
      ready: (p) =>
        p.getByRole('heading', { level: 2 }).locator('visible=true').first(),
    }),
  ),
  {
    id: 'form-required',
    title: 'PIXEL form, required questions missing',
    path: '/home/form/pixel',
    act: async (p) => p.getByRole('button', { name: 'Selanjutnya' }).click(),
    ready: (p) => p.getByText('Pertanyaan ini wajib diisi').first(),
  },
  {
    id: 'form-confirm',
    title: 'PIXEL form, confirm sending',
    path: '/home/form/pixel',
    act: async (p) => {
      await fillPixelUpTo(p, 5);
      await p.getByRole('button', { name: 'Kirim Jawaban' }).click();
    },
    ready: (p) => p.getByRole('dialog', { name: 'Kirim Jawaban?' }),
  },
  {
    id: 'form-done',
    title: 'PIXEL form, sent',
    path: '/home/form/pixel',
    mock: (api) => api.on('POST /api/form/:formId/response', writes.submitForm),
    act: async (p) => {
      await fillPixelUpTo(p, 5);
      await p.getByRole('button', { name: 'Kirim Jawaban' }).click();
      await p.getByRole('button', { name: 'Ya, Kirim' }).click();
      // Let the success toast leave so the capture shows the page itself.
      await p
        .getByText('Form berhasil dikirim!')
        .waitFor({ state: 'hidden', timeout: 10_000 });
    },
    ready: (p) => visibleText(p, 'Terima kasih sudah mengisi!'),
  },

  // Settings (profile)
  {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    ready: (p) => visibleText(p, 'NIM 13525045'),
  },
  {
    id: 'settings-courses',
    title: 'Set Courses',
    path: '/settings/courses',
    ready: (p) => visibleText(p, 'Jumlah SKS 18'),
  },
  {
    id: 'settings-courses-add',
    title: 'Add courses',
    path: '/settings/courses/add',
    ready: (p) => visibleText(p, 'Strategi Algoritma'),
  },
  {
    id: 'settings-notifications',
    title: 'Notification',
    path: '/settings/subscriptions',
    ready: (p) => p.getByRole('switch').locator('visible=true').last(),
  },
  {
    id: 'settings-credits',
    title: 'Credits',
    path: '/settings/credits',
    ready: (p) => visibleText(p, 'PIPS! dibuat dan dirawat oleh HMIF ITB.'),
  },

  // Admin (Raka)
  {
    id: 'admin',
    title: 'Admin hub',
    persona: 'pengurus',
    path: '/home/admin',
    ready: (p) => p.getByRole('link', { name: /Data SPARTA Magang/ }),
  },
  {
    id: 'admin-forms',
    title: 'Admin: forms',
    persona: 'pengurus',
    path: '/home/admin/forms',
    ready: (p) => heading(p, 'Form Analisis Kondisi PIXEL', 2),
  },
  {
    id: 'admin-live',
    title: 'Live Counting & Rekap Form',
    persona: 'pengurus',
    path: '/home/admin/forms/pixel',
    ready: (p) => visibleText(p, 'Halaman 1 dari 8'),
  },
  {
    id: 'sparta-table',
    title: 'Data SPARTA Magang table',
    persona: 'pengurus',
    path: '/home/internship/admin',
    ready: (p) => p.getByRole('row', { name: /Bima Santoso/ }),
  },
  {
    id: 'sparta-submission',
    title: 'SPARTA submission detail',
    persona: 'pengurus',
    path: '/home/internship/admin/sub-13525071',
    ready: (p) => visibleText(p, 'Prioritas 1: Akademik'),
  },
];
