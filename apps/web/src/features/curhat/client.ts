/**
 * Curhat's connection and what you sent (P2-C; SPEC "Curhat Yuk!", "Connection and delivery"): one socket for the
 * whole area, opened by the Curhat layout and closed when you leave it. The API's protocol is P0-D's
 * (apps/api/src/websocket/curhat.ts): the handshake `auth: { curhat: true }` joins every room you own, `curhat:join`
 * adds a room started later, and `message` is acknowledged with `{ ok: true, message }` or `{ ok: false, error }`.
 *
 * Sending (story 96): a message shows at once as pending ("Mengirim"). It is delivered on `{ ok: true }`, and fails
 * on `{ ok: false }`, when no acknowledgement arrives within ACK_TIMEOUT_MS, when the connection drops before it
 * does, or when the connection is down at the moment you send. It is only ever emitted while connected, so socket.io
 * never buffers it to send later, maybe twice. Failed messages stay until Kirim ulang delivers them.
 *
 * Pure of React and of socket.io's module (the socket is passed in), so tests/curhat-client.test.ts drives it with a
 * fake socket.
 */
import type { ChatroomMessage } from '~/api/generated';
import {
  ACK_TIMEOUT_MS,
  ackOutcome,
  outboxReducer,
  type OutboxAction,
  type OutboxEntry,
} from './rules';

/** The part of socket.io-client's Socket this uses. */
export interface SocketLike {
  readonly connected: boolean;
  on(event: string, listener: (...args: never[]) => void): unknown;
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

export interface CurhatClientEvents {
  /** A message from the room arrived (Welfare's reply, or yours from another tab). */
  onReply?: (message: ChatroomMessage) => void;
  /** The connection is back after being down: catch up on what was missed. */
  onReconnect?: () => void;
  /** The server saved what you sent. */
  onDelivered?: (entry: OutboxEntry, message: ChatroomMessage) => void;
  /** What you sent failed. */
  onFailed?: (entry: OutboxEntry) => void;
}

export interface CurhatClientState {
  status: ConnectionStatus;
  outbox: OutboxEntry[];
}

export class CurhatClient {
  private state: CurhatClientState = { status: 'connecting', outbox: [] };
  private readonly listeners = new Set<() => void>();
  private wasDown = false;
  private seq = 0;
  private closed = false;
  /** The room on screen: its Welfare replies are read at once instead of counted. */
  openRoom: string | null = null;

  constructor(
    private readonly socket: SocketLike,
    private readonly events: CurhatClientEvents = {},
    private readonly options: {
      now?: () => Date;
      timeoutMs?: number;
    } = {},
  ) {
    socket.on('connect', () => {
      const back = this.wasDown;
      this.wasDown = false;
      this.set({ status: 'connected' });
      if (back) this.events.onReconnect?.();
    });
    const down = () => {
      if (this.closed) return;
      this.wasDown = true;
      this.set({ status: 'down' });
    };
    socket.on('disconnect', down);
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

  /** Send a message to a room; it shows at once and settles into delivered or failed. */
  send(chatroomId: string, text: string, replyId: string | null): OutboxEntry {
    const entry: OutboxEntry = {
      localId: `local-${++this.seq}`,
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

  /** Kirim ulang: the same text and reply again. */
  retry(localId: string) {
    const entry = this.state.outbox.find(
      (e) => e.localId === localId && e.status === 'failed',
    );
    if (!entry) return;
    const at = this.now();
    this.dispatch({ type: 'retry', localId, at });
    this.emit({ ...entry, status: 'pending', at });
  }

  /** A deleted room takes its unsent messages with it. */
  dropRoom(chatroomId: string) {
    this.dispatch({ type: 'dropRoom', chatroomId });
  }

  private emit(entry: OutboxEntry) {
    const fail = () => {
      if (!this.state.outbox.some((e) => e.localId === entry.localId)) return;
      this.dispatch({ type: 'failed', localId: entry.localId });
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
      },
      (err, answer) => {
        if (settled) return;
        settled = true;
        // `err`: no answer in time, or the connection dropped first.
        const outcome = err ? { ok: false as const } : ackOutcome(answer);
        if (!outcome.ok) return fail();
        if (!this.state.outbox.some((e) => e.localId === entry.localId)) return;
        this.events.onDelivered?.(entry, outcome.message);
        this.dispatch({ type: 'delivered', localId: entry.localId });
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

  /** Leaving the area: the socket closes. */
  close() {
    this.closed = true;
    this.listeners.clear();
    this.socket.disconnect();
  }
}

/**
 * A socket whose code loads on demand (P0-B: socket.io-client loads only inside the area that uses it). Listeners
 * wait for it; until it has loaded it isn't connected, so sending fails at once. If the code can't load (offline
 * before it was ever cached), it reports a failed connection and tries again when the device is back online.
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

  disconnect() {
    this.closed = true;
    if (typeof window !== 'undefined')
      window.removeEventListener('online', this.retry);
    this.real?.disconnect();
    return this;
  }
}
