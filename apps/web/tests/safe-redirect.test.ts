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

test('what comes out is checked too: dot segments, encoded slashes and backslashes never make a link off the site', () => {
  // Regression: the input checks passed these, then URL parsing resolved them to "//evil.com" (review M1).
  for (const value of [
    '/.//evil.com',
    '/a/..//evil.com',
    '/..//evil.com',
    '/%2e%2e//evil.com',
    '/%2E%2E//evil.com',
    '/a/%2e%2e//evil.com',
    '/.%2e//evil.com',
    '/./\\evil.com',
    '/a/..\\evil.com',
    '/%5cevil.com',
    '/%5Cevil.com',
    '/%2f/evil.com',
    '/%2F%2Fevil.com',
    '/a/../%2F/evil.com',
    '/%252F%252Fevil.com',
    '/%09/evil.com',
    '/%0a/evil.com',
  ]) {
    const result = safeRedirect(value);
    assert.equal(result, undefined, `${JSON.stringify(value)} → ${result}`);
  }
});

test('whatever it returns stays on this site, also after a second parse', () => {
  const origin = 'https://app.hmif.dev';
  for (const value of [
    '/pengumuman/p1',
    '/a/../pengumuman',
    '/./kalender?hari=2026-10-08',
    '/layanan/nim?q=%2F%2Fevil.com',
    '/pengumuman#//evil.com',
    '/../../etc',
  ]) {
    const result = safeRedirect(value);
    assert.ok(result, JSON.stringify(value));
    assert.ok(result.startsWith('/') && !result.startsWith('//'), result);
    assert.equal(new URL(result, origin).origin, origin, result);
    assert.equal(safeRedirect(result), result, 'stable when checked again');
  }
});

test('sign-in links carry the deep link, but not for Beranda', () => {
  assert.deepEqual(loginSearch('/pengumuman/p1'), {
    redirect: '/pengumuman/p1',
  });
  assert.deepEqual(loginSearch('/'), {});
  assert.deepEqual(loginSearch('//evil.example'), {});
});
