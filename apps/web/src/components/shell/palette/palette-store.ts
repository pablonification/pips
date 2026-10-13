/**
 * Whether global search is open, and what to give focus back to when it closes without opening anything. The
 * search field on Beranda, the top bar's search button, the sidebar's search and the keyboard (Ctrl/⌘ K, `/`)
 * all open the same palette.
 */
import { useSyncExternalStore } from 'react';
import { focusPageTitle } from '../focus';

let open = false;
let opener: HTMLElement | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openPalette() {
  if (open) return;
  opener =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  open = true;
  emit();
}

/** Closes it without opening anything: focus goes back to what opened it. */
export function closePalette() {
  if (!open) return;
  open = false;
  emit();
  const back = opener;
  opener = null;
  if (back?.isConnected) requestAnimationFrame(() => back.focus());
}

/**
 * Closes it after an item ran. When the item opened a page, the shell focuses that page's title. When it didn't (an
 * outside service in a new tab, the page you are already on), focus would be left on nothing (review m1): it goes
 * back to what opened search, or to the page's title when search was opened from the keyboard.
 */
export function closePaletteAfterRun() {
  if (!open) return;
  open = false;
  emit();
  const back = opener;
  opener = null;
  const start = location.href;
  setTimeout(() => {
    const active = document.activeElement;
    if (location.href !== start || (active && active !== document.body)) return;
    if (back?.isConnected && back !== document.body) back.focus();
    else focusPageTitle();
  }, 50);
}

export function usePaletteOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => false,
  );
}
