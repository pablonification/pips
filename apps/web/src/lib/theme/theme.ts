/**
 * The theme: a stored preference (system, light or dark; default system) resolved against the system setting.
 * index.html applies it before first paint; this module keeps it applied while the app runs and lets screens
 * change it. Transitions are suppressed for one frame during a switch, so nothing animates between themes.
 */
import {
  applyResolvedTheme,
  parsePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme-core.mjs';

export type { ResolvedTheme, ThemePreference };
export { THEME_PREFERENCES } from './theme-core.mjs';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

export function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function currentTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
let preference: ThemePreference | null = null;

function apply(pref: ThemePreference) {
  const block = document.createElement('style');
  block.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(block);
  applyResolvedTheme(document, resolveTheme(pref, query().matches));
  void document.body.offsetHeight; // commit the change without transitions
  requestAnimationFrame(() => requestAnimationFrame(() => block.remove()));
  listeners.forEach((l) => l());
}

export function getPreference(): ThemePreference {
  if (preference === null) preference = readPreference();
  return preference;
}

export function setPreference(pref: ThemePreference) {
  preference = pref;
  try {
    if (pref === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  apply(pref);
}

let watching = false;
/** Follows the system setting while the preference is "system"; returns an unsubscribe function. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    query().addEventListener('change', () => {
      if (getPreference() === 'system') apply('system');
    });
    window.addEventListener('storage', (e) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      preference = parsePreference(e.newValue);
      apply(preference);
    });
  }
  return () => {
    listeners.delete(listener);
  };
}
