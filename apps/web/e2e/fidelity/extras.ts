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
import type { Page } from '@playwright/test';
import { pixelSections } from '../support/flows';
import * as writes from '../support/writes';
import type { FidelityScreen } from './screens';

export interface ExtraCapture extends FidelityScreen {
  persona?: 'anggota' | 'pengurus' | null;
  /** The element to capture (required for 'element' screens). */
  target?: (page: import('@playwright/test').Page) => Locator;
}

/** P2-A: the PIXEL form as the prototype's check fills it (garis-check.mjs, "Form: required fields; …"). */
const lanjut = (p: Page) => p.getByRole('button', { name: 'Lanjut' }).click();
async function checkFill(p: Page, upTo: 'rating' | 'review') {
  await p.getByRole('radio', { name: 'PIXEL' }).check();
  await p.getByRole('radio', { name: 'IF', exact: true }).check();
  await p.getByRole('radio', { name: 'IF K2' }).check();
  await lanjut(p);
  await p.getByRole('checkbox', { name: 'Other' }).check();
  await p.getByLabel(/^Sebutkan yang kamu maksud/).fill('Main musik');
  await p.getByLabel(/^Selama ikut kegiatan HMIF/).fill('Welcoming party');
  await lanjut(p);
  await p.getByRole('checkbox', { name: 'Ada teman yang ikut' }).check();
  await p.getByLabel(/^Kapan kamu biasanya/).fill('Sabtu sore');
  await lanjut(p);
  await pixelSections[3](p);
  await lanjut(p);
  await p.getByRole('radio', { name: '5', exact: true }).check();
  if (upTo === 'review') await lanjut(p);
}
const fill = '/layanan/form/pixel';
const fillMain = (p: Page) => p.getByRole('main');

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
  // P2-A: the form's interaction captures (phone, light, Nadia).
  'i-form-required': {
    path: fill,
    act: async (p) => lanjut(p),
    ready: (p) => fillMain(p).getByText('Pertanyaan ini wajib diisi').first(),
  },
  'i-form-draft-restored': {
    path: fill,
    act: async (p) => {
      await p.getByRole('radio', { name: 'PIXEL' }).check();
      await p.getByRole('radio', { name: 'IF', exact: true }).check();
      await p.getByRole('radio', { name: 'IF K2' }).check();
      await fillMain(p).getByText('Draf tersimpan').waitFor();
      await p.reload();
    },
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-rating': {
    path: fill,
    act: async (p) => checkFill(p, 'rating'),
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-review': {
    path: fill,
    act: async (p) => checkFill(p, 'review'),
    ready: (p) => fillMain(p).getByText('Draf tersimpan'),
  },
  'i-form-done': {
    path: fill,
    mock: (api) => api.on('POST /api/form/:formId/response', writes.submitForm),
    act: async (p) => {
      await checkFill(p, 'review');
      await p.getByRole('button', { name: 'Kirim jawaban' }).click();
      await p.getByRole('button', { name: 'Kirim', exact: true }).click();
    },
    ready: (p) => p.getByText('Form berhasil dikirim!'),
  },
  // P2-B: Testi Matkul on phones. The locked captures still show a toast from the prototype's previous step
  // ("1 mata kuliah ditambahkan…"); the app has none here (a known difference, in the P2-B report).
  'i-testi': {
    path: '/layanan/testi',
    act: async (p) => {
      const main = p.getByRole('main');
      await main.getByRole('link', { name: 'Teknik Informatika' }).click();
      await main.getByRole('link', { name: 'Semester 3' }).click();
      await main.getByRole('link', { name: /^IF2110 / }).click();
      await main.getByRole('button', { name: 'Testimoni berikutnya' }).click();
    },
    ready: (p) => p.getByRole('article', { name: 'Testimoni 2 dari 3' }),
  },
  'i-testi-search': {
    path: '/layanan/testi',
    act: async (p) => {
      await p
        .getByRole('searchbox', { name: 'Cari mata kuliah' })
        .fill('if2110');
    },
    ready: (p) =>
      p
        .getByRole('main')
        .getByRole('link', { name: /^IF2110 .* 3 testimoni$/ }),
  },
};
