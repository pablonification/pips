// P2-C: Curhat's connection (src/features/curhat/client.ts) with a fake socket: Mengirim → Terkirim on { ok: true };
// Gagal on { ok: false }, on no acknowledgement in time, on a drop before the answer, and at once when down; Kirim
// ulang; never emitting while down (so socket.io can't buffer a message and send it twice); the reconnect catch-up;
// replies; joining a new room; and the deferred socket that loads socket.io-client on demand.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { ChatroomMessage } from '../src/api/generated';
import {
  CurhatClient,
  DeferredSocket,
  type SocketLike,
} from '../src/features/curhat/client';

type Ack = (err: Error | null, answer?: unknown) => void;

class FakeSocket implements SocketLike {
  connected = false;
  emits: { event: string; data: unknown; timeout: number; ack: Ack }[] = [];
  disconnected = false;
  private handlers = new Map<string, ((...a: unknown[]) => void)[]>();

  on(event: string, listener: (...args: never[]) => void) {
    const list = this.handlers.get(event) ?? [];
    list.push(listener as (...a: unknown[]) => void);
    this.handlers.set(event, list);
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    for (const l of this.handlers.get(event) ?? []) l(...args);
  }
  timeout(ms: number) {
    return {
      emit: (event: string, data: unknown, ack: Ack) => {
        this.emits.push({ event, data, timeout: ms, ack });
      },
    };
  }
  disconnect() {
    this.disconnected = true;
    return this;
  }
  connect() {
    this.connected = true;
    this.fire('connect');
  }
  drop() {
    this.connected = false;
    this.fire('disconnect', 'transport close');
  }
}

const NOW = new Date('2026-10-08T06:35:00.000Z');
const saved = (over: Partial<ChatroomMessage> = {}): ChatroomMessage => ({
  id: 'e2e-message-1',
  chatroomId: 'r1',
  replyId: 'm4',
  content: 'Mau kak, makasih!',
  createdAt: NOW.toISOString(),
  isSender: true,
  ...over,
});

function setup() {
  const socket = new FakeSocket();
  const log: string[] = [];
  const client = new CurhatClient(
    socket,
    {
      onReply: (m) => log.push(`reply ${m.id}`),
      onReconnect: () => log.push('reconnect'),
      onDelivered: (e, m) => log.push(`delivered ${e.localId} ${m.id}`),
      onFailed: (e) => log.push(`failed ${e.localId}`),
    },
    { now: () => NOW },
  );
  return { socket, client, log };
}

test('connecting, then connected; down after a drop; the catch-up when it is back', () => {
  const { socket, client, log } = setup();
  assert.equal(client.snapshot.status, 'connecting');
  socket.connect();
  assert.equal(client.snapshot.status, 'connected');
  assert.deepEqual(log, [], 'the first connection is no reconnect');
  socket.drop();
  assert.equal(client.snapshot.status, 'down');
  socket.connect();
  assert.equal(client.snapshot.status, 'connected');
  assert.deepEqual(log, ['reconnect']);
});

test('a failed first connection is down too', () => {
  const { socket, client } = setup();
  socket.fire('connect_error', new Error('refused'));
  assert.equal(client.snapshot.status, 'down');
});

test('sending: the exact payload with a 10 s acknowledgement; Mengirim, then delivered on { ok: true }', () => {
  const { socket, client, log } = setup();
  socket.connect();
  const e = client.send('r1', 'Mau kak, makasih!', 'm4');
  assert.equal(client.snapshot.outbox[0].status, 'pending');
  assert.equal(socket.emits.length, 1);
  assert.equal(socket.emits[0].event, 'message');
  assert.equal(socket.emits[0].timeout, 10_000);
  assert.deepEqual(socket.emits[0].data, {
    chatroomId: 'r1',
    message: 'Mau kak, makasih!',
    replyId: 'm4',
  });
  assert.equal('userId' in (socket.emits[0].data as object), false);
  socket.emits[0].ack(null, { ok: true, message: saved() });
  assert.deepEqual(client.snapshot.outbox, []);
  assert.deepEqual(log, [`delivered ${e.localId} e2e-message-1`]);
});

test('Gagal on { ok: false }', () => {
  const { socket, client, log } = setup();
  socket.connect();
  client.send('r1', 'halo', null);
  socket.emits[0].ack(null, { ok: false, error: 'forbidden' });
  assert.equal(client.snapshot.outbox[0].status, 'failed');
  assert.deepEqual(log, ['failed local-1']);
});

