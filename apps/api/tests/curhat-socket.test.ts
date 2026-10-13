import { strict as assert } from 'node:assert';
import { createServer, type Server as HttpServer } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { Server } from 'socket.io';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import type { ChatroomMessage } from '../src/db/schema';
import {
  createConnectionHandler,
  formAdminRoom,
} from '../src/websocket/connection';
import {
  CurhatMessageAckSchema,
  CurhatReplyEventSchema,
} from '../src/types/curhat.types';
import {
  PLACEHOLDER_JWT_SECRET,
  pathsOfKey,
  sessionCookie,
  testUser,
} from './support/session';

// A real socket.io server with storage faked, on P0-D's port range (4470–4479).
const PORT = 4471;
const URL = `http://127.0.0.1:${PORT}`;

const nadia = testUser('u-nadia');
const other = testUser('u-other', { nim: '13525002' });
const welfare = testUser('u-welfare', { nim: '13524001' });
const admin = testUser('u-admin', { nim: '13524002' });

const ROLES: Record<string, string[]> = {
  [welfare.id]: ['curhatadmin'],
  [admin.id]: ['admin'],
};

let rooms: Array<{ id: string; userId: string | null }>;
let messages: ChatroomMessage[];
let notified: Array<{ chatroomId: string; senderId: string; content: string }>;
let failSaves: boolean;

beforeEach(() => {
  rooms = [
    { id: 'r1', userId: nadia.id },
    { id: 'r2', userId: nadia.id },
    { id: 'r9', userId: other.id },
  ];
  messages = [
    {
      id: 'm1',
      chatroomId: 'r1',
      userId: welfare.id,
      replyId: null,
      content: 'Halo, ada yang bisa dibantu?',
      createdAt: new Date('2026-10-07T03:00:00Z'),
      clientMessageId: null,
    },
    {
      id: 'm9',
      chatroomId: 'r9',
      userId: other.id,
      replyId: null,
      content: 'Pesan orang lain',
      createdAt: new Date('2026-10-07T03:00:00Z'),
      clientMessageId: null,
    },
  ];
  notified = [];
  failSaves = false;
});

let http: HttpServer;
let io: Server;
const clients: ClientSocket[] = [];

before(async () => {
  http = createServer();
  io = new Server(http);
  io.on(
    'connection',
    createConnectionHandler({
      jwtSecret: PLACEHOLDER_JWT_SECRET,
      getUserRoles: async (id) => ROLES[id] ?? [],
      curhat: {
        getChatroom: async (id) => rooms.find((r) => r.id === id),
        getOwnedChatroomIds: async (userId) =>
          rooms.filter((r) => r.userId === userId).map((r) => r.id),
        getMessage: async (id) => messages.find((m) => m.id === id),
        // As the unique index on (chatroom_id, client_message_id) does: a repeat in the same room saves nothing.
        saveMessage: async ({
          userId,
          chatroomId,
          content,
          replyId,
          clientMessageId,
        }) => {
          if (failSaves) throw new Error('database down');
          const first = clientMessageId
            ? messages.find(
                (m) =>
                  m.chatroomId === chatroomId &&
                  m.clientMessageId === clientMessageId,
              )
            : undefined;
          if (first) return { message: first, created: false };
          const saved: ChatroomMessage = {
            id: `s${messages.length + 1}`,
            chatroomId,
            userId,
            replyId,
            content,
            createdAt: new Date('2026-10-08T06:35:00Z'),
            clientMessageId,
          };
          messages.push(saved);
          return { message: saved, created: true };
        },
        notifyParticipants: async (m) => {
          notified.push(m);
        },
      },
    }),
  );
  await new Promise<void>((resolve) => http.listen(PORT, '127.0.0.1', resolve));
});

after(async () => {
  for (const c of clients) c.disconnect();
  await new Promise<void>((resolve) => io.close(() => resolve()));
});

