/**
 * Whether global search is open, and what to give focus back to when it closes without opening anything. The
 * search field on Beranda, the top bar's search button, the sidebar's search and the keyboard (Ctrl/⌘ K, `/`)
 * all open the same palette.
 */
import { useSyncExternalStore } from 'react';

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

/** Closes it; `returnFocus` false when an item was opened (the shell then focuses the new page's title). */
export function closePalette(returnFocus = true) {
  if (!open) return;
  open = false;
  emit();
  const back = opener;
  opener = null;
  if (returnFocus && back?.isConnected)
    requestAnimationFrame(() => back.focus());
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
