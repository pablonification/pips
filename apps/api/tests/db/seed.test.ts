// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// The seed fills a migrated database with made-up members and data, adds nothing the second time, and never runs
// with production's settings.
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
let testUrl: string;

/** Removes every seeded row this file can tell apart, so other files see the database as they left it. */
async function removeSeed() {
  await client`delete from users where id like 'seed-%'`;
  await client`delete from calendar_group where id like 'seed-%'`;
  await client`delete from competitions where id like 'seed-%'`;
  await client`delete from courses where id like 'seed-%'`;
  await client`delete from categories where id like 'seed-%'`;
  await client`delete from angkatan where id like 'seed-%' and not exists (select 1 from users where users.angkatan = angkatan.year)`;
}

before(async () => {
  testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { runMigrate } = await import('../../src/db/migrate');
  await runMigrate({ url: testUrl });
  client = postgres(testUrl, { max: 2, onnotice: () => {} });
  await removeSeed();
  // The test login's own angkatan row, made before any seed: the seed must use it rather than fail.
  await client`insert into angkatan (id, year, name) values ('pre-existing-2025', 2025, '2025') on conflict do nothing`;
});

after(async () => {
  await removeSeed();
  await client?.end();
});

test('the seed refuses production settings and an unset APP_ENV', async () => {
  const { runSeed } = await import('../../src/db/seed');
  for (const appEnv of ['production', undefined, 'prod']) {
    await assert.rejects(runSeed({ url: testUrl, appEnv }), /APP_ENV/);
  }
  const [{ n }] = await client<
    Array<{ n: number }>
  >`select count(*)::int as n from users where id like 'seed-%'`;
  assert.equal(n, 0);
});

test('the seed fills the database once and adds nothing the second time', async () => {
  const { runSeed } = await import('../../src/db/seed');
  const first = await runSeed({ url: testUrl, appEnv: 'development' });
  for (const [label, n] of Object.entries(first)) {
    if (label === 'forms' || label === 'angkatan') continue;
    assert.ok(n > 0, `${label} added on the first run`);
  }
  assert.equal(first.members, 4);
  assert.equal(first.announcements, 4);

  const second = await runSeed({ url: testUrl, appEnv: 'development' });
  for (const [label, n] of Object.entries(second))
    assert.equal(n, 0, `${label} added nothing on the second run`);

  // The PIXEL announcement points at the angkatan row that already held 2025.
  const [pixel] = await client<Array<{ year: number }>>`
    select a.year from info_angkatan ia join angkatan a on a.id = ia.angkatan_id where ia.info_id = 'seed-info-pixel'`;
  assert.equal(pixel.year, 2025);

  // Every seeded student number is made up (a sequence of 900 or more), and every email is at the student domain.
  const people = await client<Array<{ nim: string; email: string }>>`
    select nim, email from users where id like 'seed-%'`;
  for (const { nim, email } of people) {
    assert.ok(Number(nim.slice(5)) >= 900, nim);
    assert.equal(email, `${nim}@std.stei.itb.ac.id`);
  }
});