async function client(
  user: ReturnType<typeof testUser> | null,
  auth: Record<string, unknown> = {},
  cookie?: string,
) {
  const headers: Record<string, string> = {};
  const c = cookie ?? (user ? await sessionCookie(user) : undefined);
  if (c) headers.Cookie = c;
  const socket = connect(URL, {
    auth,
    extraHeaders: headers,
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Waits until the server has acted on the handshake (joins happen right after the session is read). */
async function settled() {
  await new Promise((r) => setTimeout(r, 60));
}

async function roomsOf(socketId: string) {
  const [s] = (await io.fetchSockets()).filter((x) => x.id === socketId);
  return s ? [...s.rooms].filter((r) => r !== socketId).sort() : [];
}

function send(socket: ClientSocket, payload: unknown) {
  return socket.timeout(2000).emitWithAck('message', payload);
}

function collect(socket: ClientSocket, event: string) {
  const got: unknown[] = [];
  socket.on(event, (x: unknown) => got.push(x));
  return got;
}

// --- regressions (C3) ---

test('a socket without a session joins no room, and its messages are refused and never saved', async () => {
  const anon = await client(null, { chatroomId: 'r1', curhat: true });
  await settled();
  assert.deepEqual(await roomsOf(anon.id!), []);

  const before = messages.length;
  const ack = await send(anon, {
    chatroomId: 'r1',
    message: 'halo',
    userId: nadia.id,
  });
  assert.deepEqual(ack, { ok: false, error: 'unauthorized' });
  assert.equal(messages.length, before);
});

test('a forged or expired cookie counts as no session', async () => {
  const forged = await client(
    null,
    { chatroomId: 'r1' },
    await sessionCookie(nadia, 'not-the-secret'),
  );
  await settled();
  assert.deepEqual(await roomsOf(forged.id!), []);
  assert.deepEqual(await send(forged, { chatroomId: 'r1', message: 'x' }), {
    ok: false,
    error: 'unauthorized',
  });

  // Signed with the right secret, but expired a minute ago.
  const expired = await client(
    null,
    { chatroomId: 'r1', curhat: true },
    await sessionCookie(nadia, PLACEHOLDER_JWT_SECRET, -60),
  );
  await settled();
  assert.deepEqual(await roomsOf(expired.id!), []);
  assert.deepEqual(await send(expired, { chatroomId: 'r1', message: 'x' }), {
    ok: false,
    error: 'unauthorized',
  });
});

// Regression (review minor 1): the session was read once, so a socket kept sending after its token expired.
test('a socket is cut off when its session expires', async () => {
  const socket = await client(
    null,
    { chatroomId: 'r1' },
    await sessionCookie(nadia, PLACEHOLDER_JWT_SECRET, 2),
  );
  await settled();
  assert.deepEqual(await roomsOf(socket.id!), ['r1']);
  assert.equal(
    (await send(socket, { chatroomId: 'r1', message: 'masih bisa' })).ok,
    true,
  );
  // The token lasts 1–2 s (whole seconds); give the server 4 s before calling it a failure.
  const reason = await new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve('still connected'), 4000);
    socket.once('disconnect', (r) => {
      clearTimeout(timer);
      resolve(r);
    });
  });
  assert.equal(reason, 'io server disconnect');
  assert.deepEqual(
    await send(socket, { chatroomId: 'r1', message: 'x' }).catch(
      () => 'no answer',
    ),
    'no answer',
  );
});

// Regression (review minor 1): roles were read once, so Welfare kept every room after its role was taken away.
test('Welfare loses access at once when its role is taken away', async () => {
  const w = await client(welfare, { chatroomId: 'r9' });
  const owner = await client(other, { chatroomId: 'r9' });
  await settled();
  assert.deepEqual(await roomsOf(w.id!), ['r9']);
  const got = collect(w, 'reply');
  try {
    ROLES[welfare.id] = [];
    assert.deepEqual(await send(w, { chatroomId: 'r9', message: 'halo' }), {
      ok: false,
      error: 'forbidden',
    });
    assert.deepEqual(
      await w.timeout(2000).emitWithAck('curhat:join', { chatroomId: 'r1' }),
      { ok: false, error: 'forbidden' },
    );
    // The owner's next message no longer reaches the former Welfare socket, which leaves the room.
    assert.equal(
      (await send(owner, { chatroomId: 'r9', message: 'ada orang?' })).ok,
      true,
    );
    await settled();
    assert.deepEqual(got, []);
    assert.deepEqual(await roomsOf(w.id!), []);
  } finally {
    ROLES[welfare.id] = ['curhatadmin'];
  }
});

