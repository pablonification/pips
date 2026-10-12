// The locked prototype's screen names, as ops/ui-revamp-review/tools/garis-check.mjs renders them:
// `<layout>-<persona>-<route>-<theme>.png` for ROUTES (anggota) and PENGURUS_ROUTES (pengurus), at three layouts
// and two themes: 36 routes × 3 × 2 = 216 screens.

/** Nadia's screens (anggota), in garis-check.mjs order. */
export const ROUTES = [
  'beranda',
  'pengumuman',
  'post',
  'kalender',
  'layanan',
  'dingdong',
  'testi-course',
  'testi-list',
  'nim',
  'lomba',
  'curhat',
  'room',
  'form',
  'fill',
  'profil',
  'matkul',
  'matkul-add',
  'notif',
  'tulis',
  'ov-event',
  'ov-filter',
  'ov-push',
  'ov-confirm',
  'pop-react',
  'pop-menu',
];
/** Raka's screens (pengurus). */
export const PENGURUS_ROUTES = [
  'beranda',
  'pengumuman',
  'kalender',
  'layanan',
  'kelola',
  'live',
  'form-empty',
  'curhat-empty',
  'profil',
  'ov-addev',
  'pop-menu-own',
];

export const LAYOUTS = /** @type {const} */ (['phone', 'tablet', 'desk']);
export const THEMES = /** @type {const} */ (['light', 'dark']);

/** Capture sizes: the element garis-check.mjs screenshots, in CSS px, and its device scale. */
export const SIZES = {
  phone: { width: 390, height: 800, deviceScaleFactor: 2 },
  tablet: { width: 834, height: 1068, deviceScaleFactor: 1 },
  desk: { width: 1440, height: 956, deviceScaleFactor: 1 },
};

/** @param {'anggota' | 'pengurus'} persona @param {string} route */
export const screenKey = (persona, route) => `${persona}-${route}`;

/** Every locked screen: { name, layout, theme, persona, route }. */
export function screenNames() {
  const out = [];
  for (const [persona, routes] of /** @type {const} */ ([
    ['anggota', ROUTES],
    ['pengurus', PENGURUS_ROUTES],
  ]))
    for (const route of routes)
      for (const theme of THEMES)
        for (const layout of LAYOUTS)
          out.push({
            name: `${layout}-${persona}-${route}-${theme}`,
            layout,
            theme,
            persona,
            route,
          });
  return out;
}

/**
 * The locked screens that aren't `<layout>-<persona>-<route>-<theme>`: interactions (`i-*`), the page at other
 * sizes (`page-*`, `narrow320-beranda`, `desk1024-beranda`) and the design-system page (`system-*`), as
 * garis-check.mjs renders them. `viewport` is the window it was taken in; `capture` is what it shows: the app area
 * (the prototype's #phone or #desktop element, under its 44 px prototype bar), the whole viewport (`page`, including
 * that bar), or one element of the design-system page. The project is `fidelity-<layout>-<theme>`, whose device
 * scale matches (phone 2, tablet and desk 1). e2e/fidelity/extras.ts maps them to the app.
 * @typedef {{ name: string, layout: 'phone' | 'tablet' | 'desk', theme: 'light' | 'dark',
 *   viewport: { width: number, height: number }, capture: 'app' | 'page' | 'element', note?: string }} ExtraScreen
 */
/** @type {(name: string, layout: ExtraScreen['layout'], width: number, height: number, capture: ExtraScreen['capture'], note?: string) => ExtraScreen} */
const extra = (name, layout, width, height, capture, note) => ({
  name,
  layout,
  theme: name.endsWith('-dark') ? 'dark' : 'light',
  viewport: { width, height },
  capture,
  ...(note ? { note } : {}),
});
const PHONE_APP = /** @type {const} */ ([390, 800]);
const DESK_APP = /** @type {const} */ ([1440, 956]);

/** @type {ExtraScreen[]} Locked screens that an app task owns (briefs-check-wave2.md, "Coverage"). */
export const EXTRA_SCREENS = [
  ...[
    'i-compose-anggota',
    'i-curhat-room',
    'i-event-sheet',
    'i-feed-reacted',
    'i-filter-sheet',
    'i-form-done',
    'i-form-draft-restored',
    'i-form-rating',
    'i-form-required',
    'i-form-review',
    'i-matkul-add',
    'i-post-detail',
    'i-push-dialog',
    'i-testi-search',
    'i-testi',
  ].map((n) => extra(n, 'phone', ...PHONE_APP, 'app')),
  ...[
    'i-desk-addev',
    'i-desk-kalender-after',
    'i-desk-live',
    'i-desk-own-menu',
  ].map((n) => extra(n, 'desk', ...DESK_APP, 'app')),
  extra(
    'i-palette-phone',
    'phone',
    390,
    844,
    'page',
    'includes the prototype bar (44 px) above the app',
  ),
  extra(
    'i-palette',
    'desk',
    1440,
    1000,
    'page',
    'includes the prototype bar (44 px) above the app',
  ),
  extra(
    'i-tablet-sheet',
    'tablet',
    834,
    1112,
    'page',
    'includes the prototype bar (44 px) above the app',
  ),
  extra('narrow320-beranda', 'phone', 320, 800, 'app'),
  extra('desk1024-beranda', 'desk', 1024, 956, 'app'),
  ...[
    ['page-phone-light', 'phone', 390, 844],
    ['page-phone-dark', 'phone', 390, 844],
    ['page-narrow320-light', 'phone', 320, 844],
    ['page-tablet768-light', 'tablet', 768, 1112],
    ['page-tablet768-dark', 'tablet', 768, 1112],
    ['page-tablet1000-light', 'tablet', 1000, 1112],
    ['page-desktop-light', 'desk', 1440, 1000],
    ['page-desktop-dark', 'desk', 1440, 1000],
    ['page-desktop1024-light', 'desk', 1024, 1000],
  ].map(([n, l, w, h]) =>
    extra(
      /** @type {string} */ (n),
      /** @type {ExtraScreen['layout']} */ (l),
      /** @type {number} */ (w),
      /** @type {number} */ (h),
      'page',
      'includes the prototype bar (44 px) above the app',
    ),
  ),
  extra(
    'system-cards',
    'desk',
    1440,
    1000,
    'element',
    'the design-system cards (#sys)',
  ),
  extra(
    'system-kit',
    'desk',
    1440,
    1000,
    'element',
    'the components in both themes (#kit)',
  ),
];

/** Locked screens of the prototype itself (its bar, forced layouts, notes page): never mapped to the app. */
export const PROTOTYPE_ONLY = [
  'proto-panel-phone',
  'i-force-phone-dark',
  'i-force-tablet',
  'page-force-phone-light',
  'page-force-phone-dark',
  'page-force-tablet-light',
  'page-force-tablet-dark',
  'system-feature-map',
  'system-page-desktop-light',
  'system-page-desktop-dark',
  'system-page-phone-light',
];