test('Gagal when no acknowledgement comes in time (socket.io reports the timeout as an error)', () => {
  const { socket, client } = setup();
  socket.connect();
  client.send('r1', 'halo', null);
  socket.emits[0].ack(new Error('operation has timed out'));
  assert.equal(client.snapshot.outbox[0].status, 'failed');
  // A late answer after the timeout changes nothing.
  socket.emits[0].ack(null, { ok: true, message: saved() });
  assert.equal(client.snapshot.outbox[0].status, 'failed');
});

test('Gagal at once when the connection is down: nothing is emitted, so nothing is sent later', () => {
  const { socket, client } = setup();
  client.send('r1', 'sebelum tersambung', null);
  assert.equal(socket.emits.length, 0);
  assert.equal(client.snapshot.outbox[0].status, 'failed');
  socket.connect();
  socket.drop();
  client.send('r1', 'saat terputus', null);
  assert.equal(socket.emits.length, 0);
  assert.deepEqual(
    client.snapshot.outbox.map((e) => e.status),
    ['failed', 'failed'],
  );
});

test('Kirim ulang sends the same text and reply again, and can deliver', () => {
  const { socket, client, log } = setup();
  socket.connect();
  const e = client.send('r1', 'Mau kak, makasih!', 'm4');
  socket.emits[0].ack(null, { ok: false, error: 'server' });
  client.retry(e.localId);
  assert.equal(client.snapshot.outbox[0].status, 'pending');
  assert.equal(socket.emits.length, 2);
  assert.deepEqual(socket.emits[1].data, socket.emits[0].data);
  socket.emits[1].ack(null, { ok: true, message: saved() });
  assert.deepEqual(client.snapshot.outbox, []);
  assert.equal(log.at(-1), `delivered ${e.localId} e2e-message-1`);
  // Retrying something that isn't failed does nothing.
  client.retry(e.localId);
  assert.equal(socket.emits.length, 2);
});

test('replies reach the screen; joining a room asks the server', async () => {
  const { socket, client, log } = setup();
  socket.connect();
  socket.fire('reply', saved({ id: 'm9', isSender: false }));
  socket.fire('reply', null);
  assert.deepEqual(log, ['reply m9']);
  const joined = client.join('e2e-room-3');
  assert.equal(socket.emits[0].event, 'curhat:join');
  assert.deepEqual(socket.emits[0].data, { chatroomId: 'e2e-room-3' });
  socket.emits[0].ack(null, { ok: true });
  assert.equal(await joined, true);
  const refused = client.join('r9');
  socket.emits[1].ack(null, { ok: false, error: 'forbidden' });
  assert.equal(await refused, false);
  socket.drop();
  assert.equal(await client.join('r1'), false);
});

test('a deleted room takes its unsent messages; closing disconnects', () => {
  const { socket, client } = setup();
  client.send('r1', 'a', null);
  client.send('r2', 'b', null);
  client.dropRoom('r1');
  assert.deepEqual(
    client.snapshot.outbox.map((e) => e.chatroomId),
    ['r2'],
  );
  client.close();
  assert.equal(socket.disconnected, true);
  // After closing, a drop isn't reported as a lost connection.
  socket.drop();
  assert.equal(client.snapshot.status, 'connecting');
});

test('subscribers hear every change', () => {
  const { socket, client } = setup();
  let n = 0;
  const off = client.subscribe(() => n++);
  socket.connect();
  client.send('r1', 'a', null);
  off();
  socket.drop();
  assert.equal(n, 2);
});

test('the deferred socket: listeners wait for the code; not connected until then; a failed load is a failed connection', async () => {
  const real = new FakeSocket();
  let resolve!: (s: SocketLike) => void;
  const deferred = new DeferredSocket(
    () => new Promise<SocketLike>((r) => (resolve = r)),
  );
  const client = new CurhatClient(deferred, {}, { now: () => NOW });
  client.send('r1', 'terlalu cepat', null);
  assert.equal(client.snapshot.outbox[0].status, 'failed');
  resolve(real);
  await Promise.resolve();
  await Promise.resolve();
  real.connect();
  assert.equal(client.snapshot.status, 'connected');
  assert.equal(deferred.connected, true);
  client.close();
  assert.equal(real.disconnected, true);

  const broken = new DeferredSocket(() => Promise.reject(new Error('offline')));
  const c2 = new CurhatClient(broken);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(c2.snapshot.status, 'down');
  c2.close();
});
