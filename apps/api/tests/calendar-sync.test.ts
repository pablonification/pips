// Kalender's copy of PRISMA's Google calendar: what a Google event becomes, what a sync changes, and how a run behaves
// when Google or the key file isn't there.
import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import type { CalendarEvent, CalendarGroup } from '../src/db/schema';
import {
  descriptionText,
  planSync,
  syncWindow,
  toSyncedEvent,
  type SyncedEvent,
  type SyncPlan,
} from '../src/lib/calendar-sync';

let createCalendarSync: typeof import('../src/cron/calendar-sync').createCalendarSync;
before(async () => {
  usePlaceholderEnv();
  ({ createCalendarSync } = await import('../src/cron/calendar-sync'));
});

const de: CalendarGroup = {
  id: 'himpunan-prisma-de',
  name: 'PRISMA - DE HMIF ITB',
  category: 'himpunan',
  code: 'prisma-de',
  googleCalendarUrl: 'de@group.calendar.google.com',
  synced: true,
};

const nobar = {
  id: 'g-nobar',
  status: 'confirmed',
  htmlLink: 'https://www.google.com/calendar/event?eid=nobar',
  summary: '[Kinship] Pips Nobar',
  description: 'Nobar bareng.<br>CP: Kak Sinta (LINE: contoh.cp)',
  location: 'Labtek V',
  start: { dateTime: '2026-11-27T19:00:00+07:00' },
  end: { dateTime: '2026-11-27T22:00:00+07:00' },
};

test('a timed Google event keeps its title, plain-text description, place and times', () => {
  assert.deepEqual(toSyncedEvent(nobar, de.name), {
    googleCalendarId: 'g-nobar',
    googleCalendarUrl: nobar.htmlLink,
    title: '[Kinship] Pips Nobar',
    description: 'Nobar bareng.\nCP: Kak Sinta (LINE: contoh.cp)',
    location: 'Labtek V',
    start: new Date('2026-11-27T12:00:00.000Z'),
    end: new Date('2026-11-27T15:00:00.000Z'),
    allDay: false,
  });
});

test('an all-day event runs from midnight WIB of its first day to midnight after its last', () => {
  const e = toSyncedEvent(
    {
      ...nobar,
      start: { date: '2026-12-01' },
      end: { date: '2026-12-04' },
    },
    de.name,
  )!;
  assert.equal(e.allDay, true);
  assert.equal(e.start.toISOString(), '2026-11-30T17:00:00.000Z');
  assert.equal(e.end.toISOString(), '2026-12-03T17:00:00.000Z');
});

test('cancelled, id-less and unreadable events are left out; no title takes the calendar name; no place is null', () => {
  assert.equal(toSyncedEvent({ ...nobar, status: 'cancelled' }, de.name), null);
  assert.equal(toSyncedEvent({ ...nobar, id: undefined }, de.name), null);
  assert.equal(toSyncedEvent({ ...nobar, htmlLink: undefined }, de.name), null);
  assert.equal(
    toSyncedEvent({ ...nobar, start: { dateTime: 'nanti' } }, de.name),
    null,
  );
  const bare = toSyncedEvent(
    { ...nobar, summary: '  ', location: '', description: undefined },
    de.name,
  )!;
  assert.equal(bare.title, de.name);
  assert.equal(bare.location, null);
  assert.equal(bare.description, '');
  // An end before the start (or missing) becomes the start: a point in time, not a negative event.
  const odd = toSyncedEvent(
    { ...nobar, end: { dateTime: '2026-11-27T18:00:00+07:00' } },
    de.name,
  )!;
  assert.equal(odd.end.getTime(), odd.start.getTime());
});

test("Google's HTML description becomes readable text: breaks, lists, links with their address, entities", () => {
  assert.equal(
    descriptionText(
      '<p>Halo <b>warga</b> &amp; teman!</p><ul><li>Bawa KTM</li><li>Datang 18.45</li></ul>' +
        'Daftar: <a href="https://example.com/daftar">di sini</a><br>' +
        '<a href="https://example.com/x">https://example.com/x</a>&nbsp;&#128515;',
    ),
    'Halo warga & teman!\n• Bawa KTM\n• Datang 18.45\nDaftar: di sini (https://example.com/daftar)\nhttps://example.com/x 😃',
  );
  assert.equal(descriptionText('Baris 1\n\n\n\nBaris 2'), 'Baris 1\n\nBaris 2');
  assert.equal(
    descriptionText('<script>alert(1)</script>teks'),
    'alert(1)teks',
  );
  assert.equal(descriptionText(null), '');
});

const stored = (over: Partial<SyncedEvent> & { id: string }) => ({
  ...toSyncedEvent(nobar, de.name)!,
  ...over,
});

