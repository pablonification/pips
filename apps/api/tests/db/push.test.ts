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
  await db.delete(schema.chatrooms).where(like(schema.chatrooms.id, 'ps-%'));
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

test('a Curhat push reaches the owner and Welfare with no text, and forgets the devices the push service says are gone', async () => {
  const { sendCurhatNotification } = await import('../../src/websocket/setup');
  const webpush = (await import('web-push')).default;
  const keys = { p256dh: 'p', auth: 'a' };
  await db.insert(schema.chatrooms).values({
    id: 'ps-room',
    userId: 'ps-nadia',
    title: 'Contoh judul ruang',
  });
  await db
    .insert(schema.userRoles)
    .values({ userId: 'ps-raka', role: 'curhatadmin' });
  await db.insert(schema.pushSubscriptions).values([
    { endpoint: endpoint('ps-nadia', 90), userId: 'ps-nadia', keys },
    { endpoint: endpoint('ps-raka', 90), userId: 'ps-raka', keys },
    { endpoint: endpoint('ps-raka', 91), userId: 'ps-raka', keys },
  ]);
  const gone = endpoint('ps-raka', 91);
  const sent: Array<{ endpoints: string[]; push: unknown }> = [];
  const send = (async (subscriptions, push) => {
    // This test's devices only: the earlier test left others for the same members.
    const ours = subscriptions.filter((s) =>
      /\/ps-[a-z]+-9\d$/.test(s.endpoint),
    );
    sent.push({ endpoints: ours.map((s) => s.endpoint).sort(), push });
    return ours.map((s) =>
      s.endpoint === gone
        ? {
            status: 'fulfilled' as const,
            value: {
              success: false as const,
              error: new webpush.WebPushError('Gone', 410, {}, '', gone),
              endpoint: gone,
            },
          }
        : {
            status: 'fulfilled' as const,
            value: {
              success: true as const,
              result: { statusCode: 201, body: '', headers: {} },
            },
          },
    );
  }) as typeof import('../../src/lib/push-manager').sendNotificationToAll;

  await sendCurhatNotification(
    db,
    { chatroomId: 'ps-room', senderId: 'ps-nadia' },
    send,
  );
  assert.deepEqual(sent, [
    {
      endpoints: [endpoint('ps-raka', 90), gone],
      push: {
        title: 'Pesan baru di Curhat Yuk!',
        options: { data: { url: '/kelola/curhat/ps-room' } },
      },
    },
  ]);
  const raka = await devicesOf('ps-raka');
  assert.ok(raka.includes(endpoint('ps-raka', 90)), 'a working device stays');
  assert.ok(!raka.includes(gone), 'a gone device is forgotten');

  sent.length = 0;
  await sendCurhatNotification(
    db,
    { chatroomId: 'ps-room', senderId: 'ps-raka' },
    send,
  );
  assert.deepEqual(sent, [
    {
      endpoints: [endpoint('ps-nadia', 90)],
      push: {
        title: 'Pesan baru di Curhat Yuk!',
        options: { data: { url: '/layanan/curhat/ps-room' } },
      },
    },
  ]);
  assert.ok(!JSON.stringify(sent).includes('Contoh judul ruang'));
});

test("a failed clean-up after the owner's push doesn't cost Welfare theirs", async () => {
  const { sendCurhatNotification } = await import('../../src/websocket/setup');
  const webpush = (await import('web-push')).default;
  const keys = { p256dh: 'p', auth: 'a' };
  await db.insert(schema.chatrooms).values({
    id: 'ps-room-cleanup',
    userId: 'ps-nadia',
    title: 'Contoh judul ruang',
  });
  await db
    .insert(schema.userRoles)
    .values({ userId: 'ps-raka', role: 'curhatadmin' })
    .onConflictDoNothing();
  await db.insert(schema.pushSubscriptions).values([
    { endpoint: endpoint('ps-nadia', 80), userId: 'ps-nadia', keys },
    { endpoint: endpoint('ps-raka', 80), userId: 'ps-raka', keys },
  ]);
  const ownersDevice = endpoint('ps-nadia', 80);
  const sent: string[][] = [];
  const send = (async (subscriptions: Array<{ endpoint: string }>) => {
    const ours = subscriptions
      .filter((s) => /\/ps-[a-z]+-80$/.test(s.endpoint))
      .map((s) => s.endpoint);
    sent.push(ours);
    return ours.map((e) => ({
      status: 'fulfilled' as const,
      value:
        e === ownersDevice
          ? {
              success: false as const,
              error: new webpush.WebPushError('Gone', 410, {}, '', e),
              endpoint: e,
            }
          : {
              success: true as const,
              result: { statusCode: 201, body: '', headers: {} },
            },
    }));
  }) as unknown as typeof import('../../src/lib/push-manager').sendNotificationToAll;
  const failing = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'delete') {
        return () => {
          throw new Error('the clean-up failed');
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  await assert.rejects(
    sendCurhatNotification(
      failing,
      { chatroomId: 'ps-room-cleanup', senderId: 'ps-other' },
      send,
    ),
    /the clean-up failed/,
  );
  assert.deepEqual(sent, [[ownersDevice], [endpoint('ps-raka', 80)]]);
});

test("a push that can't be sent to the owner doesn't cost Welfare theirs", async () => {
  const { sendCurhatNotification } = await import('../../src/websocket/setup');
  const sent: string[][] = [];
  const send = (async (subscriptions: Array<{ endpoint: string }>) => {
    const ours = subscriptions
      .filter((s) => /\/ps-[a-z]+-80$/.test(s.endpoint))
      .map((s) => s.endpoint);
    sent.push(ours);
    if (ours.includes(endpoint('ps-nadia', 80))) {
      throw new Error('the push service is down');
    }
    return [];
  }) as unknown as typeof import('../../src/lib/push-manager').sendNotificationToAll;

  await assert.rejects(
    sendCurhatNotification(
      db,
      { chatroomId: 'ps-room-cleanup', senderId: 'ps-other' },
      send,
    ),
    /the push service is down/,
  );
  assert.deepEqual(sent, [
    [endpoint('ps-nadia', 80)],
    [endpoint('ps-raka', 80)],
  ]);
});