test("a member can neither join nor post into another member's room", async () => {
  const socket = await client(other, { chatroomId: 'r1' });
  await settled();
  assert.deepEqual(await roomsOf(socket.id!), []);

  const joined = await socket
    .timeout(2000)
    .emitWithAck('curhat:join', { chatroomId: 'r1' });
  assert.deepEqual(joined, { ok: false, error: 'forbidden' });

  const before = messages.length;
  assert.deepEqual(
    await send(socket, { chatroomId: 'r1', message: 'menyusup' }),
    {
      ok: false,
      error: 'forbidden',
    },
  );
  assert.equal(messages.length, before);
  assert.deepEqual(await roomsOf(socket.id!), []);
});

test('a room that does not exist is forbidden', async () => {
  const socket = await client(nadia);
  assert.deepEqual(await send(socket, { chatroomId: 'nope', message: 'x' }), {
    ok: false,
    error: 'forbidden',
  });
});

test('the message is saved under the signed-in member, whatever userId the payload claims', async () => {
  const socket = await client(nadia, { curhat: true });
  const ack = await send(socket, {
    chatroomId: 'r1',
    message: 'Mau kak, makasih!',
    replyId: 'm1',
    userId: other.id,
  });
  assert.equal(ack.ok, true);
  assert.equal(messages.at(-1)!.userId, nadia.id);
  assert.deepEqual(notified.at(-1), {
    chatroomId: 'r1',
    senderId: nadia.id,
    content: 'Mau kak, makasih!',
  });
});

// --- delivery acknowledgement (SPEC API change 2) and anonymity ---

test('the acknowledgement carries the saved message as its sender sees it, with no userId', async () => {
  const socket = await client(nadia, { curhat: true });
  const ack = await send(socket, {
    chatroomId: 'r1',
    message: 'Mau kak, makasih!',
    replyId: 'm1',
  });
  assert.deepEqual(CurhatMessageAckSchema.parse(ack), ack);
  assert.deepEqual(pathsOfKey(ack, 'userId'), []);
  assert.equal(ack.ok, true);
  assert.equal(ack.message.isSender, true);
  assert.equal(ack.message.chatroomId, 'r1');
  assert.equal(ack.message.content, 'Mau kak, makasih!');
  assert.equal(ack.message.replyId, 'm1');
  assert.equal(ack.message.reply.id, 'm1');
  assert.equal(ack.message.createdAt, '2026-10-08T06:35:00.000Z');
});

test('empty text, a malformed payload and a reply from another room are invalid', async () => {
  const socket = await client(nadia, { curhat: true });
  for (const payload of [
    { chatroomId: 'r1', message: '   \n ' },
    { chatroomId: 'r1' },
    { message: 'tanpa ruang' },
    'just text',
    { chatroomId: 'r1', message: 'balas', replyId: 'm9' },
    { chatroomId: 'r1', message: 'balas', replyId: 'missing' },
  ]) {
    assert.deepEqual(
      await send(socket, payload),
      { ok: false, error: 'invalid' },
      JSON.stringify(payload),
    );
  }
});

test('a failed save answers server', async () => {
  failSaves = true;
  const socket = await client(nadia, { curhat: true });
  assert.deepEqual(await send(socket, { chatroomId: 'r1', message: 'halo' }), {
    ok: false,
    error: 'server',
  });
});

