// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// Kalender copies PRISMA's general Google calendar (migration 0033 lists it). A sync writes its events as Himpunan
// events every member sees, removes the ones Google dropped, and never touches the app's own events; and an event
// a pengurus adds in the app never goes to PRISMA's calendar.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;

function throwawayUrl(): string {
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required: a throwaway local database named pips_test*',
    );
  }
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (
    !name.startsWith('pips_test') ||
    !['127.0.0.1', 'localhost'].includes(parsed.hostname)
  ) {
    throw new Error(
      'TEST_DATABASE_URL must be a local database named pips_test*',
    );
  }
  return url;
}

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;
let calendar: typeof import('../../src/repositories/calendar.repo');
let sync: typeof import('../../src/lib/calendar-sync');

const DE = 'himpunan-prisma-de';
const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../drizzle/0033_calendar_sync.sql',
);
/** 0033's row for PRISMA's calendar. Other tests empty calendar_group, so it is put back here; it adds the row once. */
const addDeCalendar = async () => {
  const insert = readFileSync(MIGRATION, 'utf8')
    .split('--> statement-breakpoint')
    .find((s) => s.includes('INSERT INTO "calendar_group"'));
  assert.ok(insert, '0033 adds the calendar');
  await client.unsafe(insert);
};
const OWN = 'cs-himpunan';

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  calendar = await import('../../src/repositories/calendar.repo');
  sync = await import('../../src/lib/calendar-sync');
  client = postgres(testUrl, { max: 2, onnotice: () => {} });
  db = drizzle(client, { schema }) as unknown as typeof db;
  await migrate(drizzle(client, { schema }), {
    migrationsFolder: './drizzle',
  });
  await client`delete from calendar_event where calendar_group_id in (${DE}, ${OWN})`;
  await client`delete from calendar_group where id = ${OWN}`;
  await addDeCalendar();
  await addDeCalendar();
  // The app's own Himpunan calendar, as production has it; listed before PRISMA's by id order on purpose.
  await client`insert into calendar_group (id, name, category, code, google_calendar_url)
    values (${OWN}, 'Himpunan', 'himpunan', null, 'himpunan@group.calendar.google.com')`;
  await client`insert into calendar_event (id, calendar_group_id, title, description, category, start, "end",
      google_calendar_url, google_calendar_id)
    values ('cs-own', ${OWN}, 'Acara app', '', 'himpunan', '2026-11-25T03:00:00Z', '2026-11-25T05:00:00Z',
      'https://calendar.google.com/own', 'g-own')`;
});

after(async () => {
  await client`delete from calendar_event where calendar_group_id in (${DE}, ${OWN})`;
  await client`delete from calendar_group where id = ${OWN}`;
  await client?.end();
});

const event = (id: string, title: string, start: string, end: string) =>
  sync.toSyncedEvent(
    {
      id,
      status: 'confirmed',
      htmlLink: `https://www.google.com/calendar/event?eid=${id}`,
      summary: title,
      location: 'Labtek V',
      start: { dateTime: start },
      end: { dateTime: end },
    },
    'PRISMA - DE HMIF ITB',
  )!;

async function syncOnce(events: ReturnType<typeof event>[]) {
  const [group] = await calendar.getSyncedCalendarGroups(db);
  assert.ok(group, 'migration 0033 lists PRISMA - DE HMIF ITB');
  const { from, until } = sync.syncWindow(Date.parse('2026-11-20T00:00:00Z'));
  const stored = await calendar.getSyncedEventsBetween(
    db,
    group.id,
    from,
    until,
  );
  await calendar.applySyncPlan(db, group, sync.planSync(events, stored));
}

const deRows = async () =>
  (
    await client<
      Array<{
        title: string;
        synced: boolean;
        category: string;
        location: string | null;
      }>
    >`
    select title, synced, category, location from calendar_event
    where calendar_group_id = ${DE} order by start`
  ).map((r) => ({ ...r }));

test('migration 0033 lists PRISMA - DE HMIF ITB as the one synced calendar, a Himpunan one', async () => {
  const groups = await calendar.getSyncedCalendarGroups(db);
  assert.deepEqual(
    groups.map((g) => [g.id, g.category, g.code, g.synced]),
    [[DE, 'himpunan', 'prisma-de', true]],
  );
  assert.match(groups[0]!.googleCalendarUrl!, /@group\.calendar\.google\.com$/);
});

test('a sync writes, updates and removes PRISMA events, and never touches the app’s own', async () => {
  await syncOnce([
    event(
      'g-nobar',
      '[Kinship] Pips Nobar',
      '2026-11-27T19:00:00+07:00',
      '2026-11-27T22:00:00+07:00',
    ),
    event(
      'g-rapat',
      'Rapat Akbar',
      '2026-12-02T15:00:00+07:00',
      '2026-12-02T17:00:00+07:00',
    ),
  ]);
  assert.deepEqual(await deRows(), [
    {
      title: '[Kinship] Pips Nobar',
      synced: true,
      category: 'himpunan',
      location: 'Labtek V',
    },
    {
      title: 'Rapat Akbar',
      synced: true,
      category: 'himpunan',
      location: 'Labtek V',
    },
  ]);
  // Renamed in Google, and the rapat deleted there.
  await syncOnce([
    event(
      'g-nobar',
      '[Kinship] Pips Nobar Final',
      '2026-11-27T19:00:00+07:00',
      '2026-11-27T22:00:00+07:00',
    ),
  ]);
  assert.deepEqual(
    (await deRows()).map((r) => r.title),
    ['[Kinship] Pips Nobar Final'],
  );
  const [own] =
    await client`select title, synced from calendar_event where id = 'cs-own'`;
  assert.deepEqual({ ...own }, { title: 'Acara app', synced: false });
});

test('PRISMA events reach every member’s Kalender month as Himpunan events', async () => {
  const nadia = { id: 'cs-nadia', angkatan: 2025 } as never;
  const november = await calendar.getPersonalCalendar(db, nadia, {
    month: 11,
    year: 2026,
  });
  const titles = november.map((e) => e.title);
  assert.ok(titles.includes('[Kinship] Pips Nobar Final'), titles.join());
  assert.ok(titles.includes('Acara app'));
  const nobar = november.find((e) => e.title === '[Kinship] Pips Nobar Final')!;
  assert.equal(nobar.synced, true);
  assert.equal(nobar.location, 'Labtek V');
});

test('a Himpunan event added in the app goes to the app’s calendar, never PRISMA’s', async () => {
  const group = await calendar.getCalendarGroupByCategory(db, 'himpunan');
  assert.equal(group?.id, OWN);
});
