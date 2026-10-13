/**
 * Where each locked prototype screen lives in the real app: one entry per `<persona>-<route>` from names.mjs.
 *
 * A redesign task fills in the screens it builds: the URL, any mock overrides, steps to reach the state (open a
 * sheet, a popover, a dialog), and what is visible when it is ready. Screens without an entry show as "not built
 * yet" in the fidelity report. `layouts` limits an entry to some layouts when the others differ.
 *
 * Today's entries point at today's app, where an equivalent screen exists, so the report shows them as
 * "different". The redesign replaces them (P0-B changes the URLs).
 */
import type { BrowserContext, Locator, Page } from '@playwright/test';
import { visibleText } from '../support/app';
import type { ApiMock } from '../support/mock';
import * as writes from '../support/writes';

export interface FidelityScreen {
  path: string;
  layouts?: ('phone' | 'tablet' | 'desk')[];
  mock?: (api: ApiMock) => void;
  act?: (
    page: Page,
    ctx: { api: ApiMock; context: BrowserContext },
  ) => Promise<void>;
  ready: (page: Page) => Locator;
}

type Key = `anggota-${string}` | `pengurus-${string}`;

export const SCREENS: Partial<Record<Key, FidelityScreen>> = {
  // Today's app (before the redesign).
  'anggota-pengumuman': {
    path: '/pengumuman',
    ready: (p) => visibleText(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar'),
  },
  'anggota-post': {
    path: '/pengumuman/p1',
    mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
    ready: (p) => visibleText(p, 'Kak, IF2123 K01 sama K02 ruangnya beda ya?'),
  },
  'anggota-dingdong': {
    path: '/layanan/dingdong',
    ready: (p) => visibleText(p, 'IF2110 Algoritma dan Pemrograman II'),
  },
  'anggota-nim': {
    path: '/layanan/nim',
    ready: (p) =>
      p.getByPlaceholder('Ketik nama atau NIM').locator('visible=true'),
  },
  'anggota-lomba': {
    path: '/layanan/lomba',
    ready: (p) => visibleText(p, 'Find IT! 2026'),
  },
  'anggota-curhat': {
    path: '/layanan/curhat',
    ready: (p) => p.getByRole('heading', { name: 'Amber Heron' }),
  },
  'anggota-form': {
    path: '/layanan/form',
    ready: (p) => visibleText(p, 'Form Analisis Kondisi PIXEL'),
  },
  'anggota-profil': {
    path: '/profil',
    ready: (p) =>
      p
        .getByRole('listitem')
        .filter({ hasText: '13525045' })
        .locator('visible=true')
        .first(),
  },
  'anggota-matkul': {
    path: '/profil/matkul',
    ready: (p) => p.getByText('Jumlah SKS').locator('visible=true').first(),
  },
  'anggota-notif': {
    path: '/profil/notifikasi',
    ready: (p) => p.getByRole('switch').locator('visible=true').last(),
  },
  'pengurus-kelola': {
    path: '/kelola',
    ready: (p) => p.getByRole('link', { name: /Data SPARTA Magang/ }),
  },
  'pengurus-live': {
    path: '/kelola/live/pixel',
    ready: (p) => visibleText(p, 'Halaman 1 dari 8'),
  },
  'pengurus-form-empty': {
    path: '/layanan/form',
    ready: (p) => visibleText(p, 'Belum ada form untuk kamu'),
  },

  // P1-A: Beranda and Kalender, ready once every section has its data.
  'anggota-beranda': {
    path: '/',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
        .filter({ has: p.getByText('Notifikasi belum menyala') })
        .filter({ has: p.getByText('PIXEL, isi Form Analisis Kondisi ya!') }),
  },
  'pengurus-beranda': {
    path: '/',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF3170 Inteligensi Buatan') })
        .filter({ has: p.getByText('Deadline Tugas Besar 1 · IF3110') })
        .filter({ has: p.getByText('Cari tim Gemastik XIX? Isi form ini') })
        .filter({ has: p.getByText('142', { exact: true }) }),
  },
  'anggota-kalender': {
    path: '/kalender',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
        .filter({
          // The month's bars are in: 19 Oktober has its UTS.
          has: p.getByRole('button', { name: /^Senin, 19 Oktober, 1 acara/ }),
        }),
  },
  'pengurus-kalender': {
    path: '/kalender',
    ready: (p) =>
      p
        .getByRole('main')
        .filter({ has: p.getByText('IF3170 Inteligensi Buatan') })
        .filter({
          // The month's bars are in: 19 Oktober has its UTS.
          has: p.getByRole('button', { name: /^Senin, 19 Oktober, 1 acara/ }),
        }),
  },
  // Kuis 2's sheet over Kalender on phones and tablets; desktop's locked capture is the plain Kalender.
  'anggota-ov-event': {
    path: '/kalender',
    act: async (page) => {
      if (page.viewportSize()!.width >= 1024) return;
      await page
        .getByRole('main')
        .getByRole('button', { name: /^15\.00.*Kuis 2/ })
        .click();
    },
    ready: (p) =>
      p.viewportSize()!.width >= 1024
        ? p
            .getByRole('main')
            .filter({ has: p.getByText('Determinan dan balikan matriks.') })
        : p
            .getByRole('dialog', { name: 'Detail acara' })
            .filter({ has: p.getByText('Determinan dan balikan matriks.') }),
  },
};
