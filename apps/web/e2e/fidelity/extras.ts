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
  // P1-C: "IF2211" typed and K2 picked. i-push-dialog waits for P1-A's Beranda (the prompt over it); until then the
  // ov-push captures compare the prompt over Notifikasi.
  'i-matkul-add': {
    path: '/profil/matkul/tambah',
    act: async (p) => {
      const main = p.getByRole('main');
      await main.getByText('Strategi Algoritma').waitFor();
      await main
        .getByRole('searchbox', { name: 'Cari mata kuliah' })
        .fill('IF2211');
      await main
        .getByRole('radiogroup', { name: 'Kelas IF2211' })
        .getByRole('radio', { name: 'K2' })
        .click();
      // The prototype's capture shows no focus ring: the search field and chip were used by pointer.
      await p.evaluate(() =>
        (document.activeElement as HTMLElement | null)?.blur(),
      );
    },
    ready: (p) =>
      p
        .getByRole('button', { name: /^Tambahkan \(1\)/ })
        .locator('visible=true'),
  },
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
};
