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
  /** This device's notifications (P1-A: i-palette-phone has them on); the persona's default otherwise. */
  push?: import('../support/push').PushMode;
  /** The element to capture (required for 'element' screens). */
  target?: (page: import('@playwright/test').Page) => Locator;
}

/** P0-C: Beranda at other window sizes, for the shell's chrome (bars, rail, sidebar, gold header); P1-A's content, ready
 * once every section has its data. */
const beranda: ExtraCapture = {
  path: '/',
  ready: (p) =>
    p
      .getByRole('main')
      .filter({ has: p.getByRole('heading', { name: 'Halo, Nadia' }) })
      .filter({ has: p.getByText('IF2123 Aljabar Linier dan Geometri') })
      .filter({ has: p.getByText('Notifikasi belum menyala') })
      .filter({ has: p.getByText('PIXEL, isi Form Analisis Kondisi ya!') }),
};

/** P1-A: Nadia's Kalender on Jumat 9 Oktober with Deadline Tugas Besar 1 open (a sheet, a centred panel on tablets). */
const deadlineSheet: ExtraCapture = {
  path: '/kalender?hari=2026-10-09',
  act: async (page) => {
    await page
      .getByRole('main')
      .getByRole('button', { name: /Deadline Tugas Besar 1/ })
      .click();
  },
  ready: (p) =>
    p.getByRole('dialog', { name: 'Detail acara' }).filter({
      has: p.getByText('Kumpulkan di Edunex. Satu kelompok tiga orang.'),
    }),
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
  // P1-A: the event sheet, and search.
  'i-event-sheet': deadlineSheet,
  'i-tablet-sheet': deadlineSheet,
  'i-palette': {
    // Raka on Kalender, Selasa 13 Oktober, after P3-B's flow added Kuis 2 for IF3170 (13.00–15.00); search "IF3170".
    persona: 'pengurus',
    path: '/kalender?hari=2026-10-13&acara=b10',
    mock: (api) => {
      api.db.events.push({
        id: 'b10',
        calendarGroupId: 'group-IF3170',
        courseId: 'course-IF3170',
        title: 'Kuis 2',
        description: '',
        category: 'akademik',
        academicYear: 2026,
        academicSemesterCode: 'Ganjil',
        start: '2026-10-13T06:00:00.000Z',
        end: '2026-10-13T08:00:00.000Z',
        googleCalendarUrl:
          'https://calendar.google.com/calendar/event?eid=e2e-b10',
        googleCalendarId: 'e2e-b10',
      });
    },
    act: async (page) => {
      await page
        .getByRole('region', { name: 'Acara hari terpilih' })
        .getByRole('heading', { name: 'Kuis 2' })
        .waitFor();
      await page.keyboard.press('Control+k');
      await page
        .getByRole('combobox', { name: 'Cari di PIPS!' })
        .fill('IF3170');
    },
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Pencarian global' })
        .filter({ has: p.getByRole('option', { name: /^UTS · IF3170/ }) })
        .filter({
          has: p.getByRole('option', { name: /^IF3170 Inteligensi Buatan/ }),
        }),
  },
  'i-palette-phone': {
    // Nadia on Beranda with notifications on, search open, nothing typed.
    push: 'on',
    path: '/',
    act: async (page) => {
      await page
        .getByRole('main')
        .filter({ has: page.getByText('PIXEL, isi Form Analisis Kondisi ya!') })
        .waitFor();
      await page.getByRole('button', { name: 'Cari di PIPS!' }).click();
      await page.getByRole('dialog', { name: 'Pencarian global' }).waitFor();
      // Then, as in the locked capture, the page behind is scrolled to Pengumuman belum dibaca (its heading's top 491 px down).
      await page.evaluate(() => {
        const scroller = document.querySelector(
          '[data-scroll-restoration-id="isi"]',
        )!;
        const h = [...document.querySelectorAll('#isi h2')].find(
          (e) => e.textContent === 'Pengumuman belum dibaca',
        )!;
        scroller.scrollTop += h.getBoundingClientRect().top - 491;
      });
    },
    ready: (p) =>
      p
        .getByRole('dialog', { name: 'Pencarian global' })
        .filter({ has: p.getByRole('option', { name: /^Bayar Kas!/ }) }),
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
