import { strict as assert } from 'node:assert';
import { before, test } from 'node:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import { usePlaceholderEnv } from '../scripts/placeholder-env';
import {
  canAccessChatroom,
  canCreateChatroom,
  countUnread,
  CURHAT_MAX_ROOMS,
  toChatroomResponse,
} from '../src/lib/curhat';
import { pathsOfKey, sessionCookie, testUser } from './support/session';
import type { CurhatDeps } from '../src/controllers/curhat.controller';
import type { TChatroom } from '../src/types/curhat.types';

const nadia = testUser('u-nadia');
const other = testUser('u-other', { nim: '13525002' });
const welfare = testUser('u-welfare', { nim: '13524001', angkatan: 2024 });

// --- the rules ---

test('a room is open to its owner and to Welfare, and to no one else', () => {
  const room = { userId: nadia.id };
  assert.equal(canAccessChatroom(nadia, [], room), true);
  assert.equal(canAccessChatroom(other, [], room), false);
  assert.equal(canAccessChatroom(other, ['admin', 'ring1'], room), false);
  assert.equal(canAccessChatroom(welfare, ['curhatadmin'], room), true);
  assert.equal(canAccessChatroom(nadia, [], undefined), false);
  assert.equal(canAccessChatroom(nadia, [], null), false);
  // A room whose owner was removed belongs to no member.
  assert.equal(canAccessChatroom(nadia, [], { userId: null }), false);
  assert.equal(
    canAccessChatroom(welfare, ['curhatadmin'], { userId: null }),
    true,
  );
});

test('three rooms at most', () => {
  assert.equal(CURHAT_MAX_ROOMS, 3);
  assert.equal(canCreateChatroom(0), true);
  assert.equal(canCreateChatroom(2), true);
  assert.equal(canCreateChatroom(3), false);
  assert.equal(canCreateChatroom(4), false);
});

const at = (iso: string) => new Date(iso);

function room(
  id: string,
  userId: string | null,
  messages: Array<{ id: string; userId: string; replyId?: string | null }>,
): TChatroom & { isPinned?: boolean } {
  return {
    id,
    title: `room ${id}`,
    userId,
    messages: messages.map((m, i) => ({
      id: m.id,
      chatroomId: id,
      userId: m.userId,
      replyId: m.replyId ?? null,
      content: `text ${m.id}`,
      createdAt: at(`2026-10-0${i + 1}T03:00:00Z`),
    })),
  };
}

test('unread counts only accessible rooms and only messages from others, without a read mark', () => {
  const rooms = [
    room('r1', nadia.id, [
      { id: 'm1', userId: nadia.id },
      { id: 'm2', userId: welfare.id },
      { id: 'm3', userId: welfare.id },
    ]),
    room('r2', other.id, [{ id: 'm4', userId: welfare.id }]),
    room('r3', nadia.id, [{ id: 'm5', userId: nadia.id }]),
  ];
  assert.deepEqual(countUnread(rooms, new Set(), nadia, []), [
    { chatroomId: 'r1', unreadCount: 2 },
  ]);
  assert.deepEqual(countUnread(rooms, new Set(['m2']), nadia, []), [
    { chatroomId: 'r1', unreadCount: 1 },
  ]);
  // Welfare sees every room, and never counts its own replies.
  assert.deepEqual(countUnread(rooms, new Set(), welfare, ['curhatadmin']), [
    { chatroomId: 'r1', unreadCount: 1 },
    { chatroomId: 'r3', unreadCount: 1 },
  ]);
});

test('a room leaves the API without its owner or any sender id, at any depth', () => {
  const r = {
    ...room('r1', nadia.id, [
      { id: 'm1', userId: nadia.id },
      { id: 'm2', userId: welfare.id, replyId: 'm1' },
    ]),
    isPinned: true,
    labels: [
      {
        chatroomId: 'r1',
        labelId: 'l1',
        label: { id: 'l1', title: 'Akademik' },
      },
    ],
  };
  r.messages[1] = {
    ...r.messages[1],
    reply: { ...r.messages[0] },
  } as (typeof r.messages)[number];
  for (const viewer of [nadia, welfare]) {
    const out = toChatroomResponse(r, viewer.id);
    assert.deepEqual(pathsOfKey(out, 'userId'), [], viewer.id);
    assert.deepEqual(Object.keys(out).sort(), [
      'canDelete',
      'id',
      'isPinned',
      'labels',
      'messages',
      'title',
    ]);
    assert.deepEqual(Object.keys(out.messages![1]).sort(), [
      'chatroomId',
      'content',
      'createdAt',
      'id',
      'isSender',
      'reply',
      'replyId',
    ]);
  }
  const mine = toChatroomResponse(r, nadia.id);
  assert.equal(mine.canDelete, true);
  assert.deepEqual(
    mine.messages!.map((m) => m.isSender),
    [true, false],
  );
  const welfareView = toChatroomResponse(r, welfare.id);
  assert.equal(welfareView.canDelete, false);
  assert.deepEqual(
    welfareView.messages!.map((m) => m.isSender),
    [false, true],
  );
});

