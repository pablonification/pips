// The e2e harness's fake socket.io server answers Curhat's acknowledgements as the API does
// (apps/api/src/websocket/curhat.ts), so journeys see the API's behaviour.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDb } from '../e2e/fixtures/api';
import { FakeSocketServer, type FakeSocket } from '../e2e/support/socketio';

// Engine.IO "4" + socket.io packets, fed in as the client would send them.
function connect(server: FakeSocketServer, auth: Record<string, unknown>) {
  const s: FakeSocket = {
    sid: 'test',
    auth: {},
    connected: false,
    queue: [],
    waiting: null,
    rooms: new Set(),
  };
  const io = server as unknown as {
    receiveSocketIo: (s: FakeSocket, packet: string) => void;
  };
  io.receiveSocketIo(s, `0${JSON.stringify(auth)}`);
  const send = (event: string, data: unknown, ackId?: number) => {
    s.queue.length = 0;
    io.receiveSocketIo(s, `2${ackId ?? ''}${JSON.stringify([event, data])}`);
    const ack = s.queue.find((p) => p.startsWith(`43${ackId}[`));
    return ack ? JSON.parse(ack.slice(`43${ackId}`.length))[0] : undefined;
  };
  return { s, send };
}

test('a curhat handshake joins your rooms; a chatroomId handshake only yours', () => {
  const db = buildDb('anggota');
  const server = new FakeSocketServer(db);
  assert.deepEqual([...connect(server, { curhat: true }).s.rooms].sort(), [
    'r1',
    'r2',
  ]);
  assert.deepEqual([...connect(server, { chatroomId: 'r1' }).s.rooms], ['r1']);
  assert.deepEqual(
    [...connect(server, { chatroomId: 'someone-else' }).s.rooms],
    [],
  );
});

test('message acknowledgements: saved and acknowledged, or refused with the API’s codes', () => {
  const db = buildDb('anggota');
  const server = new FakeSocketServer(db);
  const { send } = connect(server, { curhat: true });
  const ok = send(
    'message',
    { chatroomId: 'r1', message: 'Mau kak, makasih!', replyId: 'm4' },
    1,
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.message.isSender, true);
  assert.equal(ok.message.reply.id, 'm4');
  assert.equal('userId' in ok.message, false);
  assert.equal(db.chatrooms.r1.messages![0].content, 'Mau kak, makasih!');

  assert.deepEqual(send('message', { chatroomId: 'r1', message: '  ' }, 2), {
    ok: false,
    error: 'invalid',
  });
  assert.deepEqual(
    send('message', { chatroomId: 'r1', message: 'x', replyId: 'm5' }, 3),
    { ok: false, error: 'invalid' },
  );
  assert.deepEqual(send('message', { chatroomId: 'zz', message: 'x' }, 4), {
    ok: false,
    error: 'forbidden',
  });
  // No callback: still saved, nothing answered.
  assert.equal(
    send('message', { chatroomId: 'r2', message: 'lama' }),
    undefined,
  );
  assert.equal(db.chatrooms.r2.messages![0].content, 'lama');

  db.signedIn = false;
  assert.deepEqual(send('message', { chatroomId: 'r1', message: 'x' }, 5), {
    ok: false,
    error: 'unauthorized',
  });
});

test('curhat:join checks access, and a test can change or withhold an answer', () => {
  const db = buildDb('anggota');
  const server = new FakeSocketServer(db);
  const { s, send } = connect(server, {});
  assert.deepEqual(send('curhat:join', { chatroomId: 'r2' }, 1), { ok: true });
  assert.ok(s.rooms.has('r2'));
  assert.deepEqual(send('curhat:join', { chatroomId: 'nope' }, 2), {
    ok: false,
    error: 'forbidden',
  });
  server.answer('message', () => ({ ok: false, error: 'server' }));
  assert.deepEqual(send('message', { chatroomId: 'r1', message: 'x' }, 3), {
    ok: false,
    error: 'server',
  });
  server.answer('message', () => undefined);
  assert.equal(
    send('message', { chatroomId: 'r1', message: 'x' }, 4),
    undefined,
  );
});

// P2-C: a lost or late acknowledgement. The test holds the answer back, then answers it by hand.
test('a held-back acknowledgement is answered later with ack(), on the connection that asked', () => {
  const db = buildDb('anggota');
  const server = new FakeSocketServer(db);
  const { s, send } = connect(server, { curhat: true });
  server.sessions.set(s.sid, s);
  server.answer('message', () => undefined);
  assert.equal(
    send('message', { chatroomId: 'r1', message: 'halo' }, 7),
    undefined,
  );
  const [entry] = server.emitted('message');
  assert.equal(entry.ackId, 7);
  assert.equal(entry.sid, 'test');
  s.queue.length = 0;
  assert.equal(server.ack(entry, { ok: false, error: 'server' }), true);
  assert.deepEqual(s.queue, ['437[{"ok":false,"error":"server"}]']);
  // The connection has gone: nobody to answer.
  s.connected = false;
  assert.equal(server.ack(entry, { ok: true }), false);
  // An event sent without asking for an acknowledgement can't be answered.
  s.connected = true;
  send('message', { chatroomId: 'r1', message: 'tanpa jawaban' });
  assert.throws(
    () => server.ack(server.emitted('message')[1], {}),
    /no acknowledgement/,
  );
});
