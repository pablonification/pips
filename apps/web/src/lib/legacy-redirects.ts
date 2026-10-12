/**
 * Today's paths and where they live now. Every path in the old route tree has a row, so shared links, bookmarks,
 * the installed app's history and push notifications (`/timeline/<id>`) keep working. The search string and hash
 * are carried over unchanged by the caller.
 *
 * Pure and dependency-free: the router (`__root.tsx`), the service worker (`sw.ts`) and the unit tests use it.
 * A later task that moves a route adds a row here; never remove one.
 */
export const LEGACY_REDIRECTS: ReadonlyArray<
  readonly [from: string, to: string]
> = [
  ['/home', '/'],
  ['/home/dingdong', '/layanan/dingdong'],
  ['/home/testimoni', '/layanan/testi'],
  ['/home/testimoni/$type', '/layanan/testi/$type'],
  ['/home/testimoni/$type/$semester', '/layanan/testi/$type/$semester'],
  [
    '/home/testimoni/$type/$semester/$courseId',
    '/layanan/testi/$type/$semester/$courseId',
  ],
  ['/home/nim-finder', '/layanan/nim'],
  ['/home/competition', '/layanan/lomba'],
  ['/home/curhat', '/layanan/curhat'],
  ['/home/form', '/layanan/form'],
  ['/home/form/$formId', '/layanan/form/$formId'],
  ['/home/internship', '/layanan/sparta'],
  ['/home/internship/admin', '/kelola/sparta'],
  ['/home/internship/admin/$submissionId', '/kelola/sparta/$submissionId'],
  ['/home/admin', '/kelola'],
  ['/home/admin/forms', '/kelola/live'],
  ['/home/admin/forms/$formId', '/kelola/live/$formId'],
  // Removed (SPEC "Removals"): the mock recommendation page and the socket debug page go to Beranda.
  ['/home/rekomendasi/$rekomendasiId', '/'],
  ['/socket', '/'],
  ['/timeline', '/pengumuman'],
  ['/timeline/$id', '/pengumuman/$id'],
  ['/add-announcement', '/pengumuman/tulis'],
  ['/calendar', '/kalender'],
  ['/settings', '/profil'],
  ['/settings/courses', '/profil/matkul'],
  ['/settings/courses/add', '/profil/matkul/tambah'],
  ['/settings/subscriptions', '/profil/notifikasi'],
  ['/settings/credits', '/profil/kredit'],
];

const segments = (path: string) => path.split('/').filter(Boolean);

/** The new path for an old one, or null when `pathname` isn't an old path. A trailing slash is ignored. */
export function legacyRedirect(pathname: string): string | null {
  const parts = segments(pathname);
  for (const [from, to] of LEGACY_REDIRECTS) {
    const pattern = segments(from);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const matches = pattern.every((p, i) => {
      if (p.startsWith('$')) {
        params[p] = parts[i];
        return true;
      }
      return p === parts[i];
    });
    if (!matches) continue;
    return `/${segments(to)
      .map((p) => (p.startsWith('$') ? params[p] : p))
      .join('/')}`;
  }
  return null;
}

/** `legacyRedirect` for a whole href (path, search and hash); null when the path isn't an old one. */
export function legacyRedirectHref(href: string): string | null {
  const match = /^([^?#]*)(.*)$/.exec(href)!;
  const target = legacyRedirect(match[1]);
  return target === null ? null : `${target}${match[2]}`;
}
