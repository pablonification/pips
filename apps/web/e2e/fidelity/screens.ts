/**
 * Where each locked prototype screen lives in the real app: one entry per `<persona>-<route>` from names.mjs.
 *
 * A redesign task fills in the screens it builds: the URL, any mock overrides, steps to reach the state (open a
 * sheet, a popover, a dialog), and what is visible when it is ready. Screens without an entry show as "not built
 * yet" in the fidelity report. `layouts` limits an entry to some layouts when the others differ; a key can hold a
 * list of entries for different layouts.
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

/**
 * One entry per key, or several when layouts reach the state differently (`desk-anggota-ov-confirm` is P2-A's
 * send-form dialog, the phone and tablet ones P1-C's Keluar): each then names its `layouts`.
 */
export const SCREENS: Partial<Record<Key, FidelityScreen | FidelityScreen[]>> =
  {
    // Today's app (before the redesign).
    'anggota-beranda': { path: '/', ready: (p) => visibleText(p, 'Kuis 2') },
    'anggota-pengumuman': {
      path: '/pengumuman',
      ready: (p) => visibleText(p, 'Jadwal UTS Ganjil 2026/2027 sudah keluar'),
    },
    'anggota-post': {
      path: '/pengumuman/p1',
      mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
      ready: (p) =>
        visibleText(p, 'Kak, IF2123 K01 sama K02 ruangnya beda ya?'),
    },
    'anggota-kalender': {
      path: '/kalender',
      ready: (p) => visibleText(p, 'Sharing Session: Magang di Startup'),
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
    'pengurus-kelola': {
      path: '/kelola',
      ready: (p) => p.getByRole('link', { name: /Data SPARTA Magang/ }),
    },
    'pengurus-live': {
      path: '/kelola/live/pixel',
      ready: (p) => visibleText(p, 'Halaman 1 dari 8'),
    },
    // P1-C: Profil, Mata kuliahku, Tambah mata kuliah, Notifikasi, the push prompt, Keluar and Layanan.
    'anggota-profil': {
      path: '/profil',
      ready: (p) => p.getByRole('main').getByText('6 mata kuliah · 18 SKS'),
    },
    'pengurus-profil': {
      path: '/profil',
      ready: (p) => p.getByRole('main').getByText('6 mata kuliah · 19 SKS'),
    },
    'anggota-matkul': {
      path: '/profil/matkul',
      ready: (p) => p.getByRole('main').getByText('Jumlah SKS'),
    },
    'anggota-matkul-add': {
      path: '/profil/matkul/tambah',
      ready: (p) => p.getByRole('main').getByText('Strategi Algoritma'),
    },
    'anggota-notif': {
      path: '/profil/notifikasi',
      ready: (p) => p.getByRole('main').getByRole('switch', { name: 'Lomba' }),
    },
    'anggota-ov-push': {
      path: '/profil/notifikasi',
      act: async (p) => {
        await p
          .getByRole('main')
          .getByRole('switch', { name: 'Lomba' })
          .waitFor();
        await p
          .getByRole('main')
          .getByRole('button', { name: 'Nyalakan notifikasi' })
          .click();
      },
      ready: (p) => p.getByRole('dialog', { name: 'Nyalakan notifikasi?' }),
    },
    'anggota-ov-confirm': [
      {
        // Keluar's confirmation; on desktop this key is P2-A's send-form dialog.
        path: '/profil',
        layouts: ['phone', 'tablet'],
        act: async (p) => {
          await p
            .getByRole('main')
            .getByText('6 mata kuliah · 18 SKS')
            .waitFor();
          // Clicked in place, as the prototype's capture: the page stays at its top behind the sheet.
          await p
            .getByRole('main')
            .getByRole('button', { name: 'Keluar' })
            .evaluate((b: HTMLElement) => b.click());
        },
        ready: (p) =>
          p.getByRole('alertdialog', { name: 'Keluar dari PIPS!?' }),
      },
    ],
    'anggota-layanan': {
      path: '/layanan',
      ready: (p) => p.getByRole('main').getByText('1 belum diisi'),
    },
    'pengurus-layanan': {
      path: '/layanan',
      ready: (p) => p.getByRole('main').getByText('Tambah acara Akademik'),
    },
    'pengurus-form-empty': {
      path: '/layanan/form',
      ready: (p) => visibleText(p, 'Belum ada form untuk kamu'),
    },
  };

/** The entry for a key at one layout, if any. */
export function screenFor(
  key: Key,
  layout: 'phone' | 'tablet' | 'desk',
): FidelityScreen | undefined {
  return [SCREENS[key] ?? []]
    .flat()
    .find((s) => !s.layouts || s.layouts.includes(layout));
}
