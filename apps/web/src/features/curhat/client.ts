/**
 * Curhat's connection and what you sent: one socket for the whole area, opened by the Curhat layout and closed when
 * you leave it. The API's protocol (apps/api/src/websocket/curhat.ts): the handshake `auth: { curhat: true }` joins
 * every room you own, `curhat:join` adds a room started later, and `message` is acknowledged with
 * `{ ok: true, message }` or `{ ok: false, error }`.
 *
 * Sending: a message shows at once as pending ("Mengirim"). It is delivered on `{ ok: true }`, and fails on
 * `{ ok: false }`, when no acknowledgement arrives within ACK_TIMEOUT_MS, when the connection drops before it does,
 * or when the connection is down at the moment you send. It is only ever emitted while connected, so socket.io never
 * buffers it to send later, maybe twice. Failed messages stay until Kirim ulang delivers them.
 *
 * Every message carries the device's id for it (`clientMessageId`, a UUID), and Kirim ulang sends the same id, so
 * the server saves it once and answers a repeat with the copy it saved. When the server's copy reaches the rooms
 * cache, `settle()` retires the entry: a message saved whose acknowledgement was lost shows once.
 *
 * Pure of React and of socket.io's module (the socket is passed in), so tests/curhat-client.test.ts drives it with a
 * fake socket.
 */
import type { ChatroomMessage, ListChatroom } from '~/api/generated';
import {
  ACK_TIMEOUT_MS,
  ackOutcome,
  outboxReducer,
  type Refusal,
  settleOutbox,
  type OutboxAction,
  type OutboxEntry,
} from './rules';

/** A connection that lasted this long was a working one: the next server-ended connection reconnects at once. */
const STABLE_MS = 10_000;

/** The part of socket.io-client's Socket this uses. */
export interface SocketLike {
  readonly connected: boolean;
  on(event: string, listener: (...args: never[]) => void): unknown;
  /** Connect again after the server ended the connection (socket.io doesn't by itself). */
  connect(): unknown;
  timeout(ms: number): {
    emit(
      event: string,
      data: unknown,
      ack: (err: Error | null, answer?: unknown) => void,
    ): unknown;
  };
  disconnect(): unknown;
}

/** `connecting` until the first connection; `down` after it drops or fails, until it is back. */
export type ConnectionStatus = 'connecting' | 'connected' | 'down';

interface CurhatClientEvents {
  /** A message from the room arrived (Welfare's reply, or yours from another tab). */
  onReply?: (message: ChatroomMessage) => void;
  /**
   * Connected, the first time or back after being down: catch up on what was missed. The server sends a connection
   * nothing saved before it joined its rooms, and the screen may have read them before the socket came up.
   */
  onConnect?: () => void;
  /** The server saved what you sent. */
  onDelivered?: (entry: OutboxEntry, message: ChatroomMessage) => void;
  /** What you sent failed. */
  onFailed?: (entry: OutboxEntry) => void;
  /**
   * The server refused it for a reason Kirim ulang can't fix by itself: `unauthorized` (the session is gone) or
   * `forbidden` (the room is gone, deleted on another device).
   */
  onRefused?: (error: Extract<Refusal, 'unauthorized' | 'forbidden'>) => void;
  /**
   * The server ended the connection (`io server disconnect`: the session expired, or the server couldn't read it).
   * socket.io won't reconnect by itself; check the session, then `reconnect()`.
   */
  onSessionEnded?: () => void;
}

export interface CurhatClientState {
  status: ConnectionStatus;
  outbox: OutboxEntry[];
}

export class CurhatClient {
  private state: CurhatClientState = { status: 'connecting', outbox: [] };
  private readonly listeners = new Set<() => void>();
  private seq = 0;
  private closed = false;
  /** Server-ended connections in a row, each soon after connecting; `reconnect()` waits longer for each. */
  private serverEnds = 0;
  private connectedAt = 0;
  private cancelReconnect: (() => void) | null = null;

