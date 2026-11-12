// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// It creates (and drops) its own databases beside TEST_DATABASE_URL's, so it needs a role that may create databases.
//
// A database whose migration records outnumber its id counter (for example 24 rows with the counter at 22, when two
// migrations were recorded by hand) must still migrate: otherwise `pnpm db:migrate` fails at its first insert.
import { strict as assert } from 'node:assert';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { runMigrate } from '../../src/db/migrate';

const url = process.env.TEST_DATABASE_URL;
const FOLDER = path.resolve(import.meta.dirname, '../../drizzle');
// Production's state: migrations 0000–0023 applied, as 24 rows with ids 1–24, and the id counter at 22.
const APPLIED = 24;
const COUNTER = 22;

function throwawayUrl(): URL {
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
  return parsed;
}

let admin: postgres.Sql;
const made: string[] = [];
let olderFolder: string;

/** A new, empty database beside TEST_DATABASE_URL's; its name starts with that one's, so with pips_test. */
async function freshDatabase(suffix: string): Promise<string> {
  const base = throwawayUrl();
  const name = `${base.pathname.slice(1)}_${suffix}`;
  await admin.unsafe(`drop database if exists "${name}"`);
  await admin.unsafe(`create database "${name}"`);
  made.push(name);
  const fresh = new URL(base);
  fresh.pathname = `/${name}`;
  return fresh.toString();
}

/** Brings a database to production's state: 0000–0023 applied, the id counter left behind at 22. */
async function likeProduction(dbUrl: string) {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: olderFolder });
    const [{ count }] = await sql<
      { count: number }[]
    >`select count(*)::int as count from drizzle.__drizzle_migrations`;
    assert.equal(count, APPLIED);
    await sql`select setval(pg_get_serial_sequence('drizzle.__drizzle_migrations', 'id'), ${COUNTER})`;
  } finally {
    await sql.end();
  }
}

async function records(dbUrl: string) {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    const rows = await sql<
      { id: number }[]
    >`select id from drizzle.__drizzle_migrations order by id`;
    const [{ table }] = await sql<
      { table: string | null }[]
    >`select to_regclass('public.programme_windows')::text as table`;
    return { ids: rows.map((r) => r.id), programmeWindows: table };
  } finally {
    await sql.end();
  }
}

before(() => {
  admin = postgres(throwawayUrl().toString(), { max: 1, onnotice: () => {} });
  // The migrations folder as production last saw it: the journal ends at 0023.
  olderFolder = mkdtempSync(path.join(tmpdir(), 'pips-migrations-'));
  cpSync(FOLDER, olderFolder, { recursive: true });
  const journalPath = path.join(olderFolder, 'meta/_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  journal.entries = journal.entries.slice(0, APPLIED);
  writeFileSync(journalPath, JSON.stringify(journal));
});

after(async () => {
  for (const name of made) {
    await admin.unsafe(`drop database if exists "${name}" with (force)`);
  }
  await admin.end();
  rmSync(olderFolder, { recursive: true, force: true });
});

test('plain drizzle migrate fails on production’s records (the bug this guards)', async () => {
  const dbUrl = await freshDatabase('mig_plain');
  await likeProduction(dbUrl);
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    await assert.rejects(
      migrate(drizzle(sql), { migrationsFolder: FOLDER }),
      /duplicate key value|already exists/,
    );
  } finally {
    await sql.end();
  }
  // Nothing was applied: drizzle runs the pending migrations in one transaction.
  assert.equal((await records(dbUrl)).programmeWindows, null);
});

test('db:migrate applies 0024–0028 on production’s records', async () => {
  const dbUrl = await freshDatabase('mig_prod');
  await likeProduction(dbUrl);
  await runMigrate({ url: dbUrl, migrationsFolder: FOLDER });
  const { ids, programmeWindows } = await records(dbUrl);
  const total = JSON.parse(
    readFileSync(path.join(FOLDER, 'meta/_journal.json'), 'utf8'),
  ).entries.length;
  assert.equal(ids.length, total);
  assert.deepEqual(
    ids,
    Array.from({ length: total }, (_, i) => i + 1),
  );
  assert.equal(programmeWindows, 'programme_windows');

  // A second run has nothing to do and still succeeds.
  await runMigrate({ url: dbUrl, migrationsFolder: FOLDER });
  assert.equal((await records(dbUrl)).ids.length, total);
});

test('db:migrate still migrates an empty database from scratch', async () => {
  const dbUrl = await freshDatabase('mig_empty');
  await runMigrate({ url: dbUrl, migrationsFolder: FOLDER });
  assert.equal((await records(dbUrl)).programmeWindows, 'programme_windows');
});