test('a sync adds new events, updates changed ones, leaves the same ones alone and removes what Google dropped', () => {
  const google = [
    toSyncedEvent(nobar, de.name)!,
    toSyncedEvent(
      { ...nobar, id: 'g-rapat', summary: 'Rapat Akbar' },
      de.name,
    )!,
    toSyncedEvent({ ...nobar, id: 'g-new', summary: 'Baru' }, de.name)!,
  ];
  const plan = planSync(google, [
    stored({ id: 'row-nobar' }),
    stored({ id: 'row-rapat', googleCalendarId: 'g-rapat', title: 'Rapat' }),
    stored({ id: 'row-gone', googleCalendarId: 'g-gone' }),
  ]);
  assert.deepEqual(
    plan.insert.map((e) => e.googleCalendarId),
    ['g-new'],
  );
  assert.deepEqual(
    plan.update.map((u) => [u.id, u.event.title]),
    [['row-rapat', 'Rapat Akbar']],
  );
  assert.deepEqual(plan.remove, ['row-gone']);
});

test('two rows for one Google event: the extra goes; Google listing an event twice adds it once', () => {
  const g = toSyncedEvent(nobar, de.name)!;
  const plan = planSync(
    [g, g],
    [stored({ id: 'row-a' }), stored({ id: 'row-b' })],
  );
  assert.deepEqual(plan, { insert: [], update: [], remove: ['row-b'] });
  assert.equal(planSync([g, g], []).insert.length, 1);
});

test('the window reaches a month back and a year ahead', () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  const { from, until } = syncWindow(now);
  assert.equal(from.toISOString(), '2026-10-20T00:00:00.000Z');
  assert.equal(until.toISOString(), '2027-11-21T00:00:00.000Z');
});

function harness(over: {
  hasKey?: boolean;
  groups?: CalendarGroup[];
  google?: Record<string, () => Promise<unknown[]>>;
}) {
  const logs: Array<Record<string, unknown>> = [];
  const applied: Array<{ group: string; plan: SyncPlan }> = [];
  const asked: string[] = [];
  const run = createCalendarSync({
    now: () => Date.parse('2026-11-20T00:00:00Z'),
    hasKey: () => over.hasKey ?? true,
    readGroups: async () => over.groups ?? [de],
    listGoogle: async (id) => {
      asked.push(id);
      const answer = over.google?.[id];
      return (answer ? await answer() : [nobar]) as never;
    },
    readStored: async () => [] as CalendarEvent[],
    apply: async (group, plan) => {
      applied.push({ group: group.id, plan });
    },
    log: (entry) => logs.push(entry),
  });
  return { run, logs, applied, asked };
}

test('a run copies each synced calendar', async () => {
  const h = harness({});
  await h.run();
  assert.deepEqual(h.asked, [de.googleCalendarUrl]);
  assert.equal(h.applied.length, 1);
  assert.equal(h.applied[0]!.plan.insert[0]!.title, '[Kinship] Pips Nobar');
});

test('without the key file nothing is asked of Google, and it says so once', async () => {
  const h = harness({ hasKey: false });
  await h.run();
  await h.run();
  assert.deepEqual(h.asked, []);
  assert.equal(h.logs.length, 1);
});

test('a calendar Google refuses keeps its rows, is logged once until it changes, and the others still sync', async () => {
  const other: CalendarGroup = {
    ...de,
    id: 'g-other',
    code: 'other',
    googleCalendarUrl: 'other@group.calendar.google.com',
  };
  let refused = true;
  const h = harness({
    groups: [de, other],
    google: {
      [de.googleCalendarUrl!]: async () => {
        if (refused)
          throw Object.assign(new Error('Not Found'), {
            response: { status: 404 },
          });
        return [nobar];
      },
    },
  });
  await h.run();
  await h.run();
  // Nothing applied for the refused calendar (its rows are not removed), the other one synced both times.
  assert.deepEqual(
    h.applied.map((a) => a.group),
    ['g-other', 'g-other'],
  );
  assert.equal(h.logs.length, 1);
  assert.match(String(h.logs[0]!.message), /share it with the service account/);
  refused = false;
  await h.run();
  assert.equal(h.logs.length, 2);
  assert.equal(h.logs[1]!.message, 'Calendar readable again');
  assert.deepEqual(
    h.applied.map((a) => a.group),
    ['g-other', 'g-other', 'himpunan-prisma-de', 'g-other'],
  );
});

test('a run that starts while one is going does nothing', async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const h = harness({
    google: {
      [de.googleCalendarUrl!]: async () => {
        await gate;
        return [nobar];
      },
    },
  });
  const first = h.run();
  await h.run();
  release();
  await first;
  assert.equal(h.asked.length, 1);
});
