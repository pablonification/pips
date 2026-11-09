// Live Counting's connection (src/features/kelola/live-socket.ts) with a fake socket and fake timers.
// Regressions (web-robust 3 and 4): socket.io-client's dynamic import had no catch, so offline or right after a deploy
// Live Counting stayed disconnected for good; and when the server ended the connection (it now does when it can't
// read the session) nothing connected again.
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  openLiveSocket,
  type LiveEnv,
  type LiveSocketLike,
} from '../src/features/kelola/live-socket';

class FakeSocket implements LiveSocketLike {
  connects = 0;
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
  connect() {
    this.connects++;
    this.fire('connect');
  }
  disconnect() {
    this.disconnected = true;
  }
  removeAllListeners() {
    this.handlers.clear();
  }
}

/** Fake time: `later` and `online` run when the test says. */
function fakeEnv() {
  let now = 0;
  let timers: { at: number; fn: () => void; live: boolean }[] = [];
  const online = new Set<() => void>();
  const env: LiveEnv = {
    later: (fn, ms) => {
      const t = { at: now + ms, fn, live: true };
      timers.push(t);
      return () => {
        t.live = false;
      };
    },
    onOnline: (fn) => {
      online.add(fn);
      return () => online.delete(fn);
    },
    now: () => now,
  };
  return {
    env,
    async tick(ms: number) {
      const end = now + ms;
      for (;;) {
        const next = timers
          .filter((t) => t.live && t.at <= end)
          .sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        now = next.at;
        next.live = false;
        next.fn();
        await flush();
      }
      now = end;
      timers = timers.filter((t) => t.live);
    },
    async goOnline() {
      for (const fn of [...online]) fn();
      await flush();
    },
    pending: () => timers.filter((t) => t.live).length,
  };
}
const flush = () => new Promise((r) => setImmediate(r));

function handlers(signedIn = () => true) {
  const log: string[] = [];
  return {
    log,
    h: {
      onStatus: (c: boolean) => log.push(c ? 'connected' : 'disconnected'),
      onReconnect: () => log.push('refresh'),
      events: {
        'form:new-response': (e: { total: number }) =>
          log.push(`total ${e.total}`),
      },
      checkSession: async () => {
        log.push('check session');
        return signedIn();
      },
    },
  };
}

test('socket.io-client that fails to load is loaded again after 2, 4, 8… s', async () => {
  const time = fakeEnv();
  let loads = 0;
  const socket = new FakeSocket();
  const { h, log } = handlers();
  openLiveSocket(
    async () => {
      loads++;
      if (loads < 4)
        throw new Error('Failed to fetch dynamically imported module');
      return socket;
    },
    h,
    time.env,
  );
  await flush();
  assert.equal(loads, 1);
  await time.tick(1_999);
  assert.equal(loads, 1);
  await time.tick(1);
  assert.equal(loads, 2);
  await time.tick(4_000);
  assert.equal(loads, 3);
  await time.tick(8_000);
  assert.equal(loads, 4);
  socket.connect();
  socket.fire('form:new-response', { total: 143 });
  assert.deepEqual(log, ['connected', 'total 143']);
  assert.equal(time.pending(), 0);
});

test('back online, it loads again at once, and only once', async () => {
  const time = fakeEnv();
  let loads = 0;
  const socket = new FakeSocket();
  const { h } = handlers();
  openLiveSocket(
    async () => {
      loads++;
      if (loads < 2) throw new Error('offline');
      return socket;
    },
    h,
    time.env,
  );
  await flush();
  await time.goOnline();
  assert.equal(loads, 2);
  // The wait it had set is cancelled.
  await time.tick(60_000);
  assert.equal(loads, 2);
});

test('closed while loading: the socket that arrives is closed, nothing is tried again', async () => {
  const time = fakeEnv();
  const socket = new FakeSocket();
  let resolve!: (s: FakeSocket) => void;
  const { h, log } = handlers();
  const close = openLiveSocket(
    () => new Promise<FakeSocket>((r) => (resolve = r)),
    h,
    time.env,
  );
  close();
  resolve(socket);
  await flush();
  assert.equal(socket.disconnected, true);
  assert.deepEqual(log, []);
});

test('a reconnect after a drop fetches again; the first connection does not', async () => {
  const socket = new FakeSocket();
  const { h, log } = handlers();
  openLiveSocket(async () => socket, h, fakeEnv().env);
  await flush();
  socket.connect();
  socket.fire('disconnect', 'transport close');
  socket.connect();
  assert.deepEqual(log, ['connected', 'disconnected', 'connected', 'refresh']);
});

test('the server ending the connection: the session is checked, then it connects again; repeated at once, it waits longer', async () => {
  const time = fakeEnv();
  const socket = new FakeSocket();
  const { h, log } = handlers();
  openLiveSocket(async () => socket, h, time.env);
  await flush();
  socket.connect();
  const end = async () => {
    socket.fire('disconnect', 'io server disconnect');
    await flush();
  };
  await end();
  assert.equal(socket.connects, 2, 'the first: at once, after the check');
  assert.ok(log.includes('check session'));
  const waits: number[] = [];
  for (let i = 0; i < 6; i++) {
    const count: number = socket.connects;
    await end();
    let waited = 0;
    while (socket.connects === count) {
      await time.tick(500);
      waited += 500;
    }
    waits.push(waited);
  }
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 16000, 30000]);
  // A connection that lasted: at once again.
  await time.tick(11_000);
  const before = socket.connects;
  await end();
  assert.equal(socket.connects, before + 1);
});

test('the server ending the connection when you are signed out: no reconnect', async () => {
  const socket = new FakeSocket();
  const { h } = handlers(() => false);
  openLiveSocket(async () => socket, h, fakeEnv().env);
  await flush();
  socket.connect();
  socket.fire('disconnect', 'io server disconnect');
  await flush();
  assert.equal(socket.connects, 1);
});

test('closing cancels a waiting reconnect and closes the socket', async () => {
  const time = fakeEnv();
  const socket = new FakeSocket();
  const { h } = handlers();
  const close = openLiveSocket(async () => socket, h, time.env);
  await flush();
  socket.connect();
  socket.fire('disconnect', 'io server disconnect');
  await flush();
  socket.fire('disconnect', 'io server disconnect');
  await flush();
  close();
  await time.tick(60_000);
  assert.equal(socket.connects, 2);
  assert.equal(socket.disconnected, true);
});
