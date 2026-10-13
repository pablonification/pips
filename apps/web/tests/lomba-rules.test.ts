// Info Lomba (P2-B brief, "Tests"). The device here runs in another time zone: dates must still come out in WIB.
process.env.TZ = 'America/Los_Angeles';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { Competition } from '../src/api/generated';
import {
  deadlineLine,
  isOpen,
  isUrgent,
  LOMBA_PAGE,
  nextOffset,
  rupiah,
  withScheme,
} from '../src/features/lomba/rules';

const NOW = Date.parse('2026-10-08T13:35:00+07:00');

test('the device is not in WIB for these tests', () => {
  assert.notEqual(new Date(NOW).getTimezoneOffset(), -420);
});

test('the deadline line is in WIB, whatever the device’s zone', () => {
  // 23.59 WIB on Wednesday 14 October is still Wednesday 09.59 in Los Angeles; a late-night one crosses the date.
  assert.equal(deadlineLine('2026-10-14T16:59:00Z'), 'Tutup Rab 14 Okt, 23.59');
  assert.equal(deadlineLine('2026-11-01T17:30:00Z'), 'Tutup Sen 2 Nov, 00.30');
});

test('within 3 WIB calendar days is urgent, from the 4th day on it isn’t', () => {
  const at = (iso: string) => isUrgent(iso, NOW);
  assert.equal(at('2026-10-08T23:59:00+07:00'), true, 'today');
  assert.equal(at('2026-10-11T23:59:00+07:00'), true, '3 days');
  assert.equal(at('2026-10-12T00:00:00+07:00'), false, '4 days');
  assert.equal(at('2026-10-14T23:59:00+07:00'), false);
  // Just after midnight WIB on the 4th day is still 4 calendar days, though under 72 hours away.
  assert.equal(isUrgent('2026-10-12T00:30:00+07:00', Date.parse('2026-10-08T23:50:00+07:00')), false);
});

test('closed competitions are left out by the app’s clock; no deadline stays', () => {
  assert.equal(isOpen('2026-10-08T13:34:00+07:00', NOW), false);
  assert.equal(isOpen('2026-10-08T13:35:00+07:00', NOW), false);
  assert.equal(isOpen('2026-10-08T13:36:00+07:00', NOW), true);
  assert.equal(isOpen(null, NOW), true);
});

test('rupiah: "Rp150.000", "Gratis" for no fee, other text as stored', () => {
  assert.equal(rupiah('150000'), 'Rp150.000');
  assert.equal(rupiah(150000), 'Rp150.000');
  assert.equal(rupiah('1500000'), 'Rp1.500.000');
  assert.equal(rupiah('500'), 'Rp500');
  for (const free of [null, undefined, '', ' ', '0', 0]) assert.equal(rupiah(free), 'Gratis', String(free));
  assert.equal(rupiah('Rp50.000/tim'), 'Rp50.000/tim');
});

test('links without a scheme get https://', () => {
  assert.equal(withScheme('https://example.org/a'), 'https://example.org/a');
  assert.equal(withScheme('http://example.org'), 'http://example.org');
  assert.equal(withScheme('example.org/daftar'), 'https://example.org/daftar');
  assert.equal(withScheme(' bit.ly/x '), 'https://bit.ly/x');
  assert.equal(withScheme('javascript:alert(1)'), 'https://javascript:alert(1)');
});

const page = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }) as Competition);

test('regression: the next offset counts what the API returned, and stops after a short page', () => {
  assert.equal(LOMBA_PAGE, 10);
  assert.equal(nextOffset([]), undefined);
  assert.equal(nextOffset([page(10)]), 10, 'today asked for offset 0 again (PAGE_SIZE = 0)');
  assert.equal(nextOffset([page(10), page(10)]), 20);
  assert.equal(nextOffset([page(10), page(2)]), undefined);
  assert.equal(nextOffset([page(3)]), undefined);
});
