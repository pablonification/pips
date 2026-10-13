import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { offlineUpdatedAt } from '../src/features/layanan-svc/updated';
import { urlEcho } from '../src/features/layanan-svc/url-text';

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

test('a search box takes a `q` from outside, and its own echoes never overwrite what is typed', () => {
  const echo = urlEcho();
  // Typing "ra", "rak": the URL follows a moment behind.
  echo.wrote('ra');
  echo.wrote('rak');
  assert.equal(echo.isOutside('ra'), false); // a late echo of an earlier value
  assert.equal(echo.isOutside('rak'), false);
  assert.equal(echo.isOutside('Raka'), true); // a link to this page
});

test('regression: a value typed earlier in the visit counts as outside once the URL has caught up', () => {
  // P2-B review, finding 3: type "Raka Pratama", clear the box, then open search's "Orang" for Raka, which links
  // to ?q=Raka Pratama. That value had been typed, so the box stayed empty.
  const echo = urlEcho();
  echo.wrote('Raka Pratama');
  assert.equal(echo.isOutside('Raka Pratama'), false);
  echo.wrote('');
  assert.equal(echo.isOutside(undefined), false); // the cleared box's own echo
  assert.equal(echo.isOutside('Raka Pratama'), true);
});
