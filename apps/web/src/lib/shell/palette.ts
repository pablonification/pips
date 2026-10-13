/**
 * Global search's rules (the prototype's `renderPal` in `garis/app.js`), apart from React so they can be tested.
 * With no query it shows the starting actions and the pinned services ("Pintasan"); with one, every item whose
 * label, hint or keywords contain it, label matches first, then in the sources' order, at most 12, grouped in the
 * order the groups first appear.
 */
import type { IconKey } from '~/components/icons/registry';

export interface PaletteItem {
  /** Unique across all sources. */
  id: string;
  /** The group heading: Tindakan, Layanan, Pengumuman, Kalender, Mata kuliah, Orang. */
  group: string;
  label: string;
  icon: IconKey;
  /** The short line at the right ("Situs luar", a date, "Ding Dong"). */
  hint: string;
  /** More words it is found by, lower case. */
  keywords?: string;
  /** Shown before anything is typed, in the actions group. */
  start?: boolean;
  /** Shown before anything is typed, under "Pintasan". */
  pinned?: boolean;
  run: () => void;
}

export interface PaletteGroup {
  heading: string;
  items: PaletteItem[];
}

export const PALETTE_LIMIT = 12;

/** The items to show for `query`, grouped. `pinnedHeading` names the pinned group when nothing is typed. */
export function paletteResults(
  items: readonly PaletteItem[],
  query: string,
  pinnedHeading: string,
): PaletteGroup[] {
  const q = query.trim().toLowerCase();
  let shown: { item: PaletteItem; heading: string }[];
  if (!q) {
    shown = items
      .filter((r) => r.start || r.pinned)
      .map((item) => ({
        item,
        heading: item.pinned ? pinnedHeading : item.group,
      }));
  } else {
    const score = (r: PaletteItem) =>
      r.label.toLowerCase().includes(q) ? 2 : 1;
    shown = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) =>
        `${item.label} ${item.hint} ${item.keywords ?? ''}`
          .toLowerCase()
          .includes(q),
      )
      .sort((a, b) => score(b.item) - score(a.item) || a.i - b.i)
      .slice(0, PALETTE_LIMIT)
      .map(({ item }) => ({ item, heading: item.group }));
  }
  const groups: PaletteGroup[] = [];
  for (const { item, heading } of shown) {
    let g = groups.find((x) => x.heading === heading);
    if (!g) groups.push((g = { heading, items: [] }));
    g.items.push(item);
  }
  return groups;
}

/** The shortcut's name as the platform writes it (the prototype's `MOD`). */
export function modKeyLabel(platform: string): string {
  return /Mac|iPhone|iPad/.test(platform) ? '⌘K' : 'Ctrl K';
}

/** Whether a key press should open search: Ctrl/⌘ K anywhere, `/` when not typing (SPEC story 22). */
export function opensPalette(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k')
    return true;
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target as {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;
  if (!t) return true;
  const tag = (t.tagName ?? '').toUpperCase();
  return !(
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    t.isContentEditable
  );
}
