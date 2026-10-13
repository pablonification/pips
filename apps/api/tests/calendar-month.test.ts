import { strict as assert } from 'node:assert';
import { after, test } from 'node:test';
import { eventsInMonth } from '../src/lib/calendar-month';

// T4's API image (node:22-alpine) sets no TZ, so the server runs in UTC.
const zone = process.env.TZ;
process.env.TZ = 'UTC';
after(() => {
  process.env.TZ = zone;
});

const at = (iso: string) => ({ id: iso, start: new Date(iso) });

// Regression: the month was read with getMonth() in the server's time zone, so under UTC an event from 00.00 to
// 06.59 WIB on the 1st landed in the previous month.
test('an event early on the 1st (WIB) belongs to that month, on a server in UTC', () => {
  const firstOfNovember = at('2026-11-01T05:00:00+07:00'); // 31 Oct 22.00 UTC
  assert.deepEqual(
    eventsInMonth([firstOfNovember], { month: 11, year: 2026 }),
    [firstOfNovember],
  );
  assert.deepEqual(
    eventsInMonth([firstOfNovember], { month: 10, year: 2026 }),
    [],
  );
});

test('the last minute of a month (WIB) stays in it, and a new year starts at 00.00 WIB', () => {
  const lastMinute = at('2026-10-31T23:59:00+07:00');
  assert.deepEqual(eventsInMonth([lastMinute], { month: 10, year: 2026 }), [
    lastMinute,
  ]);
  const newYear = at('2027-01-01T00:00:00+07:00');
  assert.deepEqual(eventsInMonth([newYear], { month: 1, year: 2027 }), [
    newYear,
  ]);
  assert.deepEqual(eventsInMonth([newYear], { month: 12, year: 2026 }), []);
});

test('events come back earliest first', () => {
  const a = at('2026-10-08T15:00:00+07:00');
  const b = at('2026-10-02T09:00:00+07:00');
  assert.deepEqual(
    eventsInMonth([a, b], { month: 10, year: 2026 }).map((e) => e.id),
    [b.id, a.id],
  );
});
