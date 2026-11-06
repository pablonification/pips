// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// The API reliability fixes that live in SQL: the re-send claim, search text, the Kalender month and group lookups.
import { strict as assert } from 'node:assert';
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
let schema: typeof import('../../src/db/schema');
let info: typeof import('../../src/repositories/info.repo');
let calendar: typeof import('../../src/repositories/calendar.repo');
let semesterYear: number;

const HOUR = 60 * 60 * 1000;
const USERS = ['rl-raka', 'rl-nadia'];
const COURSES = ['rl-algo', 'rl-basdat'];
const GROUPS = ['rl-himpunan', 'rl-akademik'];

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray } = await import('drizzle-orm');
  schema = await import('../../src/db/schema');
  info = await import('../../src/repositories/info.repo');
  calendar = await import('../../src/repositories/calendar.repo');
  const course = await import('../../src/repositories/course.repo');
  client = postgres(testUrl, { max: 10, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await cleanUp(inArray);

  await db
    .insert(schema.angkatan)
    .values({ year: 2025, name: 'rl-PIXEL' })
    .onConflictDoNothing();
  await db.insert(schema.users).values(
    USERS.map((id, i) => ({
      id,
      nim: `1352599${i}`,
      email: `${id}@std.stei.itb.ac.id`,
      fullName: id,
      major: 'IF' as const,
      region: 'Ganesha' as const,
      angkatan: 2025,
      gender: 'F' as const,
      membershipStatus: 'anggota',
    })),
  );
  await db.insert(schema.infos).values([
    {
      id: 'rl-post',
      creatorId: 'rl-raka',
      title: 'Kuis C++ dan Basis Data',
      content: 'Siapkan algoritma kalian.',
      isForAngkatan: false,
      isForGroups: false,
      lastNotifiedAt: new Date(Date.now() - 4 * HOUR),
    },
  ]);
  await db.insert(schema.courses).values([
    {
      id: 'rl-algo',
      code: 'RL2211',
      name: 'Strategi Algoritma',
      curriculumYear: 2024,
      major: 'IF',
    },
    {
      id: 'rl-basdat',
      code: 'RL2240',
      name: 'Basis Data',
      curriculumYear: 2024,
      major: 'IF',
    },
  ]);
  const current = course.getCurrentSemesterCodeAndYear();
  semesterYear = current.semesterYearTaken;
  await db.insert(schema.userCourses).values({
    userId: 'rl-nadia',
    courseId: 'rl-algo',
    class: 1,
    semesterCodeTaken: current.semesterCodeTaken,
    semesterYearTaken: current.semesterYearTaken,
  });
  await db.insert(schema.calendarGroup).values([
    {
      id: 'rl-himpunan',
      name: 'Himpunan',
      category: 'himpunan',
      code: 'rl-himpunan',
    },
    {
      id: 'rl-akademik',
      name: 'Akademik',
      category: 'akademik',
      code: 'rl-akademik',
    },
  ]);
  const ev = (
    id: string,
    start: string,
    group: string,
    courseId: string | null = null,
    title = id,
  ) => ({
    id,
    calendarGroupId: group,
    courseId,
    title,
    description: 'Deskripsi acara',
    category: courseId ? 'Akademik' : 'Himpunan',
    academicYear: courseId ? semesterYear : null,
    start: new Date(start),
    end: new Date(start),
    googleCalendarUrl: '',
    googleCalendarId: '',
  });
  await db.insert(schema.calendarEvent).values([
    // Around October 2026 in WIB: 1 October 00.00 WIB is 30 September 17.00 UTC.
    ev('rl-h-sep', '2026-09-30T16:59:59Z', 'rl-himpunan'),
    ev(
      'rl-h-oct-first',
      '2026-09-30T17:00:00Z',
      'rl-himpunan',
      null,
      'Kuis basis',
    ),
    ev('rl-h-oct-last', '2026-10-31T16:59:59Z', 'rl-himpunan'),
    ev('rl-h-nov', '2026-10-31T17:00:00Z', 'rl-himpunan'),
    ev('rl-a-oct', '2026-10-15T02:00:00Z', 'rl-akademik', 'rl-algo'),
    ev('rl-a-oct-other', '2026-10-15T02:00:00Z', 'rl-akademik', 'rl-basdat'),
    ev('rl-a-nov', '2026-11-02T02:00:00Z', 'rl-akademik', 'rl-algo'),
  ]);
});

async function cleanUp(inArray: typeof import('drizzle-orm').inArray) {
  await db
    .delete(schema.calendarGroup)
    .where(inArray(schema.calendarGroup.id, GROUPS));
  await db.delete(schema.courses).where(inArray(schema.courses.id, COURSES));
  await db.delete(schema.users).where(inArray(schema.users.id, USERS));
}

