import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { offlineUpdatedAt } from '../src/features/layanan-svc/updated';

/* What Ding Dong, Testi Matkul, NIM Finder and Info Lomba share (P2-B): the offline banner's time, and which `q`
   in the URL a search box takes as coming from outside. */

const at = (iso: string) => new Date(iso).getTime();

test('regression: the offline banner gives the day as well when the data wasn’t updated today (WIB)', () => {
  // Ding Dong's list is kept on the device for up to 7 days; "09.00" alone read as this morning.
  const now = at('2026-10-13T02:00:00Z'); // Selasa 13 Oktober, 09.00 WIB
  assert.equal(offlineUpdatedAt(at('2026-10-13T00:30:00Z'), now), '07.30');
  assert.equal(
    offlineUpdatedAt(at('2026-10-12T02:00:00Z'), now),
    'Sen 12 Okt, 09.00',
  );
  // 23.30 WIB yesterday is 16.30 UTC: the day is WIB's, whatever the device's zone.
  assert.equal(
    offlineUpdatedAt(at('2026-10-12T16:30:00Z'), now),
    'Sen 12 Okt, 23.30',
  );
  assert.equal(offlineUpdatedAt(at('2026-10-12T17:00:00Z'), now), '00.00');
});
