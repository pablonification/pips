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
  fromOwner: true,
  clientMessageId: 'id-1',
  ...over,
});
/** The rooms cache with r1 holding `messages`. */
const holding = (...messages: ChatroomMessage[]) => ({
  r1: { id: 'r1', title: 'teal koala', messages },
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
      onRefused: (error) => log.push(`refused ${error}`),
      onSessionEnded: () => log.push('session ended'),
    },
    { now: () => NOW, newId: () => `id-${++ids}` },
  );
  let ids = 0;
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
    clientMessageId: 'id-1',
  });
  assert.equal('userId' in (socket.emits[0].data as object), false);
  socket.emits[0].ack(null, { ok: true, message: saved() });
  assert.equal(client.snapshot.outbox[0].status, 'delivered');
  assert.deepEqual(log, [`delivered ${e.localId} e2e-message-1`]);
  // It leaves once the rooms cache holds the server's copy.
  assert.deepEqual(client.settle(holding(saved())), []);
  assert.deepEqual(client.snapshot.outbox, []);
});

test('each message gets its own device id, a UUID by default', () => {
  const socket = new FakeSocket();
  const client = new CurhatClient(socket);
  socket.connect();
  client.send('r1', 'a', null);
  client.send('r1', 'b', null);
  const [a, b] = client.snapshot.outbox.map((e) => e.clientMessageId);
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(a, uuid);
  assert.match(b, uuid);
  assert.notEqual(a, b);
  assert.equal(
    (socket.emits[0].data as { clientMessageId: string }).clientMessageId,
    a,
  );
});

// Review M2 (OPEN-QUESTIONS A11): the connection drops after the server saved the message, before its answer.
test('saved, its acknowledgement lost: Gagal, then settled once the rooms hold its device id; no second send', () => {
  const { socket, client, log } = setup();
  socket.connect();
  client.send('r1', 'Mau kak, makasih!', 'm4');
  socket.drop();
  socket.emits[0].ack(new Error('socket has been disconnected'));
  assert.equal(client.snapshot.outbox[0].status, 'failed');
  socket.connect();
  assert.deepEqual(
    client.settle(holding(saved({ clientMessageId: 'id-1' }))),
    [],
  );
  assert.deepEqual(client.snapshot.outbox, []);
  assert.equal(socket.emits.length, 1);
  assert.deepEqual(log, ['failed local-1', 'reconnect']);
});

// Review minor 1: a rooms refetch that started before the save lands without the delivered message.
test('a delivered message the rooms cache lost is given back to put again, then settles', () => {
  const { socket, client } = setup();
  socket.connect();
  client.send('r1', 'Mau kak, makasih!', 'm4');
  socket.emits[0].ack(null, { ok: true, message: saved() });
  assert.deepEqual(client.settle(holding()), [saved()]);
  assert.equal(client.snapshot.outbox.length, 1);
  assert.deepEqual(client.settle(holding(saved())), []);
  assert.deepEqual(client.snapshot.outbox, []);
});

// Review minor 2: refusals Kirim ulang can't get past are reported, so the screen can catch up.
test('unauthorized and forbidden are reported; invalid, server and no answer are not', () => {
  const { socket, client, log } = setup();
  socket.connect();
  for (const answer of [
    { ok: false, error: 'unauthorized' },
    { ok: false, error: 'forbidden' },
    { ok: false, error: 'server' },
    { ok: false, error: 'invalid' },
  ]) {
    client.send('r1', 'halo', null);
    socket.emits.at(-1)!.ack(null, answer);
  }
  client.send('r1', 'halo', null);
  socket.emits.at(-1)!.ack(new Error('operation has timed out'));
  assert.deepEqual(
    log.filter((l) => l.startsWith('refused')),
    ['refused unauthorized', 'refused forbidden'],
  );
  assert.ok(client.snapshot.outbox.every((e) => e.status === 'failed'));
});

// Review minor 3: at session expiry the API ends the connection itself, and socket.io won't reconnect.
test('the server ending the connection is reported; reconnect() connects again; a network drop is not', () => {
  const { socket, client, log } = setup();
  socket.connect();
  socket.drop();
  assert.deepEqual(log, []);
  socket.connect();
  socket.connected = false;
  socket.fire('disconnect', 'io server disconnect');
  assert.equal(client.snapshot.status, 'down');
  assert.deepEqual(log, ['reconnect', 'session ended']);
  client.reconnect();
  assert.equal(client.snapshot.status, 'connected');
  // Connected already: nothing to do.
  client.reconnect();
  client.close();
  socket.connected = false;
  socket.fire('disconnect', 'io server disconnect');
  assert.equal(log.filter((l) => l === 'session ended').length, 1);
});

test('Gagal on { ok: false }', () => {
  const { socket, client, log } = setup();
  socket.connect();
  client.send('r1', 'halo', null);
  socket.emits[0].ack(null, { ok: false, error: 'server' });
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

test('Kirim ulang sends the same text, reply and device id again, and can deliver', () => {
  const { socket, client, log } = setup();
  socket.connect();
  const e = client.send('r1', 'Mau kak, makasih!', 'm4');
  socket.emits[0].ack(null, { ok: false, error: 'server' });
  client.retry(e.localId);
  assert.equal(client.snapshot.outbox[0].status, 'pending');
  assert.equal(socket.emits.length, 2);
  assert.deepEqual(socket.emits[1].data, socket.emits[0].data);
  assert.equal(
    (socket.emits[1].data as { clientMessageId: string }).clientMessageId,
    'id-1',
  );
  socket.emits[1].ack(null, { ok: true, message: saved() });
  assert.equal(client.snapshot.outbox[0].status, 'delivered');
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
