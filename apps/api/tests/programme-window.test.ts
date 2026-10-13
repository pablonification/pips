import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  isEligibleFor,
  isValidWindowRoute,
  isWindowOpenFor,
  windowStatus,
} from '../src/lib/programme-window';

const opensAt = '2026-09-12T06:00:00.000Z'; // Sabtu 12 September 2026, 13.00 WIB
const closesAt = '2026-10-31T16:59:00.000Z';
const ms = (iso: string) => new Date(iso).getTime();

test('a window opens at opensAt and closes at closesAt, to the millisecond', () => {
  const w = { opensAt, closesAt, isActive: true };
  assert.equal(windowStatus(w, ms(opensAt) - 1), 'not_opened');
  assert.equal(windowStatus(w, ms(opensAt)), 'open');
  assert.equal(windowStatus(w, ms(closesAt) - 1), 'open');
  assert.equal(windowStatus(w, ms(closesAt)), 'closed');
  assert.equal(windowStatus(w, new Date(closesAt)), 'closed');
});

test('no closing time stays open; no opening time is already open; switched off is closed', () => {
  assert.equal(
    windowStatus(
      { opensAt, closesAt: null, isActive: true },
      ms('2030-01-01T00:00:00Z'),
    ),
    'open',
  );
  assert.equal(
    windowStatus({ opensAt: null, closesAt, isActive: true }, 0),
    'open',
  );
  assert.equal(
    windowStatus({ opensAt, closesAt: null, isActive: false }, ms(opensAt) + 1),
    'closed',
  );
  // Switched off wins over not yet open.
  assert.equal(
    windowStatus({ opensAt, closesAt, isActive: false }, 0),
    'closed',
  );
  // isActive left out means active (SPARTA's window has no switch).
  assert.equal(
    windowStatus({ opensAt: null, closesAt }, ms(closesAt)),
    'closed',
  );
});

test('eligible: everyone when both lists are empty, else a listed angkatan or NIM', () => {
  const nadia = { angkatan: 2025, nim: '13525045' };
  const raka = { angkatan: 2024, nim: '13524045' };
  assert.equal(
    isEligibleFor({ eligibleAngkatan: [], eligibleNims: [] }, raka),
    true,
  );
  assert.equal(
    isEligibleFor({ eligibleAngkatan: [2025], eligibleNims: [] }, nadia),
    true,
  );
  assert.equal(
    isEligibleFor({ eligibleAngkatan: [2025], eligibleNims: [] }, raka),
    false,
  );
  assert.equal(
    isEligibleFor(
      { eligibleAngkatan: [2025], eligibleNims: ['13524045'] },
      raka,
    ),
    true,
  );
  assert.equal(
    isEligibleFor({ eligibleAngkatan: [], eligibleNims: ['13524045'] }, nadia),
    false,
  );
});

test('a window is open for a member when it is open now and they are eligible', () => {
  const w = {
    opensAt,
    closesAt,
    isActive: true,
    eligibleAngkatan: [2025],
    eligibleNims: [],
  };
  const nadia = { angkatan: 2025, nim: '13525045' };
  const raka = { angkatan: 2024, nim: '13524045' };
  assert.equal(isWindowOpenFor(w, nadia, ms(opensAt)), true);
  assert.equal(isWindowOpenFor(w, raka, ms(opensAt)), false);
  assert.equal(isWindowOpenFor(w, nadia, ms(opensAt) - 1), false);
  assert.equal(isWindowOpenFor(w, nadia, ms(closesAt)), false);
  assert.equal(
    isWindowOpenFor({ ...w, isActive: false }, nadia, ms(opensAt)),
    false,
  );
});

test('a route is an app path or an https address', () => {
  for (const ok of [
    '/layanan/sparta',
    '/',
    '/kalender?hari=2026-10-08',
    'https://hmif.dev/pemilu',
  ])
    assert.equal(isValidWindowRoute(ok), true, ok);
  for (const bad of [
    '',
    'layanan/sparta',
    '//evil.com',
    '/\\evil.com',
    'http://hmif.dev',
    'javascript:alert(1)',
    'https://',
    'mailto:a@b.c',
  ])
    assert.equal(isValidWindowRoute(bad), false, bad);
});

// Regression (review minor 2): browsers drop tabs and newlines when parsing a URL, so "/\t/evil.com" became
// "//evil.com", another site.
test('a route with a control character is refused', () => {
  for (const bad of [
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/layanan\u0000/sparta',
    '/layanan/sparta\u007f',
    'https://hmif.dev/\n',
  ])
    assert.equal(isValidWindowRoute(bad), false, JSON.stringify(bad));
  // What the browser makes of each: none may leave the app's origin.
  for (const bad of ['/\t/evil.com', '/\n/evil.com']) {
    assert.equal(new URL(bad, 'https://app.hmif.dev').host, 'evil.com');
  }
});
