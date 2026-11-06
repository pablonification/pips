/**
 * After a deploy the new service worker takes over open tabs and deletes the old build's files, so a tab that hasn't
 * reloaded fails to load the code of a page it hasn't opened yet (Vite's `vite:preloadError`) and showed the error
 * page. Reloading once fetches the new build. Guarded: not while offline (a reload wouldn't help), and not again
 * within `windowMs` of the last one, so a file that is really missing ends on the error page instead of a loop.
 */
export const PRELOAD_RELOAD_KEY = 'pips-preload-reload';

export interface RecoveryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function shouldReloadAfterPreloadError(
  store: RecoveryStore | null,
  now: number,
  online: boolean,
  windowMs = 60_000,
): boolean {
  if (!online || !store) return false;
  try {
    const last = Number(store.getItem(PRELOAD_RELOAD_KEY));
    if (last && now - last >= 0 && now - last < windowMs) return false;
    store.setItem(PRELOAD_RELOAD_KEY, String(now));
    return true;
  } catch {
    // Storage refused (some private modes): without the guard, don't risk a loop.
    return false;
  }
}

/** Listens for `vite:preloadError` and reloads the page once, as above. */
export function reloadOnPreloadError(win: Window = window) {
  win.addEventListener('vite:preloadError', () => {
    let store: RecoveryStore | null = null;
    try {
      store = win.sessionStorage;
    } catch {
      store = null;
    }
    if (shouldReloadAfterPreloadError(store, Date.now(), win.navigator.onLine))
      win.location.reload();
  });
}