  constructor(
    private readonly socket: SocketLike,
    private readonly events: CurhatClientEvents = {},
    private readonly options: {
      now?: () => Date;
      timeoutMs?: number;
      /** The device's id for a new message; a random UUID. */
      newId?: () => string;
      /** Runs `fn` after `ms`; returns a cancel. The browser's timer by default. */
      later?: (fn: () => void, ms: number) => () => void;
    } = {},
  ) {
    socket.on('connect', () => {
      this.connectedAt = Date.now();
      this.set({ status: 'connected' });
      this.events.onConnect?.();
    });
    const down = () => {
      if (this.closed) return;
      this.set({ status: 'down' });
    };
    socket.on('disconnect', ((reason?: string) => {
      down();
      if (!this.closed && reason === 'io server disconnect') {
        // A connection that lasted a while starts the count again; one ended at once (the server couldn't read the
        // session) adds to it.
        if (Date.now() - this.connectedAt > STABLE_MS) this.serverEnds = 0;
        this.serverEnds++;
        this.events.onSessionEnded?.();
      }
    }) as never);
    socket.on('connect_error', down);
    socket.on('reply', ((message: ChatroomMessage) => {
      if (message && typeof message === 'object' && message.chatroomId)
        this.events.onReply?.(message);
    }) as never);
  }

  get snapshot(): CurhatClientState {
    return this.state;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;

  private set(patch: Partial<CurhatClientState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  private dispatch(action: OutboxAction) {
    this.set({ outbox: outboxReducer(this.state.outbox, action) });
  }

  private now() {
    return (this.options.now?.() ?? new Date()).toISOString();
  }

  /** A message waits for its answer or failed ("Gagal · Kirim ulang"): it lives only here, in memory. */
  hasUnsent(): boolean {
    return (
      !this.closed &&
      this.state.outbox.some(
        (e) => e.status === 'pending' || e.status === 'failed',
      )
    );
  }

  /** Send a message to a room; it shows at once and settles into delivered or failed. */
  send(chatroomId: string, text: string, replyId: string | null): OutboxEntry {
    const entry: OutboxEntry = {
      localId: `local-${++this.seq}`,
      clientMessageId: this.options.newId?.() ?? crypto.randomUUID(),
      chatroomId,
      text,
      replyId,
      status: 'pending',
      at: this.now(),
    };
    this.dispatch({ type: 'send', entry });
    this.emit(entry);
    return entry;
  }

  /** Kirim ulang: the same text, reply and device id again, so a copy the server already saved isn't saved twice. */
  retry(localId: string) {
    const entry = this.state.outbox.find(
      (e) => e.localId === localId && e.status === 'failed',
    );
    if (!entry) return;
    const at = this.now();
    this.dispatch({ type: 'retry', localId, at });
    this.emit({ ...entry, status: 'pending', at });
  }

  /**
   * Match what you sent to the rooms cache (`settleOutbox`): entries the cache holds leave; delivered ones it lost
   * are returned for the caller to put back. Call it when the cache changes and no refetch of it is running.
   */
  settle(rooms: ListChatroom | undefined): ChatroomMessage[] {
    const { settled, restore } = settleOutbox(this.state.outbox, rooms);
    if (settled.length) this.dispatch({ type: 'settled', localIds: settled });
    return restore;
  }

  /** A deleted room takes its unsent messages with it. */
  dropRoom(chatroomId: string) {
    this.dispatch({ type: 'dropRoom', chatroomId });
  }

  private emit(entry: OutboxEntry) {
    const fail = (refusal?: Refusal) => {
      const now = this.state.outbox.find((e) => e.localId === entry.localId);
      if (now?.status !== 'pending') return;
      this.dispatch({ type: 'failed', localId: entry.localId, refusal });
      this.events.onFailed?.(entry);
    };
    // Down now: fail at once rather than let socket.io hold it and send it later.
    if (this.closed || !this.socket.connected) {
      fail();
      return;
    }
    let settled = false;
    this.socket.timeout(this.options.timeoutMs ?? ACK_TIMEOUT_MS).emit(
      'message',
      {
        chatroomId: entry.chatroomId,
        message: entry.text,
        replyId: entry.replyId,
        clientMessageId: entry.clientMessageId,
      },
      (err, answer) => {
        if (settled) return;
        settled = true;
        // `err`: no answer in time, or the connection dropped first.
        const outcome = err ? { ok: false as const } : ackOutcome(answer);
        if (!outcome.ok) {
          fail(outcome.error);
          if (outcome.error === 'unauthorized' || outcome.error === 'forbidden')
            this.events.onRefused?.(outcome.error);
          return;
        }
        if (!this.state.outbox.some((e) => e.localId === entry.localId)) return;
        // Kept, with the server's copy, until the rooms cache holds it (`settle`).
        this.dispatch({
          type: 'delivered',
          localId: entry.localId,
          message: outcome.message,
        });
        this.events.onDelivered?.(entry, outcome.message);
      },
    );
  }

  /** Join a room started after connecting (`curhat:join`). Resolves whether the server let you in. */
  join(chatroomId: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.closed || !this.socket.connected) return resolve(false);
      this.socket
        .timeout(this.options.timeoutMs ?? ACK_TIMEOUT_MS)
        .emit('curhat:join', { chatroomId }, (err, answer) =>
          resolve(
            !err && (answer as { ok?: unknown } | undefined)?.ok === true,
          ),
        );
    });
  }

  /**
   * Connect again after the server ended the connection, once the session is known to be good. At once the first
   * time; when the server keeps ending it straight away, after 1, 2, 4… up to 30 s, so a server that can't read
   * sessions isn't asked again and again.
   */
  reconnect() {
    if (this.closed || this.socket.connected || this.cancelReconnect) return;
    const wait =
      this.serverEnds <= 1
        ? 0
        : Math.min(1000 * 2 ** (this.serverEnds - 2), 30_000);
    if (!wait) {
      this.socket.connect();
      return;
    }
    const later =
      this.options.later ??
      ((fn: () => void, ms: number) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      });
    this.cancelReconnect = later(() => {
      this.cancelReconnect = null;
      if (!this.closed && !this.socket.connected) this.socket.connect();
    }, wait);
  }

  /** Leaving the area: the socket closes. */
  close() {
    this.closed = true;
    this.cancelReconnect?.();
    this.cancelReconnect = null;
    this.listeners.clear();
    this.socket.disconnect();
  }
}

