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
import { fillPixelUpTo } from '../support/flows';
import * as writes from '../support/writes';

export interface FidelityScreen {
  path: string;
  /** Another URL for some layouts (the desktop split shows a post at `/pengumuman`, without opening it). */
  paths?: Partial<Record<'phone' | 'tablet' | 'desk', string>>;
  layouts?: ('phone' | 'tablet' | 'desk')[];
  mock?: (api: ApiMock) => void;
  act?: (
    page: Page,
    ctx: { api: ApiMock; context: BrowserContext },
  ) => Promise<void>;
  ready: (page: Page) => Locator;
}

type Key = `anggota-${string}` | `pengurus-${string}`;

const P1_TITLE = 'Jadwal UTS Ganjil 2026/2027 sudah keluar';
const P2_TITLE = 'Cari tim Gemastik XIX? Isi form ini';
/** P1-B: the feed; on desktop with p1 beside it, not marked read. */
const pengumumanFeed: FidelityScreen = {
  path: '/pengumuman',
  ready: (p) => visibleText(p, P1_TITLE),
};

/**
 * One entry, or several when layouts differ (each with its `layouts`): `anggota-ov-confirm` is the sign-out sheet on
 * phones and tablets (P1-C) and the form's send dialog on desktop (P2-A).
 */
export const SCREENS: Partial<Record<Key, FidelityScreen | FidelityScreen[]>> =
  {
    // Today's app (before the redesign).
    'anggota-beranda': { path: '/', ready: (p) => visibleText(p, 'Kuis 2') },
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
    // P2-A: Form (PIXEL).
    'anggota-form': {
      path: '/layanan/form',
      ready: (p) =>
        p.getByRole('main').getByRole('link', { name: /Form Analisis/ }),
    },
    'anggota-fill': {
      path: '/layanan/form/pixel',
      ready: (p) =>
        p.getByRole('main').getByRole('heading', { name: 'Identitas' }),
    },
    'pengurus-form-empty': {
      path: '/layanan/form',
      ready: (p) => p.getByRole('main').getByText('Belum ada form untukmu'),
    },
    // The send dialog on desktop, over the check page (the locked capture has Profil behind it).
    'anggota-ov-confirm': [
      {
        path: '/layanan/form/pixel',
        layouts: ['desk'],
        act: async (p) => {
          await fillPixelUpTo(p, 5);
          await p.getByRole('button', { name: 'Kirim jawaban' }).click();
        },
        ready: (p) => p.getByRole('alertdialog', { name: 'Kirim jawaban?' }),
      },
    ],

    // P2-C: Curhat Yuk! for members. A pengurus without rooms sees the member side, empty (not the Welfare inbox).
    'anggota-curhat': {
      path: '/layanan/curhat',
      ready: (p) =>
        p.getByRole('main').getByRole('link', { name: /^Amber Heron/ }),
    },
    'anggota-room': {
      path: '/layanan/curhat/r1',
      mock: (api) =>
        api.on('POST /api/curhat/chatroom/:chatroomId/read', writes.readRoom),
      ready: (p) => p.getByRole('log', { name: 'Percakapan Teal Koala' }),
    },
    'pengurus-curhat-empty': {
      path: '/layanan/curhat',
      ready: (p) => p.getByRole('main').getByText('Belum ada ruang cerita'),
    },

    // P1-B: Pengumuman. The phone and tablet captures of the locked `post` were set without opening p1, so they show 4
    // unread where the app (which marks it read) shows 3.
    'anggota-pengumuman': pengumumanFeed,
    'pengurus-pengumuman': pengumumanFeed,
    'anggota-post': {
      path: '/pengumuman/p1',
      paths: { desk: '/pengumuman' },
      mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
      ready: (p) =>
        p
          .locator('article.g-detail')
          .getByText('Komentar', { exact: false })
          .first(),
    },
    'anggota-tulis': {
      path: '/pengumuman/tulis',
      ready: (p) => p.getByRole('textbox', { name: 'Isi pengumuman' }),
    },
    'anggota-ov-filter': {
      path: '/pengumuman',
      act: async (p) => {
        await visibleText(p, P1_TITLE).waitFor();
        await p.getByRole('button', { name: /^Kategori/ }).click();
      },
      ready: (p) =>
        p.getByRole('dialog', { name: 'Kategori yang ditampilkan' }),
    },
    'anggota-pop-react': {
      path: '/pengumuman',
      act: async (p) => {
        await visibleText(p, P1_TITLE).waitFor();
        const desk = (p.viewportSize()?.width ?? 0) >= 1024;
        const scope = desk
          ? p.locator('article.g-detail')
          : p.getByRole('article', { name: new RegExp(`^${P1_TITLE}`) });
        await scope
          .getByRole('button', { name: /Beri reaksi$|Ganti reaksi$/ })
          .last()
          .click();
      },
      ready: (p) => p.getByRole('group', { name: 'Pilih reaksi' }),
    },
    'anggota-pop-menu': {
      path: '/pengumuman',
      act: async (p) => {
        await visibleText(p, P1_TITLE).waitFor();
        const desk = (p.viewportSize()?.width ?? 0) >= 1024;
        await p
          .getByRole('button', {
            name: `Opsi untuk ${desk ? P1_TITLE : P2_TITLE}`,
          })
          .first()
          .click();
      },
      ready: (p) => p.getByRole('menu'),
    },
    'pengurus-pop-menu-own': {
      path: '/pengumuman/p1',
      paths: { desk: '/pengumuman/p5' },
      mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
      act: async (p) => {
        const desk = (p.viewportSize()?.width ?? 0) >= 1024;
        const title = desk ? 'Rapat koordinasi divisi Akademik' : P1_TITLE;
        await p
          .getByRole('button', { name: `Opsi untuk ${title}` })
          .first()
          .click();
      },
      ready: (p) => p.getByRole('menu'),
    },
  };