after(async () => {
  if (db) await cleanUp((await import('drizzle-orm')).inArray);
  await client?.end();
});

// Regression: the re-send pushed first and moved lastNotifiedAt afterwards, so two requests at once both pushed.
test('of eight re-send claims at once, exactly one wins; then it is locked', async () => {
  const claims = await Promise.all(
    Array.from({ length: 8 }, () =>
      info.claimRenotify(db, 'rl-post', 'rl-raka'),
    ),
  );
  assert.equal(claims.filter(Boolean).length, 1);
  const row = await db.query.infos.findFirst({
    where: (t, { eq }) => eq(t.id, 'rl-post'),
  });
  assert.ok(Date.now() - (row?.lastNotifiedAt.getTime() ?? 0) < 60_000);
  assert.equal(await info.claimRenotify(db, 'rl-post', 'rl-raka'), false);
  // Three hours later (the default) it opens again, for its author only.
  const later = Date.now() + 3 * HOUR + 1000;
  assert.equal(
    await info.claimRenotify(db, 'rl-post', 'rl-nadia', later, 3),
    false,
  );
  assert.equal(
    await info.claimRenotify(db, 'rl-post', 'rl-raka', later, 3),
    true,
  );
});

const searchPosts = async (search: string) =>
  (await info.getListInfos(db, { search } as never, 'rl-nadia', 2025))
    .map((p) => p.id)
    .filter((id) => id === 'rl-post');

// Regression: search text went into to_tsquery as typed; `(`, `&`, `!`, `:`, `'` or "C++" gave a 500.
test('announcement search: odd characters never fail, words still match by prefix', async () => {
  for (const search of [
    '(',
    '&',
    '!',
    ':',
    "'",
    'C++',
    "kuis'",
    'a & (b',
    '!!!',
    ':*',
    '\\',
  ]) {
    await assert.doesNotReject(searchPosts(search), search);
  }
  assert.deepEqual(await searchPosts('C++'), ['rl-post']);
  assert.deepEqual(await searchPosts('Kuis'), ['rl-post']);
  assert.deepEqual(
    await searchPosts('bas dat'),
    ['rl-post'],
    'prefixes, every word',
  );
  assert.deepEqual(await searchPosts('algoritma kuis'), ['rl-post']);
  assert.deepEqual(await searchPosts('kuis zzz'), []);
  assert.deepEqual(await searchPosts('(!)'), [], 'no word: nothing matches');
});

const searchEvents = async (search: string) =>
  (await calendar.getCalendarEvent(db, { search } as never))
    .map((e) => e.id)
    .filter((id) => id.startsWith('rl-'));

// Regression: Kalender's search split on the letter "s" (`/s+/`, meant `/\s+/`), so "kuis basis" failed.
test('Kalender search: words with "s", spaces and odd characters', async () => {
  assert.deepEqual(await searchEvents('kuis basis'), ['rl-h-oct-first']);
  assert.deepEqual(await searchEvents('basis'), ['rl-h-oct-first']);
  for (const search of ['(', 'C++', "'", 'a & b', ':']) {
    await assert.doesNotReject(searchEvents(search), search);
  }
  const withCourse = await calendar.getCalendarEvent(db, {
    search: 'kuis (basis',
    courseCode: 'RL2211',
  } as never);
  assert.deepEqual(withCourse, []);
});

test("Kalender's month reads only that month in WIB, with the same events as before", async () => {
  const nadia = { id: 'rl-nadia', angkatan: 2025 } as never;
  const october = await calendar.getPersonalCalendar(db, nadia, {
    month: 10,
    year: 2026,
  });
  assert.deepEqual(
    october.map((e) => e.id).filter((id) => id.startsWith('rl-')),
    ['rl-h-oct-first', 'rl-a-oct', 'rl-h-oct-last'],
  );
  const november = await calendar.getPersonalCalendar(db, nadia, {
    month: 11,
    year: 2026,
  });
  assert.deepEqual(
    november.map((e) => e.id).filter((id) => id.startsWith('rl-')),
    ['rl-h-nov', 'rl-a-nov'],
  );
});

// Regression: it filtered calendar groups on calendar_event.id, a column of another table (a SQL error).
test('a calendar group is found by its id', async () => {
  const group = await calendar.getCalendarGroupById(db, 'rl-himpunan');
  assert.equal(group?.id, 'rl-himpunan');
  assert.equal(await calendar.getCalendarGroupById(db, 'rl-none'), undefined);
});