test('the read mark is one statement that skips your own messages and is safe to repeat', async () => {
  usePlaceholderEnv();
  const { markChatroomReadQuery } =
    await import('../src/repositories/chatroom.repo');
  const query = new PgDialect().sqlToQuery(
    markChatroomReadQuery('r1', nadia.id),
  );
  const sql = query.sql.replace(/\s+/g, ' ');
  assert.match(
    sql,
    /^insert into "chatroom_message_reads" \(user_id, chatroom_message_id\) select/,
  );
  assert.match(sql, /"chatroom_messages"\."chatroom_id" = \$\d/);
  assert.match(sql, /"chatroom_messages"\."user_id" <> \$\d/);
  assert.match(sql, /on conflict do nothing$/);
  assert.deepEqual(query.params, [nadia.id, 'r1', nadia.id]);
});

// --- the routes, through the real router with storage faked ---

interface World {
  roles: Record<string, string[]>;
  rooms: Array<TChatroom & { isPinned?: boolean }>;
  reads: Array<{ userId: string; messageId: string }>;
  created: Array<{ title: string; userId: string }>;
  locks: Record<string, Promise<void>>;
}

function fakeDeps(world: World): CurhatDeps {
  const owned = (userId: string) =>
    new Map(
      world.rooms.filter((r) => r.userId === userId).map((r) => [r.id, r]),
    );
  return {
    getUserRoles: async (id) => world.roles[id] ?? [],
    getUserChatrooms: async (id) => owned(id),
    getWelfareChatrooms: async () => new Map(world.rooms.map((r) => [r.id, r])),
    // Like the database: one create per member at a time (the row lock), counting rooms made just before.
    createChatroomWithinLimit: async (data) => {
      const previous = world.locks[data.userId] ?? Promise.resolve();
      let release!: () => void;
      world.locks[data.userId] = new Promise<void>((r) => (release = r));
      await previous;
      try {
        await new Promise((r) => setImmediate(r));
        if (!canCreateChatroom(owned(data.userId).size)) return null;
        world.created.push(data);
        const created = { id: `new-${world.created.length}`, ...data };
        world.rooms.push({ ...created, messages: [] });
        return created;
      } finally {
        release();
      }
    },
    getChatroomOwner: async (id) => {
      const r = world.rooms.find((x) => x.id === id);
      return r && { id: r.id, userId: r.userId };
    },
    deleteChatroom: async (id) => {
      world.rooms = world.rooms.filter((r) => r.id !== id);
    },
    // The model of the SQL count (tests/db/ checks the two agree on PostgreSQL).
    getUnreadCounts: async (userId, everyRoom) =>
      countUnread(
        world.rooms,
        new Set(
          world.reads
            .filter((r) => r.userId === userId)
            .map((r) => r.messageId),
        ),
        { id: userId },
        everyRoom ? ['curhatadmin'] : [],
      ),
    markChatroomRead: async (chatroomId, userId) => {
      const r = world.rooms.find((x) => x.id === chatroomId)!;
      for (const m of r.messages) {
        if (
          m.userId !== userId &&
          !world.reads.some((x) => x.userId === userId && x.messageId === m.id)
        ) {
          world.reads.push({ userId, messageId: m.id });
        }
      }
    },
    pinChatroom: async () => {},
  };
}

function newWorld(): World {
  return {
    roles: { [welfare.id]: ['curhatadmin'] },
    rooms: [
      room('r1', nadia.id, [
        { id: 'm1', userId: nadia.id },
        { id: 'm2', userId: welfare.id, replyId: 'm1' },
      ]),
      room('r2', nadia.id, []),
      room('r9', other.id, [
        { id: 'm9', userId: other.id },
        { id: 'm10', userId: welfare.id },
      ]),
    ],
    reads: [],
    created: [],
    locks: {},
  };
}

