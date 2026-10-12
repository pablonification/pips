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
    },
    {
      id: 'm9',
      chatroomId: 'r9',
      userId: other.id,
      replyId: null,
      content: 'Pesan orang lain',
      createdAt: new Date('2026-10-07T03:00:00Z'),
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
        saveMessage: async ({ userId, chatroomId, content, replyId }) => {
          if (failSaves) throw new Error('database down');
          const saved: ChatroomMessage = {
            id: `s${messages.length + 1}`,
            chatroomId,
            userId,
            replyId,
            content,
            createdAt: new Date('2026-10-08T06:35:00Z'),
          };
          messages.push(saved);
          return saved;
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
