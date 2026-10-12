import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  LEGACY_REDIRECTS,
  legacyRedirect,
  legacyRedirectHref,
} from '../src/lib/legacy-redirects';

// Every path in today's route tree (routeTree.gen.ts on `redesign` at 792f750, FileRoutesByFullPath), with
// sample params, and where it must land. A redirect may never be dropped: shared links and push use them.
const OLD_PATHS: Array<[old: string, now: string]> = [
  ['/home', '/'],
  ['/home/', '/'],
  ['/home/dingdong', '/layanan/dingdong'],
  ['/home/testimoni', '/layanan/testi'],
  ['/home/testimoni/teknik-informatika', '/layanan/testi/teknik-informatika'],
  [
    '/home/testimoni/teknik-informatika/3',
    '/layanan/testi/teknik-informatika/3',
  ],
  [
    '/home/testimoni/teknik-informatika/3/course-IF2110',
    '/layanan/testi/teknik-informatika/3/course-IF2110',
  ],
  ['/home/nim-finder', '/layanan/nim'],
  ['/home/competition', '/layanan/lomba'],
  ['/home/curhat', '/layanan/curhat'],
  ['/home/form', '/layanan/form'],
  ['/home/form/pixel', '/layanan/form/pixel'],
  ['/home/internship', '/layanan/sparta'],
  ['/home/internship/admin', '/kelola/sparta'],
  ['/home/internship/admin/sub-13525071', '/kelola/sparta/sub-13525071'],
  ['/home/admin', '/kelola'],
  ['/home/admin/forms', '/kelola/live'],
  ['/home/admin/forms/pixel', '/kelola/live/pixel'],
  ['/home/rekomendasi/voucher-1', '/'],
  ['/socket', '/'],
  ['/socket/', '/'],
  ['/timeline', '/pengumuman'],
  ['/timeline/p1', '/pengumuman/p1'],
  ['/timeline/p1/', '/pengumuman/p1'],
  ['/add-announcement', '/pengumuman/tulis'],
  ['/calendar', '/kalender'],
  ['/settings', '/profil'],
  ['/settings/courses', '/profil/matkul'],
  ['/settings/courses/add', '/profil/matkul/tambah'],
  ['/settings/subscriptions', '/profil/notifikasi'],
  ['/settings/credits', '/profil/kredit'],
];

for (const [old, now] of OLD_PATHS) {
  test(`${old} redirects to ${now}`, () => {
    assert.equal(legacyRedirect(old), now);
  });
}

test('every row of the table is exercised above', () => {
  const covered = new Set(
    LEGACY_REDIRECTS.filter(([from]) =>
      OLD_PATHS.some(([old]) => {
        const a = from.split('/').filter(Boolean);
        const b = old.split('/').filter(Boolean);
        return (
          a.length === b.length &&
          a.every((p, i) => p.startsWith('$') || p === b[i])
        );
      }),
    ).map(([from]) => from),
  );
  assert.deepEqual(
    LEGACY_REDIRECTS.map(([from]) => from).filter((f) => !covered.has(f)),
    [],
  );
});

test('new paths and unknown paths are left alone', () => {
  for (const path of [
    '/',
    '/pengumuman',
    '/pengumuman/p1',
    '/layanan/form/pixel',
    '/kalender',
    '/login',
    '/homes',
    '/home/unknown',
    '/timeline/p1/comments',
    '/settings/courses/add/more',
  ]) {
    assert.equal(legacyRedirect(path), null, path);
  }
});

test('the search string and hash are kept: push links, the composer and Testi Matkul pages', () => {
  assert.equal(legacyRedirectHref('/timeline/p1'), '/pengumuman/p1');
  assert.equal(
    legacyRedirectHref('/timeline?showAnnounce=true'),
    '/pengumuman?showAnnounce=true',
  );
  assert.equal(
    legacyRedirectHref(
      '/home/testimoni/teknik-informatika/3/course-IF2110?page=2#atas',
    ),
    '/layanan/testi/teknik-informatika/3/course-IF2110?page=2#atas',
  );
  assert.equal(legacyRedirectHref('/pengumuman/p1?x=1'), null);
});

test('every destination is a route in the new route tree', () => {
  const tree = fs.readFileSync(
    path.resolve(import.meta.dirname, '../src/routeTree.gen.ts'),
    'utf8',
  );
  const block = /export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/.exec(
    tree,
  )![1];
  const fullPaths = new Set(
    [...block.matchAll(/'([^']+)':/g)].map((m) =>
      m[1].length > 1 ? m[1].replace(/\/$/, '') : m[1],
    ),
  );
  for (const [, to] of LEGACY_REDIRECTS) {
    assert.ok(fullPaths.has(to), `${to} is not a route`);
  }
  // …and no old path is a route any more, so the redirect always runs.
  for (const [from] of LEGACY_REDIRECTS) {
    assert.ok(!fullPaths.has(from), `${from} is still a route`);
  }
});
