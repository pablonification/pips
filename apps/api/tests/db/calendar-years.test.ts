// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// Adding a Kalender event for a course writes to the Google calendar of the course's major and entry year. Migration
// 0031 gives the 2024 and 2025 angkatan their calendars and names the STI elective row by the code the app asks for.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, mock, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;
const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../drizzle/0031_calendar_years.sql',
);

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

// The courses a pengurus adds events for in the odd semester of 2026/2027.
const COURSES = [
  { id: 'cy-if-s3', major: 'IF', type: 'Mandatory', semester: 3 },
  { id: 'cy-if-s5', major: 'IF', type: 'Mandatory', semester: 5 },
  { id: 'cy-if-s7', major: 'IF', type: 'Mandatory', semester: 7 },
  { id: 'cy-if-el', major: 'IF', type: 'Elective', semester: null },
  { id: 'cy-sti-s3', major: 'STI', type: 'Mandatory', semester: 3 },
  { id: 'cy-sti-s5', major: 'STI', type: 'Mandatory', semester: 5 },
  { id: 'cy-sti-s7', major: 'STI', type: 'Mandatory', semester: 7 },
  { id: 'cy-sti-el', major: 'STI', type: 'Elective', semester: null },
] as const;

// Calendar rows as the database had them before 0031: years up to 2023 and the STI elective under `stioptional`.
const OLD_GROUPS = [
  ['cy-old-if2023', 'if2023'],
  ['cy-old-sti2023', 'sti2023'],
  ['cy-old-ifelective', 'ifelective'],
  ['cy-old-stioptional', 'stioptional'],
] as const;

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 2, onnotice: () => {} });
  db = drizzle(client, { schema }) as unknown as typeof db;
  await migrate(drizzle(client, { schema }), {
    migrationsFolder: './drizzle',
  });

  await client`delete from calendar_group`;
  await client`delete from courses where id like 'cy-%'`;
  for (const [id, code] of OLD_GROUPS) {
    await client`insert into calendar_group (id, name, category, code, google_calendar_url)
      values (${id}, ${code}, 'akademik', ${code}, ${`${code}@group.calendar.google.com`})`;
  }
  for (const c of COURSES) {
    await client`insert into courses (id, curriculum_year, jurusan, type, semester, code, name)
      values (${c.id}, 2024, ${c.major}, ${c.type}, ${c.semester}, ${c.id.toUpperCase()}, ${c.id})`;
  }
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-13T03:00:00Z') });
});

after(async () => {
  mock.timers.reset();
  await client?.end();
});

async function runMigration() {
  const statements = readFileSync(MIGRATION, 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  assert.ok(statements.length > 0, 'the migration has SQL');
  for (const statement of statements) await client.unsafe(statement);
}

async function calendarCodes() {
  const { getCalendarGroupByCourseId } =
    await import('../../src/repositories/calendar.repo');
  const found: Record<string, string | null> = {};
  for (const c of COURSES) {
    const group = await getCalendarGroupByCourseId(db, c.id);
    found[c.id] = group?.googleCalendarUrl ? group.code : null;
  }
  return found;
}

test('every course of the 2023, 2024 and 2025 angkatan finds a Google calendar after 0031, and running it twice adds nothing', async () => {
  const before = await calendarCodes();
  assert.equal(before['cy-if-s3'], null, 'no 2025 calendar before');
  assert.equal(
    before['cy-sti-el'],
    null,
    'no STI elective under its code before',
  );

  for (let run = 1; run <= 2; run += 1) {
    await runMigration();
    assert.deepEqual(
      await calendarCodes(),
      {
        'cy-if-s3': 'if2025',
        'cy-if-s5': 'if2024',
        'cy-if-s7': 'if2023',
        'cy-if-el': 'ifelective',
        'cy-sti-s3': 'sti2025',
        'cy-sti-s5': 'sti2024',
        'cy-sti-s7': 'sti2023',
        'cy-sti-el': 'stielective',
      },
      `run ${run}`,
    );
  }
  const [{ count }] = await client<Array<{ count: number }>>`
    select count(*)::int as count from calendar_group`;
  assert.equal(count, OLD_GROUPS.length + 4);
});
