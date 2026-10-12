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
