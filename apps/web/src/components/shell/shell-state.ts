/**
 * What the shell remembers between pages, outside React: titles screens gave themselves, the history entries this
 * visit has seen (for back's label and whether history leads to a page of the app) and the last tab you were on
 * (Profil's back target on phones). Kept in sessionStorage, so a reload in the middle of a visit keeps them.
 * Titles from data can be the member's (a Curhat room, a form), so `forgetShell()` clears all of it whenever the
 * member's data goes: at sign-out, on a 401 and when someone signs in (src/lib/forget-member.ts, review M5). Signing
 * in also starts back's history afresh, so back never follows an entry from before.
 */
import { useSyncExternalStore } from 'react';
import { DESTINATIONS, type Destination } from '~/lib/shell/routes';

const KEY = 'pips:shell';

interface Saved {
  /** Titles screens set with usePageTitle(), by pathname. */
  titles: Record<string, string>;
  /** Each history entry this visit: its index → the pathname and title shown. */
  entries: Record<number, { pathname: string; title: string }>;
  lastRoot: Destination;
}

function load(): Saved {
  const empty: Saved = {
    titles: {},
    entries: {},
    lastRoot: 'beranda',
  };
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return empty;
    const v = JSON.parse(raw) as Partial<Saved>;
    return {
      titles: v.titles ?? {},
      entries: v.entries ?? {},
      lastRoot: DESTINATIONS.includes(v.lastRoot as Destination)
        ? (v.lastRoot as Destination)
        : 'beranda',
    };
  } catch {
    return empty;
  }
}

let state: Saved | null = null;
const listeners = new Set<() => void>();
const get = () => (state ??= load());

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function write() {
  writeTimer = null;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(get()));
  } catch {
    /* storage blocked: remembered for this page only */
  }
}
function save() {
  if (writeTimer) return;
  writeTimer = setTimeout(write, 200);
}
// A reload or another page within the 200 ms would lose the waiting write (the last tab, back's entries): write it
// as the page goes (P1-A round 2; seen once pages loaded fast enough).
if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    if (writeTimer) {
      clearTimeout(writeTimer);
      write();
    }
  });

/** Forgets every title, the history entries and the last tab, in memory and in the tab's storage. */
export function forgetShell() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  state = { titles: {}, entries: {}, lastRoot: 'beranda' };
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: nothing was kept there */
  }
  listeners.forEach((l) => l());
}

function change(update: (s: Saved) => Saved) {
  state = update(get());
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The title a screen gave the page at `pathname`, if any. */
export const titleFor = (pathname: string): string | undefined =>
  get().titles[pathname];

export function setTitleFor(pathname: string, title: string) {
  if (get().titles[pathname] === title) return;
  change((s) => ({ ...s, titles: { ...s.titles, [pathname]: title } }));
}

/** The titles screens gave pages, as `useTitles` sees them. */
export const titlesSnapshot = () => get().titles;

/** Re-renders when a screen sets a title. */
export function useTitles(): Record<string, string> {
  return useSyncExternalStore(subscribe, titlesSnapshot, () => ({}));
}

export function recordEntry(index: number, pathname: string, title: string) {
  const e = get().entries[index];
  if (e && e.pathname === pathname && e.title === title) return;
  change((s) => ({
    ...s,
    entries: { ...s.entries, [index]: { pathname, title } },
  }));
}

export const entryAt = (index: number) => get().entries[index];

export const lastRoot = () => get().lastRoot;
export function setLastRoot(root: Destination) {
  if (get().lastRoot !== root) change((s) => ({ ...s, lastRoot: root }));
}
export function useLastRoot(): Destination {
  return useSyncExternalStore(subscribe, lastRoot, () => 'beranda' as const);
}
