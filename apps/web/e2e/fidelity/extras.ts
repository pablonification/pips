/**
 * Where each non-route locked screen (names.mjs EXTRA_SCREENS) lives in the real app. A task that builds one adds its
 * entry, as screens.ts does for route screens:
 *
 * ```ts
 * 'i-filter-sheet': {
 *   path: '/pengumuman',
 *   act: async (page) => page.getByRole('button', { name: 'Filter' }).click(),
 *   ready: (page) => page.getByRole('dialog', { name: 'Filter' }),
 * },
 * ```
 *
 * The capture runs in the `fidelity-<layout>-<theme>` project that names.mjs gives the screen, at its viewport.
 * Captures of the app area ('app') and of the window ('page') are viewport screenshots; for an 'element' screen,
 * `target` names the element. Unmapped screens show as "not built yet" in the report; PROTOTYPE_ONLY are skipped.
 */
import type { Locator } from '@playwright/test';
import { visibleText } from '../support/app';
import * as writes from '../support/writes';
import type { FidelityScreen } from './screens';

export interface ExtraCapture extends FidelityScreen {
  persona?: 'anggota' | 'pengurus' | null;
  /** The element to capture (required for 'element' screens). */
  target?: (page: import('@playwright/test').Page) => Locator;
}

/** P0-C: Beranda at other window sizes, for the shell's chrome (bars, rail, sidebar, gold header); P1-A fills it. */
const beranda: ExtraCapture = {
  path: '/',
  ready: (p) => p.getByRole('heading', { name: 'Halo, Nadia' }),
};

export const EXTRAS: Partial<Record<string, ExtraCapture>> = {
  'page-phone-light': beranda,
  'page-phone-dark': beranda,
  'page-narrow320-light': beranda,
  'page-tablet768-light': beranda,
  'page-tablet768-dark': beranda,
  'page-tablet1000-light': beranda,
  'page-desktop-light': beranda,
  'page-desktop-dark': beranda,
  'page-desktop1024-light': beranda,
  'narrow320-beranda': beranda,
  'desk1024-beranda': beranda,
  // P0-A: the design-system gallery, against the prototype's design-system page.
  'system-cards': {
    path: '/dev/garis',
    persona: null,
    ready: (p) => p.getByTestId('garis-sys'),
    target: (p) => p.getByTestId('garis-sys'),
  },
  'system-kit': {
    path: '/dev/garis',
    persona: null,
    ready: (p) => p.getByTestId('garis-kit'),
    target: (p) => p.getByTestId('garis-kit'),
  },
  // P1-B: Pengumuman, reached as garis-check.mjs sections 4a and 4c reach them.
  'i-feed-reacted': {
    path: '/pengumuman',
    mock: (api) => api.on('PUT /api/reaction', writes.react),
    act: async (p) => {
      await visibleText(p, P1_TITLE).waitFor();
      const card = p.getByRole('article', {
        name: new RegExp(`^${P1_TITLE}`),
      });
      // The prototype's picker brings the card to the top of the page.
      await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await card.getByRole('button', { name: /Beri reaksi$/ }).click();
      await p
        .getByRole('group', { name: 'Pilih reaksi' })
        .getByRole('button', { name: 'Keren' })
        .click();
    },
    ready: (p) =>
      p
        .getByRole('article', { name: new RegExp(`^${P1_TITLE}`) })
        .getByRole('button', { name: /^Reaksimu Keren/ }),
  },
  'i-post-detail': {
    path: '/pengumuman/p1',
    mock: (api) => {
      api.on('POST /api/info/:infoId/read', writes.markRead);
      api.on('POST /api/comment', writes.comment);
      api.on('PUT /api/reaction', writes.react);
    },
    act: async (p) => {
      // Continues from i-feed-reacted: Keren is Nadia's.
      await p.getByRole('button', { name: 'Beri reaksi', exact: true }).click();
      await p
        .getByRole('group', { name: 'Pilih reaksi' })
        .getByRole('button', { name: 'Keren' })
        .click();
      await p
        .getByRole('button', { name: 'Ganti reaksi', exact: true })
        .waitFor();
      const field = p.getByRole('textbox', { name: 'Tulis komentar' });
      await field.fill('Kak, IF2120 K02 di ruang mana?');
      await p.getByRole('button', { name: 'Kirim komentar' }).click();
    },
    ready: (p) =>
      p.getByRole('main').getByText('Kak, IF2120 K02 di ruang mana?').first(),
  },
  'i-filter-sheet': {
    path: '/pengumuman',
    act: async (p) => {
      await visibleText(p, P1_TITLE).waitFor();
      await p.getByRole('button', { name: /^Kategori/ }).click();
      await p
        .getByRole('dialog', { name: 'Kategori yang ditampilkan' })
        .getByRole('switch', { name: 'Akademik' })
        .click();
    },
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Kategori yang ditampilkan' })
        .getByRole('switch', { name: 'Akademik', checked: false }),
  },
  'i-compose-anggota': {
    path: '/pengumuman/tulis',
    act: async (p) => {
      await p.getByRole('button', { name: 'Umumkan' }).click();
      await p
        .getByRole('textbox', { name: 'Isi pengumuman' })
        .fill(
          'Ada yang mau bareng ke Jatinangor Sabtu pagi? Berangkat dari Ganesha 06.30.',
        );
      await p.getByRole('checkbox', { name: 'Umum' }).click();
    },
    ready: (p) => p.getByRole('checkbox', { name: 'Umum', checked: true }),
  },
  'i-desk-own-menu': {
    path: '/pengumuman/p1',
    persona: 'pengurus',
    mock: (api) => api.on('POST /api/info/:infoId/read', writes.markRead),
    act: async (p) => {
      await p
        .locator('article.g-detail')
        .getByRole('button', { name: `Opsi untuk ${P1_TITLE}` })
        .click();
    },
    ready: (p) => p.getByRole('menuitem', { name: /Bisa lagi mulai 15\.30/ }),
  },
};

const P1_TITLE = 'Jadwal UTS Ganjil 2026/2027 sudah keluar';
