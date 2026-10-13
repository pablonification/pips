import type { FileRouteTypes } from '~/routeTree.gen';
import { common } from '~/copy/common';
import { serviceById } from '~/lib/services';

/*
 * What the shell needs to know about every page (SPEC "Information architecture and shell"; the prototype's
 * `titleOf`, `ROOTS` and stacks in `garis/app.js`): its title, the page above it, which destination it belongs to,
 * and whether it is a focused flow. The key is the route's path, so TypeScript fails until a new route has an
 * entry here. A screen with a title from its data (a form, a room, a post) sets it with `usePageTitle()`.
 * Add entries in their own commit and don't reorder others' (WORKER-RULES, "Shared files").
 */

/** The four tabs, in the prototype's order (`ROOTS`). */
export const DESTINATIONS = [
  'beranda',
  'pengumuman',
  'kalender',
  'layanan',
] as const;
export type Destination = (typeof DESTINATIONS)[number];

export const DESTINATION_PATH = {
  beranda: '/',
  pengumuman: '/pengumuman',
  kalender: '/kalender',
  layanan: '/layanan',
} as const satisfies Record<Destination, ShellPath>;

/** Every page inside the shell. Sign-in and the design-system gallery have no shell. */
export type ShellPath = Exclude<FileRouteTypes['to'], '/login' | '/dev/garis'>;

/** The page above a Profil page on phones: the destination you came from (`LAST_ROOT`), as the prototype's stack. */
export const LAST_ROOT = 'last-root' as const;

export interface RouteMeta {
  /** The page's name: top bar, breadcrumbs, back ("Kembali ke …") and the document title ("… · PIPS!"). */
  title: string | ((params: Record<string, string>) => string);
  /** One of the four tabs: the page is that tab's root. */
  root?: Destination;
  /** The page above it, for back without history and for the breadcrumbs. */
  parent?: ShellPath | typeof LAST_ROOT;
  /**
   * On desktop the page is a sidebar item of its own (Kelola, Profil): the breadcrumbs start here and the sidebar
   * lights it. On phones and tablets it is still reached from `parent`.
   */
  deskRoot?: 'kelola' | 'profil';
  /**
   * False on a split page on desktop, which shows no breadcrumbs: the post beside the feed (the prototype's
   * `openPost` starts a new stack, so `renderDesk` shows no trail).
   */
  crumbs?: false;
  /** Filling a form, writing an announcement, a Curhat room: no tab bar or rail, back stays (SPEC story 19). */
  focused?: boolean;
  /** Today's screen, not yet redesigned: the shell keeps it on its old light surface (P0-C report). */
  legacy?: boolean;
}

const nav = common.nav;
const svc = (id: Parameters<typeof serviceById>[0]) => serviceById(id).label;

export const ROUTE_META: Record<ShellPath, RouteMeta> = {
  '/': { title: nav.beranda, root: 'beranda' },
  '/pengumuman': { title: nav.pengumuman, root: 'pengumuman', legacy: true },
  '/pengumuman/$id': {
    title: nav.pengumuman,
    parent: '/pengumuman',
    crumbs: false,
    legacy: true,
  },
  '/pengumuman/tulis': {
    title: common.shell.buatPengumuman,
    parent: '/pengumuman',
    focused: true,
    legacy: true,
  },
  '/kalender': { title: nav.kalender, root: 'kalender', legacy: true },
  '/layanan': { title: nav.layanan, root: 'layanan', legacy: true },
  '/layanan/dingdong': {
    title: svc('dingdong'),
    parent: '/layanan',
    legacy: true,
  },
  '/layanan/nim': { title: svc('nim'), parent: '/layanan', legacy: true },
  '/layanan/lomba': { title: svc('lomba'), parent: '/layanan', legacy: true },
  '/layanan/curhat': {
    title: svc('curhat'),
    parent: '/layanan',
    legacy: true,
  },
  '/layanan/curhat/$roomId': {
    title: common.shell.ruang,
    parent: '/layanan/curhat',
    focused: true,
    legacy: true,
  },
  '/layanan/form': { title: svc('form'), parent: '/layanan', legacy: true },
  '/layanan/form/$formId': {
    title: svc('form'),
    parent: '/layanan/form',
    focused: true,
    legacy: true,
  },
  '/layanan/sparta': {
    title: svc('sparta'),
    parent: '/layanan',
    legacy: true,
  },
  '/layanan/testi': { title: svc('testi'), parent: '/layanan', legacy: true },
  '/layanan/testi/$type': {
    title: svc('testi'),
    parent: '/layanan/testi',
    legacy: true,
  },
  '/layanan/testi/$type/$semester': {
    title: svc('testi'),
    parent: '/layanan/testi/$type',
    legacy: true,
  },
  '/layanan/testi/$type/$semester/$courseId': {
    title: svc('testi'),
    parent: '/layanan/testi/$type/$semester',
    legacy: true,
  },
  // Kelola: last in Layanan on phones and tablets, its own sidebar item on desktop (as the locked prototype has it).
  '/kelola': {
    title: nav.kelola,
    parent: '/layanan',
    deskRoot: 'kelola',
    legacy: true,
  },
  '/kelola/live': {
    title: common.shell.liveCounting,
    parent: '/kelola',
    legacy: true,
  },
  '/kelola/live/$formId': {
    title: common.shell.liveCounting,
    parent: '/kelola/live',
    legacy: true,
  },
  '/kelola/sparta': {
    title: svc('sparta-data'),
    parent: '/kelola',
    legacy: true,
  },
  '/kelola/sparta/$submissionId': {
    title: svc('sparta-data'),
    parent: '/kelola/sparta',
    legacy: true,
  },
  '/kelola/acara': { title: nav.kelola, parent: '/kelola', legacy: true },
  '/kelola/lomba': { title: nav.kelola, parent: '/kelola', legacy: true },
  '/kelola/testi': { title: nav.kelola, parent: '/kelola', legacy: true },
  // Profil: from the avatar on phones and tablets (back returns where you were), the sidebar's foot on desktop.
  '/profil': {
    title: nav.profil,
    parent: LAST_ROOT,
    deskRoot: 'profil',
    legacy: true,
  },
  '/profil/matkul': {
    title: common.shell.mataKuliahku,
    parent: '/profil',
    legacy: true,
  },
  '/profil/matkul/tambah': {
    title: common.shell.tambahMataKuliah,
    parent: '/profil/matkul',
    legacy: true,
  },
  '/profil/notifikasi': {
    title: common.shell.notifikasi,
    parent: '/profil',
    legacy: true,
  },
  '/profil/kredit': {
    title: common.shell.kredit,
    parent: '/profil',
    legacy: true,
  },
  // The shell's test page (src/dev/shell, development and staging only): a drill-down page below Layanan.
  '/dev/shell': { title: 'Uji shell', parent: '/layanan' },
};

