import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { CalendarEvent, PushSubscription } from '../src/db/schema';
import type { PushData } from '../src/lib/push-manager';

type Cron = typeof import('../src/cron/calendar-cron');
let cron: Cron;
before(async () => {
  usePlaceholderEnv();
  cron = await import('../src/cron/calendar-cron');
});

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// Thursday 8 October 2026, 12.00.20 WIB (05.00.20 UTC): the cron's tick, a few seconds into its minute.
const NOW = Date.parse('2026-10-08T05:00:20.000Z');
const tomorrowAt = (wib: string) => new Date(`2026-10-09T${wib}:00.000+07:00`);

const sub = (userId: string, n = 1): PushSubscription => ({
  endpoint: `https://push.example/${userId}/${n}`,
  keys: { p256dh: 'p', auth: 'a' },
  userId,
  createdAt: new Date(0),
});
const event = (
  id: string,
  start: Date,
  courseId: string | null,
  description = '',
): CalendarEvent =>
  ({
    id,
    calendarGroupId: 'g',
    courseId,
    title: id,
    description,
    category: courseId ? 'Akademik' : 'Himpunan',
    academicYear: 2026,
    academicSemesterCode: 'Ganjil',
    start,
    end: new Date(start.getTime() + 2 * 60 * MINUTE),
    googleCalendarUrl: '',
    googleCalendarId: '',
  }) as CalendarEvent;

const courses = [
  {
    id: 'c-algo',
    code: 'IF2211',
    name: 'Strategi Algoritma',
    // nadia has two devices; budi has none; tari muted Akademik.
    userCourses: [{ userId: 'nadia' }, { userId: 'budi' }, { userId: 'tari' }],
  },
  {
    id: 'c-basdat',
    code: 'IF2240',
    name: 'Basis Data',
    userCourses: [{ userId: 'budi' }, { userId: 'raka' }],
  },
  { id: 'c-empty', code: 'IF2250', name: 'RPL', userCourses: [] },
];
const subscriptions = [
  sub('nadia', 1),
  sub('nadia', 2),
  sub('tari'),
  sub('raka'),
  sub('other'),
];

function harness(events: CalendarEvent[]) {
  let now = NOW;
  const sent: Array<{ to: string[]; data: PushData }> = [];
  const reads: Array<[string, string]> = [];
  let failReads = false;
  const run = cron.createReminderRun({
    now: () => now,
    readEvents: async (from, until) => {
      if (failReads) throw new Error('database down');
      reads.push([from.toISOString(), until.toISOString()]);
      return events.filter((e) => e.start >= from && e.start < until);
    },
    readCourses: async (ids) => courses.filter((c) => ids.includes(c.id)),
    readSubscriptions: async () => subscriptions,
    readAcademicUnsubs: async () => new Set(['tari']),
    send: async (subs, data) => {
      sent.push({ to: subs.map((s) => s.endpoint), data });
      return [];
    },
    prune: async () => {},
  });
  return {
    run,
    sent,
    reads,
    tick: (ms: number) => (now += ms),
    failReads: (v: boolean) => (failReads = v),
  };
}

// Regression: a student in the course with no device subscribed made `.filter(s => s.userId)` throw on undefined,
// and the guarded run stopped there: that course's reminder and every later one that minute never went out.
test('course reminders reach students with devices, skip those without and those who muted Akademik', async () => {
  const h = harness([
    event('Kuis 1', tomorrowAt('12:00'), 'c-algo', 'Bab 1–3'),
    event('Praktikum', tomorrowAt('12:00'), 'c-basdat'),
    event('Asistensi', tomorrowAt('12:00'), 'c-empty'),
  ]);
  await h.run();
  assert.deepEqual(h.sent, [
    {
      to: ['https://push.example/nadia/1', 'https://push.example/nadia/2'],
      data: {
        title: 'Besok kamu ada Kuis 1, 12.00',
        options: { body: 'IF2211 Strategi Algoritma\nBab 1–3' },
      },
    },
    {
      to: ['https://push.example/raka/1'],
      data: {
        title: 'Besok kamu ada Praktikum, 12.00',
        options: { body: 'IF2240 Basis Data' },
      },
    },
  ]);
});

test('a Himpunan event goes to everyone, in WIB whatever the server runs in, in Indonesian', async () => {
  const h = harness([
    event('Malam Keakraban', tomorrowAt('12:00'), null, 'Di CC Barat'),
  ]);
  await h.run();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to.length, subscriptions.length);
  // 12.00 WIB is 05.00 UTC: `dayjs(...).format('HH:mm')` gave the server's zone (UTC in Docker).
  assert.deepEqual(h.sent[0].data, {
    title: 'Besok ada Malam Keakraban, 12.00',
    options: { body: 'Di CC Barat' },
  });
});

test('only events starting 24 hours after this minute, each once', async () => {
  const h = harness([
    event('tepat', tomorrowAt('12:00'), null),
    event('detik', new Date(tomorrowAt('12:00').getTime() + 30_000), null),
    event('terlalu awal', new Date(tomorrowAt('12:00').getTime() - 1), null),
    event('menit depan', tomorrowAt('12:01'), null),
  ]);
  await h.run();
  assert.deepEqual(
    h.sent.map((s) => s.data.title),
    ['Besok ada tepat, 12.00', 'Besok ada detik, 12.00'],
  );
  await h.run(); // same minute again: nothing new
  assert.equal(h.sent.length, 2);
  h.tick(MINUTE);
  await h.run();
  assert.deepEqual(
    h.sent.slice(2).map((s) => s.data.title),
    ['Besok ada menit depan, 12.01'],
  );
});

// Regression: a run only matched events starting in exactly its minute, so a skipped or failed minute lost them.
test('a failed run leaves its minutes for the next run, and a skipped minute is caught up', async () => {
  const h = harness([
    event('A', tomorrowAt('12:00'), null),
    event('B', tomorrowAt('12:01'), null),
    event('C', tomorrowAt('12:03'), null),
  ]);
  h.failReads(true);
  await assert.rejects(h.run());
  h.failReads(false);
  h.tick(MINUTE); // 12.01: A (left by the failed run) and B
  await h.run();
  assert.deepEqual(
    h.sent.map((s) => s.data.title[10]),
    ['A', 'B'],
  );
  h.tick(2 * MINUTE); // 12.03: the 12.02 run never happened; C now
  await h.run();
  assert.deepEqual(
    h.sent.map((s) => s.data.title[10]),
    ['A', 'B', 'C'],
  );
  assert.equal(
    h.reads.at(-1)?.[0],
    new Date(NOW - 20_000 + 2 * MINUTE + DAY).toISOString(),
    'the catch-up starts where the last run stopped',
  );
});

test('a run while another is still going does nothing; nothing is sent twice', async () => {
  const h = harness([event('A', tomorrowAt('12:00'), null)]);
  await Promise.all([h.run(), h.run()]);
  assert.equal(h.sent.length, 1);
});

test('catching up is limited to six hours', async () => {
  const h = harness([]);
  await h.run();
  h.tick(10 * 60 * MINUTE);
  await h.run();
  const [from, until] = h.reads.at(-1) ?? ['', ''];
  assert.equal(Date.parse(until) - Date.parse(from), cron.REMINDER_CATCH_UP_MS);
});
