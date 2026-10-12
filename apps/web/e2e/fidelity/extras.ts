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

export const EXTRAS: Partial<Record<string, ExtraCapture>> = {
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