let createCurhatRouter: typeof import('../src/controllers/curhat.controller').createCurhatRouter;
before(async () => {
  usePlaceholderEnv();
  ({ createCurhatRouter } =
    await import('../src/controllers/curhat.controller'));
});

async function call(
  world: World,
  user: ReturnType<typeof testUser> | null,
  method: string,
  path: string,
) {
  const router = createCurhatRouter(fakeDeps(world));
  const headers: Record<string, string> = {};
  if (user) headers.Cookie = await sessionCookie(user);
  const res = await router.request(path, { method, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

test('every Curhat route needs a session', async () => {
  for (const [method, path] of [
    ['GET', '/curhat/chatrooms'],
    ['POST', '/curhat/chatroom'],
    ['GET', '/curhat/chatrooms/unread'],
    ['POST', '/curhat/chatroom/r1/read'],
  ]) {
    const { status } = await call(newWorld(), null, method, path);
    assert.equal(status, 401, `${method} ${path}`);
  }
});

// Regression (C4): the limit read `chatroomMap.keys.length`, the arity of `Map.prototype.keys` (always 0).
test('a fourth room is refused with 400; a third is still allowed', async () => {
  const world = newWorld();
  const third = await call(world, nadia, 'POST', '/curhat/chatroom');
  assert.equal(third.status, 201);
  assert.equal(world.created.length, 1);

  const fourth = await call(world, nadia, 'POST', '/curhat/chatroom');
  assert.equal(fourth.status, 400);
  assert.equal(world.created.length, 1, 'no fourth room was created');
});

// Regression (review M1): the route counted, then created in a separate step, so creates sent together all
// passed. The route now has one locked step to call; the real lock is tested against PostgreSQL in tests/db/.
test('five creates sent together make one room and refuse the rest', async () => {
  const world = newWorld();
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      call(world, nadia, 'POST', '/curhat/chatroom'),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.status).sort(),
    [201, 400, 400, 400, 400],
  );
  assert.equal(world.created.length, 1);
  assert.equal(world.rooms.filter((r) => r.userId === nadia.id).length, 3);
});

test('the room create locks the member row, then counts and inserts in the same transaction', async () => {
  usePlaceholderEnv();
  const { lockMemberQuery } = await import('../src/repositories/chatroom.repo');
  const query = new PgDialect().sqlToQuery(lockMemberQuery(nadia.id));
  assert.equal(
    query.sql.replace(/\s+/g, ' '),
    'select "users"."id" from "users" where "users"."id" = $1 for update',
  );
  assert.deepEqual(query.params, [nadia.id]);
});

test('unread is one SQL count: your rooms (or every room for Welfare), not your messages, no read mark', async () => {
  usePlaceholderEnv();
  const { db } = await import('../src/db/drizzle');
  const { unreadCountsQuery } =
    await import('../src/repositories/chatroom.repo');
  const mine = unreadCountsQuery(db, nadia.id, false).toSQL();
  const sql = mine.sql.replace(/\s+/g, ' ');
  assert.match(
    sql,
    /^select "chatroom_messages"\."chatroom_id", cast\(count\(\*\) as int\)/,
  );
  assert.match(
    sql,
    /left join "chatroom_message_reads" on \("chatroom_message_reads"\."chatroom_message_id" = "chatroom_messages"\."id" and "chatroom_message_reads"\."user_id" = \$1\)/,
  );
  assert.match(
    sql,
    /"chatrooms"\."user_id" = \$2 and "chatroom_messages"\."user_id" <> \$3 and "chatroom_message_reads"\."user_id" is null/,
  );
  assert.match(sql, /group by "chatroom_messages"\."chatroom_id"$/);
  assert.deepEqual(mine.params, [nadia.id, nadia.id, nadia.id]);

  const forWelfare = unreadCountsQuery(db, welfare.id, true).toSQL();
  assert.doesNotMatch(forWelfare.sql, /"chatrooms"\."user_id" =/);
  assert.match(forWelfare.sql, /"chatroom_messages"\."user_id" <> \$2/);
});

test('a new room comes back without its owner id, named by the server', async () => {
  const world = newWorld();
  world.rooms = [];
  const { status, body } = await call(world, nadia, 'POST', '/curhat/chatroom');
  assert.equal(status, 201);
  assert.deepEqual(pathsOfKey(body, 'userId'), []);
  assert.deepEqual(body.messages, []);
  assert.equal(body.canDelete, true);
  assert.equal(typeof body.title, 'string');
  assert.equal(world.created[0].userId, nadia.id);
});

test('no userId at any depth in either view of the room list', async () => {
  const member = await call(newWorld(), nadia, 'GET', '/curhat/chatrooms');
  assert.equal(member.status, 200);
  assert.deepEqual(Object.keys(member.body).sort(), ['r1', 'r2']);
  assert.deepEqual(pathsOfKey(member.body, 'userId'), []);
  assert.equal(member.body.r1.messages[1].replyId, 'm1');

  const welfareView = await call(
    newWorld(),
    welfare,
    'GET',
    '/curhat/chatrooms',
  );
  assert.equal(welfareView.status, 200);
  assert.deepEqual(Object.keys(welfareView.body).sort(), ['r1', 'r2', 'r9']);
  assert.deepEqual(pathsOfKey(welfareView.body, 'userId'), []);
  assert.equal(welfareView.body.r1.canDelete, false);
});

// Regression (C3): the unread list covered every room in the database (handing their ids to any member) and
// counted the caller's own messages.
test('unread covers only your rooms and only messages you did not send', async () => {
  const { status, body } = await call(
    newWorld(),
    nadia,
    'GET',
    '/curhat/chatrooms/unread',
  );
  assert.equal(status, 200);
  assert.deepEqual(body, [{ chatroomId: 'r1', unreadCount: 1 }]);

  const forWelfare = await call(
    newWorld(),
    welfare,
    'GET',
    '/curhat/chatrooms/unread',
  );
  assert.deepEqual(
    forWelfare.body.sort(
      (a: { chatroomId: string }, b: { chatroomId: string }) =>
        a.chatroomId.localeCompare(b.chatroomId),
    ),
    [
      { chatroomId: 'r1', unreadCount: 1 },
      { chatroomId: 'r9', unreadCount: 1 },
    ],
  );
});

// Regression: the read route was defined but never mounted, so it answered 401 and nothing wrote read marks.
test('reading a room marks it read, clears its unread count, and is safe to repeat', async () => {
  const world = newWorld();
  const first = await call(world, nadia, 'POST', '/curhat/chatroom/r1/read');
  assert.equal(first.status, 200);
  const second = await call(world, nadia, 'POST', '/curhat/chatroom/r1/read');
  assert.equal(second.status, 200);
  assert.deepEqual(world.reads, [{ userId: nadia.id, messageId: 'm2' }]);
  const unread = await call(world, nadia, 'GET', '/curhat/chatrooms/unread');
  assert.deepEqual(unread.body, []);
});

test("reading another member's room is refused; an unknown room is 404", async () => {
  const world = newWorld();
  const theirs = await call(world, nadia, 'POST', '/curhat/chatroom/r9/read');
  assert.equal(theirs.status, 403);
  assert.deepEqual(world.reads, []);
  const missing = await call(
    world,
    nadia,
    'POST',
    '/curhat/chatroom/nope/read',
  );
  assert.equal(missing.status, 404);
  const asWelfare = await call(
    world,
    welfare,
    'POST',
    '/curhat/chatroom/r9/read',
  );
  assert.equal(asWelfare.status, 200);
});

test('only the owner deletes a room', async () => {
  const world = newWorld();
  const byWelfare = await call(world, welfare, 'DELETE', '/curhat/chatroom/r1');
  assert.equal(byWelfare.status, 401);
  const byOwner = await call(world, nadia, 'DELETE', '/curhat/chatroom/r1');
  assert.equal(byOwner.status, 200);
  assert.equal(
    world.rooms.some((r) => r.id === 'r1'),
    false,
  );
});

test('the OpenAPI document: the unread route takes no path parameter, and the read route is mounted', async () => {
  const { createApp } = await import('../src/app');
  const doc = (await (await createApp().request('/doc')).json()) as {
    paths: Record<string, Record<string, { parameters?: unknown[] }>>;
  };
  assert.equal(
    doc.paths['/api/curhat/chatrooms/unread'].get.parameters,
    undefined,
  );
  assert.ok(doc.paths['/api/curhat/chatroom/{chatroomId}/read'].post);
  // The socket's contract is in the document too, so the web client is typed against it.
  const schemas = (doc as unknown as { components: { schemas: object } })
    .components.schemas;
  for (const name of [
    'CurhatMessagePayload',
    'CurhatJoinPayload',
    'CurhatMessageAck',
    'CurhatJoinAck',
    'CurhatReplyEvent',
  ]) {
    assert.ok(name in schemas, name);
  }
});
