// The theme rules, shared by the app (theme.ts, useTheme.ts) and the unit tests. index.html has its own copy of the
// rules in its pre-paint <script>; tests/garis-theme.test.mjs runs that script and checks it agrees with these.

/** Where the preference is stored. */
export const THEME_STORAGE_KEY = 'pips:theme';
/** The status-bar colour per theme: the app background (SPEC "Switching mechanism"). */
export const THEME_COLORS = { light: '#FCFBF8', dark: '#0A0907' };
export const THEME_PREFERENCES = ['system', 'light', 'dark'];

/** @param {unknown} value @returns {'system' | 'light' | 'dark'} */
export function parsePreference(value) {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** @param {'system' | 'light' | 'dark'} preference @param {boolean} systemDark */
export function resolveTheme(preference, systemDark) {
  return preference === 'dark' || (preference === 'system' && systemDark)
    ? 'dark'
    : 'light';
}

/**
 * Applies a resolved theme to the document: the `.dark` class, `color-scheme` and the theme-color meta.
 * @param {Document} doc @param {'light' | 'dark'} theme
 */
export function applyResolvedTheme(doc, theme) {
  const root = doc.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
}