/** A router match's path ('/layanan/dingdong/', '/_app/…' ids aside) as a `ShellPath`, or null outside the shell. */
export function shellPath(fullPath: string): ShellPath | null {
  const p = fullPath.length > 1 ? fullPath.replace(/\/+$/, '') : fullPath;
  return p in ROUTE_META ? (p as ShellPath) : null;
}

export function titleOf(
  path: ShellPath,
  params: Record<string, string> = {},
): string {
  const t = ROUTE_META[path].title;
  return typeof t === 'function' ? t(params) : t;
}

/** Fills a route path's `$params`; null when one is missing. */
export function fillPath(
  path: ShellPath,
  params: Record<string, string>,
): string | null {
  let missing = false;
  const out = path.replace(/\$(\w+)/g, (_, k: string) => {
    const v = params[k];
    if (v === undefined) missing = true;
    return encodeURIComponent(v ?? '');
  });
  return missing ? null : out;
}

/** The page above `path`, with `LAST_ROOT` resolved to the destination you were last on. */
export function parentOf(
  path: ShellPath,
  lastRoot: Destination = 'beranda',
): ShellPath | null {
  const p = ROUTE_META[path].parent;
  if (!p) return null;
  return p === LAST_ROOT ? DESTINATION_PATH[lastRoot] : p;
}

export type Layout = 'touch' | 'desk';

/**
 * Which navigation item is lit: on phones and tablets one of the four tabs (Kelola belongs to Layanan, Profil to
 * where you came from); on desktop also Kelola and Profil, which have their own place in the sidebar.
 */
export function activeItem(
  path: ShellPath,
  layout: Layout,
  lastRoot: Destination = 'beranda',
): Destination | 'kelola' | 'profil' {
  let p: ShellPath | null = path;
  for (let i = 0; p && i < 12; i++) {
    const meta: RouteMeta = ROUTE_META[p];
    if (layout === 'desk' && meta.deskRoot) return meta.deskRoot;
    if (meta.root) return meta.root;
    if (meta.parent === LAST_ROOT) return lastRoot;
    p = meta.parent ?? null;
  }
  return lastRoot;
}

export interface Crumb {
  path: ShellPath;
  /** The URL with this page's params filled in; null when it can't be built (then it isn't a link). */
  href: string | null;
}

/**
 * The desktop breadcrumb trail (`crumbs` in the prototype's `renderDesk`): the page's ancestors from its sidebar
 * item down to itself. One entry for a sidebar item's own page, which shows no trail.
 */
export function trailOf(
  path: ShellPath,
  params: Record<string, string> = {},
): Crumb[] {
  const out: Crumb[] = [];
  let p: ShellPath | null = path;
  for (let i = 0; p && i < 12; i++) {
    out.unshift({ path: p, href: fillPath(p, params) });
    const meta: RouteMeta = ROUTE_META[p];
    if (meta.root || meta.deskRoot || !meta.parent || meta.parent === LAST_ROOT)
      break;
    p = meta.parent;
  }
  return out;
}

/** The breadcrumbs a desktop page shows: its trail when it is below a sidebar item, none on a split page. */
export function deskCrumbs(
  path: ShellPath,
  params: Record<string, string> = {},
): Crumb[] {
  if (ROUTE_META[path].crumbs === false) return [];
  const trail = trailOf(path, params);
  return trail.length > 1 ? trail : [];
}

/** A tab's own page (phones and tablets show search and the avatar instead of back and a title). */
export const isRootPage = (path: ShellPath) => !!ROUTE_META[path].root;