test('reply reaches the other sockets in that room only, without any userId', async () => {
  const member = await client(nadia, { curhat: true });
  const staff = await client(welfare, { chatroomId: 'r1' });
  const otherRoomStaff = await client(welfare, { chatroomId: 'r9' });
  const outsider = await client(other, { curhat: true });
  await settled();
  const toMember = collect(member, 'reply');
  const toStaff = collect(staff, 'reply');
  const toOtherRoom = collect(otherRoomStaff, 'reply');
  const toOutsider = collect(outsider, 'reply');

  await send(member, { chatroomId: 'r1', message: 'Halo Welfare' });
  await settled();
  assert.equal(
    toMember.length,
    0,
    'the sender gets the acknowledgement, not a reply',
  );
  assert.equal(toOtherRoom.length, 0);
  assert.equal(toOutsider.length, 0);
  assert.equal(toStaff.length, 1);
  assert.deepEqual(
    CurhatReplyEventSchema.strict().parse(toStaff[0]),
    toStaff[0],
  );
  assert.deepEqual(pathsOfKey(toStaff[0], 'userId'), []);
  assert.equal((toStaff[0] as { isSender: boolean }).isSender, false);

  await send(staff, { chatroomId: 'r1', message: 'Halo juga' });
  await settled();
  assert.equal(toMember.length, 1);
  assert.equal((toMember[0] as { content: string }).content, 'Halo juga');
  assert.deepEqual(pathsOfKey(toMember[0], 'userId'), []);
});

// --- the device's message id (P2-C round 2, OPEN-QUESTIONS A11) ---

const CLIENT_ID = '7f3c2a10-5b1e-4c8d-9a6f-0e2b4d6c8a11';

test('a repeat of a message id saves once and answers with the message saved the first time', async () => {
  const member = await client(nadia, { curhat: true });
  const staff = await client(welfare, { chatroomId: 'r1' });
  await settled();
  const toStaff = collect(staff, 'reply');
  const before = messages.length;
  const payload = {
    chatroomId: 'r1',
    message: 'Mau kak, makasih!',
    replyId: 'm1',
    clientMessageId: CLIENT_ID,
  };
  const first = await send(member, payload);
  // Kirim ulang after the acknowledgement was lost: the same id again.
  const again = await send(member, payload);
  await settled();
  assert.equal(messages.length, before + 1, 'saved once');
  assert.deepEqual(again, first, 'answered with the same message');
  assert.equal(first.ok, true);
  assert.equal(first.message.clientMessageId, CLIENT_ID);
  assert.equal(first.message.reply.id, 'm1');
  assert.deepEqual(CurhatMessageAckSchema.parse(again), again);
  assert.equal(toStaff.length, 1, 'relayed once');
  assert.equal(notified.length, 1, 'notified once');
});

test("a message id is never matched to another member's message, in another room or in the same one", async () => {
  const member = await client(nadia, { curhat: true });
  const outsider = await client(other, { curhat: true });
  const staff = await client(welfare, { chatroomId: 'r1' });
  await settled();
  const mine = await send(member, {
    chatroomId: 'r1',
    message: 'punya Nadia',
    clientMessageId: CLIENT_ID,
  });
  assert.equal(mine.ok, true);

  // The same id in another member's room is their own new message.
  const theirs = await send(outsider, {
    chatroomId: 'r9',
    message: 'punya orang lain',
    clientMessageId: CLIENT_ID,
  });
  assert.equal(theirs.ok, true);
  assert.notEqual(theirs.message.id, mine.message.id);
  assert.equal(theirs.message.content, 'punya orang lain');
  assert.equal(
    messages.filter((m) => m.clientMessageId === CLIENT_ID).length,
    2,
  );

  // The same id from someone else in Nadia's room never answers with her message.
  const clash = await send(staff, {
    chatroomId: 'r1',
    message: 'dari Welfare',
    clientMessageId: CLIENT_ID,
  });
  assert.deepEqual(clash, { ok: false, error: 'invalid' });
  assert.deepEqual(pathsOfKey(clash, 'message'), []);
});

test("the message id goes only to its sender: Welfare's reply event carries none", async () => {
  const member = await client(nadia, { curhat: true });
  const staff = await client(welfare, { chatroomId: 'r1' });
  await settled();
  const toStaff = collect(staff, 'reply');
  await send(member, {
    chatroomId: 'r1',
    message: 'Halo Welfare',
    clientMessageId: CLIENT_ID,
  });
  await settled();
  assert.equal(toStaff.length, 1);
  assert.equal(
    (toStaff[0] as { clientMessageId: unknown }).clientMessageId,
    null,
  );
});

