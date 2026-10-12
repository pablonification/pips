import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  legacyNavItem,
  legacyNavLinkProps,
} from '../src/components/navbar/legacy-nav';

// Today's navbars must light the same item at the new URLs as they did at the old ones (no visible change).
test('the item lit at each new URL is the one lit at its old URL', () => {
  const cases: Array<[string, ReturnType<typeof legacyNavItem>]> = [
    ['/', 'home'], // /home
    ['/layanan/dingdong', 'home'], // /home/dingdong
    ['/layanan/testi/teknik-informatika/3/course-IF2110', 'home'],
    ['/layanan/form/pixel', 'home'],
    ['/kelola', 'home'], // /home/admin
    ['/kelola/live/pixel', 'home'],
    ['/kelola/sparta/sub-1', 'home'], // /home/internship/admin/…
    ['/pengumuman', 'timeline'],
    ['/pengumuman/p1', 'timeline'],
    ['/pengumuman/tulis', null], // /add-announcement lit nothing
    ['/profil', 'settings'],
    ['/profil/matkul/tambah', 'settings'],
    ['/kalender', null],
    ['/login', null],
    ['/pengumumanx', null],
  ];
  for (const [path, item] of cases)
    assert.equal(legacyNavItem(path), item, path);
});

test('Beranda at / is matched exactly by the router and lit by hand elsewhere', () => {
  const lit = legacyNavLinkProps('home', '/layanan/nim', 'on');
  assert.deepEqual(lit.activeOptions, { exact: true });
  assert.deepEqual(lit.inactiveProps, {
    className: 'on',
    'data-status': 'active',
    'aria-current': 'page',
  });
  assert.equal(
    legacyNavLinkProps('home', '/pengumuman', 'on').inactiveProps,
    undefined,
  );
});
