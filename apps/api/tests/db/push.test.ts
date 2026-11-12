// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
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

const USERS = [
  ['ps-nadia', '13525951'],
  ['ps-raka', '13524951'],
] as const;
const endpoint = (user: string, n: number) =>
  `https://fcm.googleapis.com/fcm/send/${user}-${n}`;

async function cleanUp() {
  const { inArray, like } = await import('drizzle-orm');
  await db
    .delete(schema.pushSubscriptions)
    .where(like(schema.pushSubscriptions.endpoint, '%/ps-%'));
  await db.delete(schema.users).where(
    inArray(
      schema.users.id,
      USERS.map(([id]) => id),
    ),
  );
}

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await cleanUp();
  await db
    .insert(schema.angkatan)
    .values({ year: 2025, name: 'ps-PIXEL' })
    .onConflictDoNothing();
  await db.insert(schema.users).values(
    USERS.map(([id, nim]) => ({
      id,
      nim,
      email: `${nim}@std.stei.itb.ac.id`,
      fullName: id,
      major: 'IF' as const,
      region: 'Ganesha' as const,
      angkatan: 2025,
      gender: 'F' as const,
      membershipStatus: 'anggota',
    })),
  );
});

after(async () => {
  if (db) await cleanUp();
  await client?.end();
});

async function devicesOf(user: string) {
  const { eq } = await import('drizzle-orm');
  return (
    await db
      .select({ endpoint: schema.pushSubscriptions.endpoint })
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, user))
  )
    .map((r) => r.endpoint)
    .sort();
}

test("a member keeps at most 20 devices: a 21st replaces that member's oldest", async () => {
  const { createOrUpdatePushSubscription } =
    await import('../../src/repositories/push.repo');
  const { sql } = await import('drizzle-orm');
  const keys = { p256dh: 'p', auth: 'a' };
  // Raka's devices are older than all of Nadia's, so only Nadia's own count.
  await db.insert(schema.pushSubscriptions).values(
    Array.from({ length: 3 }, (_, n) => ({
      endpoint: endpoint('ps-raka', n),
      userId: 'ps-raka',
      keys,
      createdAt: sql`now() - interval '1 year'`,
    })),
  );
  await db.insert(schema.pushSubscriptions).values(
    Array.from({ length: 20 }, (_, n) => ({
      endpoint: endpoint('ps-nadia', n),
      userId: 'ps-nadia',
      keys,
      createdAt: sql`now() - ${`${100 - n} minutes`}::interval`,
    })),
  );

  await createOrUpdatePushSubscription(db, {
    endpoint: endpoint('ps-nadia', 20),
    userId: 'ps-nadia',
    keys,
  });
  const nadia = await devicesOf('ps-nadia');
  assert.equal(nadia.length, 20);
  assert.ok(!nadia.includes(endpoint('ps-nadia', 0)), 'the oldest went');
  assert.ok(nadia.includes(endpoint('ps-nadia', 20)), 'the new one stays');
  assert.equal((await devicesOf('ps-raka')).length, 3);

  // Registering a device again counts as new: it isn't the one replaced next.
  await createOrUpdatePushSubscription(db, {
    endpoint: endpoint('ps-nadia', 1),
    userId: 'ps-nadia',
    keys,
  });
  await createOrUpdatePushSubscription(db, {
    endpoint: endpoint('ps-nadia', 21),
    userId: 'ps-nadia',
    keys,
  });
  const after = await devicesOf('ps-nadia');
  assert.equal(after.length, 20);
  assert.ok(after.includes(endpoint('ps-nadia', 1)));
  assert.ok(!after.includes(endpoint('ps-nadia', 2)));
});
