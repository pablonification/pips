// Runs against a real, throwaway PostgreSQL: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
// It migrates that database from empty and writes to it, so it refuses any database not named pips_test*.
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

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 10, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  await db.delete(schema.chatroomMessageReads);
  await db.delete(schema.chatroomMessages);
  await db.delete(schema.chatrooms);
  await db.delete(schema.users);
  await db.delete(schema.angkatan);
  await db.insert(schema.angkatan).values({ year: 2025, name: 'PIXEL' });
  await db.insert(schema.users).values(
    [
      ['u-nadia', '13525001'],
      ['u-other', '13525002'],
      ['u-welfare', '13524001'],
    ].map(([id, nim]) => ({
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
  await client?.end();
});

// Regression (C4, review M1): the count and the insert were separate steps, so ten creates sent together all read
// a count of 0 and all ten rooms were made.
test('ten creates sent together leave exactly three rooms', async () => {
  const { createChatroomWithinLimit } =
    await import('../../src/repositories/chatroom.repo');
  const { chatrooms } = await import('../../src/db/schema');
  const { eq } = await import('drizzle-orm');

  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createChatroomWithinLimit(db, { title: `room ${i}`, userId: 'u-nadia' }),
    ),
  );
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal(results.filter((r) => r === null).length, 7);
  const rows = await db
    .select()
    .from(chatrooms)
    .where(eq(chatrooms.userId, 'u-nadia'));
  assert.equal(rows.length, 3);
});

// Review minor 5: unread counts loaded every message of every room for Welfare; they are one SQL count now,
// and it must give exactly what the tested rule (countUnread) gives.
test('the SQL unread count agrees with countUnread', async () => {
  const schema = await import('../../src/db/schema');
  const { getUnreadCounts } =
    await import('../../src/repositories/chatroom.repo');
  const { countUnread } = await import('../../src/lib/curhat');
  await db.insert(schema.chatrooms).values([
    { id: 'ur1', title: 'a', userId: 'u-other' },
    { id: 'ur2', title: 'b', userId: 'u-other' },
    { id: 'ur3', title: 'c', userId: null },
  ]);
  const at = (m: number) => new Date(Date.UTC(2026, 9, 8, 6, m));
  const messages = [
    {
      id: 'um1',
      chatroomId: 'ur1',
      userId: 'u-other',
      content: '1',
      createdAt: at(1),
    },
    {
      id: 'um2',
      chatroomId: 'ur1',
      userId: 'u-welfare',
      content: '2',
      createdAt: at(2),
    },
    {
      id: 'um3',
      chatroomId: 'ur1',
      userId: 'u-welfare',
      content: '3',
      createdAt: at(3),
    },
    {
      id: 'um4',
      chatroomId: 'ur2',
      userId: 'u-other',
      content: '4',
      createdAt: at(4),
    },
    {
      id: 'um5',
      chatroomId: 'ur3',
      userId: 'u-other',
      content: '5',
      createdAt: at(5),
    },
  ];
  await db.insert(schema.chatroomMessages).values(messages);
  const reads = [
    { userId: 'u-other', chatroomMessageId: 'um2' },
    { userId: 'u-welfare', chatroomMessageId: 'um4' },
  ];
  await db.insert(schema.chatroomMessageReads).values(reads);

  const rooms = ['ur1', 'ur2', 'ur3'].map((id) => ({
    id,
    userId: id === 'ur3' ? null : 'u-other',
    messages: messages.filter((m) => m.chatroomId === id),
  }));
  const byRoom = (rows: Array<{ chatroomId: string; unreadCount: number }>) =>
    [...rows].sort((a, b) => a.chatroomId.localeCompare(b.chatroomId));
  for (const [userId, everyRoom] of [
    ['u-other', false],
    ['u-welfare', true],
    ['u-nadia', false],
  ] as const) {
    const readIds = new Set(
      reads.filter((r) => r.userId === userId).map((r) => r.chatroomMessageId),
    );
    const model = countUnread(
      rooms,
      readIds,
      { id: userId },
      everyRoom ? ['curhatadmin'] : [],
    ).filter((r) => r.chatroomId.startsWith('ur'));
    const fromSql = (await getUnreadCounts(db, userId, everyRoom)).filter((r) =>
      r.chatroomId.startsWith('ur'),
    );
    assert.deepEqual(byRoom(fromSql), byRoom(model), userId);
  }
  // Spelled out: the owner has one unread reply in ur1; Welfare has um1 in ur1 and um5 in ur3, ur2 read.
  assert.deepEqual(byRoom(await getUnreadCounts(db, 'u-other', false)), [
    { chatroomId: 'ur1', unreadCount: 1 },
  ]);
  assert.deepEqual(
    byRoom(
      (await getUnreadCounts(db, 'u-welfare', true)).filter((r) =>
        r.chatroomId.startsWith('ur'),
      ),
    ),
    [
      { chatroomId: 'ur1', unreadCount: 1 },
      { chatroomId: 'ur3', unreadCount: 1 },
    ],
  );
});
