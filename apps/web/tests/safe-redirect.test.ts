import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loginSearch, safeRedirect } from '../src/lib/safe-redirect';

test('a path on this site comes back as it is, with search and hash', () => {
  assert.equal(safeRedirect('/pengumuman/p1'), '/pengumuman/p1');
  assert.equal(
    safeRedirect('/kalender?hari=2026-10-08&acara=e1'),
    '/kalender?hari=2026-10-08&acara=e1',
  );
  assert.equal(
    safeRedirect('/layanan/testi/a/3/c?page=2#x'),
    '/layanan/testi/a/3/c?page=2#x',
  );
  assert.equal(safeRedirect('/'), '/');
});

test('anything that could leave the site is refused', () => {
  for (const value of [
    'https://evil.example/',
    'http://evil.example',
    '//evil.example/pengumuman',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    'javascript:alert(1)',
    'data:text/html,hi',
    'pengumuman',
    '',
    '/'.padEnd(3000, 'a'),
  ]) {
    assert.equal(safeRedirect(value), undefined, JSON.stringify(value));
  }
});

test('non-strings and the sign-in page itself are refused', () => {
  for (const value of [undefined, null, 42, ['/'], { to: '/' }]) {
    assert.equal(safeRedirect(value), undefined);
  }
  assert.equal(safeRedirect('/login'), undefined);
  assert.equal(safeRedirect('/login?redirect=/'), undefined);
  assert.equal(safeRedirect('/login/'), undefined);
  assert.equal(safeRedirect('/loginx'), '/loginx');
});

test('dot segments are resolved, never escaping the site', () => {
  assert.equal(safeRedirect('/a/../pengumuman'), '/pengumuman');
  assert.equal(safeRedirect('/../../etc'), '/etc');
});

test('sign-in links carry the deep link, but not for Beranda', () => {
  assert.deepEqual(loginSearch('/pengumuman/p1'), {
    redirect: '/pengumuman/p1',
  });
  assert.deepEqual(loginSearch('/'), {});
  assert.deepEqual(loginSearch('//evil.example'), {});
});
