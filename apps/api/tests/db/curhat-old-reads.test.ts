// Runs against a real, throwaway PostgreSQL, as curhat.test.ts: `TEST_DATABASE_URL=postgres://…/pips_test… pnpm --filter api test:db`.
//
// The app before the redesign wrote no Curhat read marks, so on the day it is replaced every old message from the
// other side would count as unread. Migration 0029 marks them read, except the members' messages Welfare still owes
// an answer to. This builds rooms as the old app leaves them and reads the result through the app's own unread query.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { usePlaceholderEnv } from '../../scripts/placeholder-env';

const url = process.env.TEST_DATABASE_URL;
const MIGRATION = path.resolve(
  import.meta.dirname,
  '../../drizzle/0029_curhat_old_messages_read.sql',
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

const MEMBERS = ['or-a', 'or-b', 'or-c', 'or-d', 'or-w1', 'or-w2'];
const WELFARE = ['or-w1', 'or-w2'];

let client: import('postgres').Sql;
let db: import('../../src/db/drizzle').Database;

before(async () => {
  const testUrl = throwawayUrl();
  usePlaceholderEnv({ DATABASE_URL: testUrl });
  const postgres = (await import('postgres')).default;
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const { migrate } = await import('drizzle-orm/postgres-js/migrator');
  const { inArray } = await import('drizzle-orm');
  const schema = await import('../../src/db/schema');
  client = postgres(testUrl, { max: 4, onnotice: () => {} });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });

  await db.delete(schema.users).where(inArray(schema.users.id, MEMBERS));
  await db
    .insert(schema.angkatan)
    .values({ year: 2025, name: 'PIXEL' })
    .onConflictDoNothing();
  await db.insert(schema.users).values(
    MEMBERS.map((id, i) => {
      const nim = `1352599${i}`;
      return {
        id,
        nim,
        email: `${nim}@std.stei.itb.ac.id`,
        fullName: id,
        major: 'IF' as const,
        region: 'Ganesha' as const,
        angkatan: 2025,
        gender: 'F' as const,
        membershipStatus: 'anggota',
      };
    }),
  );
  await db
    .insert(schema.userRoles)
    .values(
      WELFARE.map((userId) => ({ userId, role: 'curhatadmin' as const })),
    );

  await db.insert(schema.chatrooms).values([
    // Welfare answered last.
    { id: 'or-r1', title: 'answered', userId: 'or-a' },
    // The member wrote again after replies from both Welfare members.
    { id: 'or-r2', title: 'waiting again', userId: 'or-b' },
    // Welfare never answered.
    { id: 'or-r3', title: 'never answered', userId: 'or-c' },
    // No message at all.
    { id: 'or-r4', title: 'empty', userId: 'or-d' },
  ]);
  const at = (m: number) => new Date(Date.UTC(2025, 2, 1, 6, m));
  const rows: Array<[string, string, string, number]> = [
    ['or-m1', 'or-r1', 'or-a', 1],
    ['or-m2', 'or-r1', 'or-w1', 2],
    ['or-m3', 'or-r2', 'or-b', 3],
    ['or-m4', 'or-r2', 'or-w1', 4],
    ['or-m5', 'or-r2', 'or-b', 5],
    ['or-m6', 'or-r2', 'or-w2', 6],
    ['or-m7', 'or-r2', 'or-b', 7],
    ['or-m8', 'or-r2', 'or-b', 8],
    ['or-m9', 'or-r3', 'or-c', 9],
    ['or-m10', 'or-r3', 'or-c', 10],
  ];
  await db.insert(schema.chatroomMessages).values(
    rows.map(([id, chatroomId, userId, minute]) => ({
      id,
      chatroomId,
      userId,
      content: id,
      createdAt: at(minute),
    })),
  );
  // A mark that already exists keeps its time.
  await db.insert(schema.chatroomMessageReads).values({
    userId: 'or-w1',
    chatroomMessageId: 'or-m1',
    readAt: at(30),
  });
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

async function unread(userId: string) {
  const { getUnreadCounts } =
    await import('../../src/repositories/chatroom.repo');
  const rows = await getUnreadCounts(db, userId, WELFARE.includes(userId));
  return rows
    .filter((r) => r.chatroomId.startsWith('or-'))
    .sort((a, b) => a.chatroomId.localeCompare(b.chatroomId));
}

async function marks() {
  const [{ count }] = await client<{ count: number }[]>`
    select count(*)::int as count from chatroom_message_reads where user_id like 'or-%'`;
  return count;
}

const WAITING = [
  { chatroomId: 'or-r2', unreadCount: 2 },
  { chatroomId: 'or-r3', unreadCount: 2 },
];

test('old conversations are read, and Welfare still sees the rooms waiting for an answer', async () => {
  for (let run = 1; run <= 2; run += 1) {
    await runMigration();
    for (const owner of ['or-a', 'or-b', 'or-c', 'or-d']) {
      assert.deepEqual(await unread(owner), [], `${owner}, run ${run}`);
    }
    for (const welfare of WELFARE) {
      assert.deepEqual(
        await unread(welfare),
        WAITING,
        `${welfare}, run ${run}`,
      );
    }
  }
});

test('it only adds marks: a second run adds none and an existing mark keeps its time', async () => {
  const before = await marks();
  await runMigration();
  assert.equal(await marks(), before);
  const [kept] = await client<{ same: boolean }[]>`
    select read_at = '2025-03-01T06:30:00Z'::timestamptz as same from chatroom_message_reads
    where user_id = 'or-w1' and chatroom_message_id = 'or-m1'`;
  assert.equal(kept.same, true);
  // Owners: m2, m4, m6. Welfare 1: m3, m5, m6 (m1 was already marked). Welfare 2: m1, m2, m3, m4, m5.
  assert.equal(before, 3 + 3 + 5 + 1);
});