test('a message id that is not a UUID is invalid, and none at all still saves (older clients)', async () => {
  const member = await client(nadia, { curhat: true });
  assert.deepEqual(
    await send(member, {
      chatroomId: 'r1',
      message: 'halo',
      clientMessageId: 'Nadia 13525001',
    }),
    { ok: false, error: 'invalid' },
  );
  const before = messages.length;
  await send(member, { chatroomId: 'r1', message: 'halo' });
  await send(member, { chatroomId: 'r1', message: 'halo' });
  assert.equal(messages.length, before + 2);
});

// --- one connection for the whole area ---

test('a curhat handshake joins every room the member owns, and nothing else', async () => {
  const socket = await client(nadia, { curhat: true });
  await settled();
  assert.deepEqual(await roomsOf(socket.id!), ['r1', 'r2']);
});

test('curhat:join adds a room created after connecting, after the access check', async () => {
  const socket = await client(nadia, { curhat: true });
  await settled();
  rooms.push({ id: 'r3', userId: nadia.id });
  assert.deepEqual(
    await socket.timeout(2000).emitWithAck('curhat:join', { chatroomId: 'r3' }),
    { ok: true },
  );
  assert.deepEqual(await roomsOf(socket.id!), ['r1', 'r2', 'r3']);
  assert.deepEqual(await socket.timeout(2000).emitWithAck('curhat:join', {}), {
    ok: false,
    error: 'invalid',
  });
  const anon = await client(null);
  assert.deepEqual(
    await anon.timeout(2000).emitWithAck('curhat:join', { chatroomId: 'r3' }),
    { ok: false, error: 'unauthorized' },
  );
});

// --- today's clients keep working ---

test('old clients (handshake chatroomId, no callback) work for the owner and for Welfare', async () => {
  const member = await client(nadia, { chatroomId: 'r1' });
  const staff = await client(welfare, { chatroomId: 'r1' });
  await settled();
  assert.deepEqual(await roomsOf(member.id!), ['r1']);
  assert.deepEqual(await roomsOf(staff.id!), ['r1']);
  const toStaff = collect(staff, 'reply');
  const before = messages.length;
  // No acknowledgement callback, and today's payload shape, including the userId it still sends.
  member.emit('message', {
    message: 'Pesan lama',
    chatroomId: 'r1',
    userId: nadia.id,
    replyId: null,
  });
  await settled();
  assert.equal(messages.length, before + 1);
  assert.equal(messages.at(-1)!.userId, nadia.id);
  assert.equal(toStaff.length, 1);
});

test('old clients are refused for a room that is not theirs', async () => {
  const socket = await client(other, { chatroomId: 'r1' });
  await settled();
  assert.deepEqual(await roomsOf(socket.id!), []);
  const before = messages.length;
  socket.emit('message', { message: 'x', chatroomId: 'r1', userId: nadia.id });
  await settled();
  assert.equal(messages.length, before);
});

test('a message sent right after connecting, before the session is read, is not lost', async () => {
  const socket = connect(URL, {
    auth: { curhat: true },
    extraHeaders: { Cookie: await sessionCookie(nadia) },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  const ack = await send(socket, { chatroomId: 'r1', message: 'cepat' });
  assert.equal(ack.ok, true);
});

// --- Live Counting's room is untouched ---

test("Live Counting's formAdminId room still joins admins only", async () => {
  const adminSocket = await client(admin, { formAdminId: 'pixel' });
  const memberSocket = await client(nadia, { formAdminId: 'pixel' });
  const anon = await client(null, { formAdminId: 'pixel' });
  await settled();
  assert.deepEqual(await roomsOf(adminSocket.id!), [formAdminRoom('pixel')]);
  assert.deepEqual(await roomsOf(memberSocket.id!), []);
  assert.deepEqual(await roomsOf(anon.id!), []);
});
