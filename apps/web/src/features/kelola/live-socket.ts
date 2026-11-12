/**
 * Live Counting's connection, kept apart from React and from socket.io's module so tests/live-socket.test.ts can
 * drive it with a fake socket and fake timers:
 * - socket.io-client loads on demand. If it can't (offline, or its file gone after a deploy), it tries again when the
 *   device is back online, or after 2, 4, 8… up to 30 s, instead of staying disconnected for good.
 * - The server can end the connection itself (`io server disconnect`: the session expired, or the server couldn't
 *   read it). socket.io won't reconnect by itself: check the session, then connect again; when the server keeps
 *   ending it straight away, after 1, 2, 4… up to 30 s.
 */

/** The part of socket.io-client's Socket this uses. */
export interface LiveSocketLike {
  on(event: string, listener: (...args: never[]) => void): unknown;
  connect(): unknown;
  disconnect(): unknown;
  removeAllListeners(): unknown;
}

export interface LiveHandlers {
  /** Connected or not. */
  onStatus: (connected: boolean) => void;
  /** Back after being disconnected: fetch again what may have been missed. */
  onReconnect: () => void;
  /** Every other event the socket hears, by name. */
  events: Record<string, (payload: never) => void>;
  /** The server ended the connection: resolves whether you are still signed in (then it connects again). */
  checkSession: () => Promise<boolean>;
}

export interface LiveEnv {
  /** Runs `fn` after `ms`; returns a cancel. */
  later: (fn: () => void, ms: number) => () => void;
  /** Calls `fn` when the device is back online; returns a cancel. */
  onOnline: (fn: () => void) => () => void;
  now: () => number;
}

/** A connection that lasted this long was a working one: the next server-ended connection reconnects at once. */
const STABLE_MS = 10_000;
const backoff = (n: number, first: number) => Math.min(first * 2 ** n, 30_000);

const browserEnv: LiveEnv = {
  later: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
  onOnline: (fn) => {
    window.addEventListener('online', fn);
    return () => window.removeEventListener('online', fn);
  },
  now: () => Date.now(),
};

/** Opens the connection; returns the function that closes it. */
export function openLiveSocket(
  load: () => Promise<LiveSocketLike>,
  handlers: LiveHandlers,
  env: LiveEnv = browserEnv,
): () => void {
  let closed = false;
  let socket: LiveSocketLike | null = null;
  let loadFailures = 0;
  let serverEnds = 0;
  let connectedAt = 0;
  let connectedBefore = false;
  const cancels = new Set<() => void>();
  const track = (cancel: () => void) => {
    cancels.add(cancel);
    return cancel;
  };
  const clearPending = () => {
    for (const c of cancels) c();
    cancels.clear();
  };

  const start = () => {
    clearPending();
    if (closed) return;
    load().then(
      (s) => {
        if (closed) {
          s.disconnect();
          return;
        }
        socket = s;
        listen(s);
      },
      () => {
        if (closed) return;
        // Try again on whichever comes first: the device back online, or the wait.
        track(env.onOnline(start));
        track(env.later(start, backoff(loadFailures++, 2_000)));
      },
    );
  };

  const listen = (s: LiveSocketLike) => {
    s.on('connect', () => {
      connectedAt = env.now();
      handlers.onStatus(true);
      if (connectedBefore) handlers.onReconnect();
      connectedBefore = true;
    });
    s.on('disconnect', ((reason?: string) => {
      handlers.onStatus(false);
      if (closed || reason !== 'io server disconnect') return;
      if (env.now() - connectedAt > STABLE_MS) serverEnds = 0;
      const wait = serverEnds === 0 ? 0 : backoff(serverEnds - 1, 1_000);
      serverEnds++;
      void handlers.checkSession().then((signedIn) => {
        if (closed || !signedIn) return;
        if (!wait) s.connect();
        else
          track(
            env.later(() => {
              if (!closed) s.connect();
            }, wait),
          );
      });
    }) as never);
    for (const [event, listener] of Object.entries(handlers.events))
      s.on(event, listener as never);
  };

  start();
  return () => {
    closed = true;
    clearPending();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  };
}
