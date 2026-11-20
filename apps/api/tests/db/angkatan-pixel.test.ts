// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// Angkatan 2025 is called PIXEL. Migration 0032 names its row so, or adds it, without ever breaking the unique name.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;
const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../drizzle/0032_angkatan_pixel.sql',
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

let client: import('postgres').Sql;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 2, onnotice: () => {} });
  await migrate(drizzle(client, { schema }), {
    migrationsFolder: './drizzle',
  });
});

beforeEach(async () => {
  await client`delete from angkatan where year between 2020 and 2026`;
});

after(async () => {
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

async function names() {
  const rows = await client<Array<{ year: number; name: string }>>`
    select year, name from angkatan where year between 2020 and 2026 order by year`;
  return rows.map((r) => [r.year, r.name]);
}

test('the 2025 row under another name becomes PIXEL, and running 0032 twice changes nothing more', async () => {
  await client`insert into angkatan (id, year, name) values
    ('ap-2024', 2024, 'Angkatan 2024'), ('ap-2025', 2025, '2025')`;
  for (let run = 1; run <= 2; run += 1) {
    await runMigration();
    assert.deepEqual(
      await names(),
      [
        [2024, 'Angkatan 2024'],
        [2025, 'PIXEL'],
      ],
      `run ${run}`,
    );
  }
  const [{ id }] = await client<Array<{ id: string }>>`
    select id from angkatan where year = 2025`;
  assert.equal(id, 'ap-2025', 'the row is renamed, not replaced');
});

test('with no 2025 row, 0032 adds it as PIXEL once', async () => {
  await client`insert into angkatan (id, year, name) values ('ap-2024', 2024, 'Angkatan 2024')`;
  await runMigration();
  await runMigration();
  assert.deepEqual(await names(), [
    [2024, 'Angkatan 2024'],
    [2025, 'PIXEL'],
  ]);
});

test('if another year already holds the name, 0032 leaves every row alone instead of failing', async () => {
  await client`insert into angkatan (id, year, name) values
    ('ap-2024', 2024, 'PIXEL'), ('ap-2025', 2025, '2025')`;
  await runMigration();
  assert.deepEqual(await names(), [
    [2024, 'PIXEL'],
    [2025, '2025'],
  ]);
});