/**
 * A socket whose code loads on demand: socket.io-client loads only inside the area that uses it. Listeners wait for
 * it; until it has loaded it isn't connected, so sending fails at once. If the code can't load (offline before it was
 * ever cached), it reports a failed connection and tries again when the device is back online.
 */
export class DeferredSocket implements SocketLike {
  private real: SocketLike | null = null;
  private loading = false;
  private closed = false;
  private readonly listeners: Array<[string, (...args: never[]) => void]> = [];
  private readonly retry = () => this.start();

  constructor(private readonly load: () => Promise<SocketLike>) {
    this.start();
    if (typeof window !== 'undefined')
      window.addEventListener('online', this.retry);
  }

  private start() {
    if (this.real || this.loading || this.closed) return;
    this.loading = true;
    this.load().then(
      (socket) => {
        this.loading = false;
        if (this.closed) {
          socket.disconnect();
          return;
        }
        this.real = socket;
        for (const [event, listener] of this.listeners)
          socket.on(event, listener);
      },
      () => {
        this.loading = false;
        if (this.closed) return;
        for (const [event, listener] of this.listeners)
          if (event === 'connect_error') (listener as () => void)();
      },
    );
  }

  get connected() {
    return this.real?.connected ?? false;
  }

  on(event: string, listener: (...args: never[]) => void) {
    this.listeners.push([event, listener]);
    this.real?.on(event, listener);
    return this;
  }

  timeout(ms: number) {
    if (this.real) return this.real.timeout(ms);
    return {
      emit: (
        _event: string,
        _data: unknown,
        ack: (err: Error | null) => void,
      ) => ack(new Error('not connected')),
    };
  }

  connect() {
    this.real?.connect();
    return this;
  }

  disconnect() {
    this.closed = true;
    if (typeof window !== 'undefined')
      window.removeEventListener('online', this.retry);
    this.real?.disconnect();
    return this;
  }
}
