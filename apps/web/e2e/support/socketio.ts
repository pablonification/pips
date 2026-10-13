/**
 * A fake socket.io server, enough for Curhat Yuk! and Live Counting to connect, send and receive.
 *
 * It speaks Engine.IO v4 over HTTP long-polling only (the handshake offers no WebSocket upgrade), and the
 * socket.io v5 packets the app uses: CONNECT with `auth`, and EVENT both ways. Each `io()` call in the app opens
 * one session. A test can:
 * - read what the app emitted: `api.socket.emitted('message')`;
 * - push an event to the app: `api.socket.emit('reply', payload, (s) => s.auth.chatroomId === 'r1')`;
 * - drop every connection: `api.socket.drop()`, after which new connections fail until `api.socket.restore()`;
 * - change how an acknowledgement is answered: `api.socket.answer('message', () => ({ ok: false, error: 'server' }))`,
 *   or never answered (`() => undefined`), for the delivery states;
 * - answer one held-back acknowledgement later: `api.socket.ack(api.socket.emitted('message')[0], payload)` (P2-C).
 *
 * Acknowledgements default to what the API answers (`apps/api/src/websocket/curhat.ts`), on the test's data:
 * `message` is refused without a session (`unauthorized`), outside your rooms (`forbidden`), with empty text or a
 * reply to a message outside the room (`invalid`); otherwise the message is saved in `db.chatrooms` and
 * acknowledged as `{ ok: true, message }` (`isSender: true`, no `userId`). `curhat:join` checks the same access.
 * A handshake with `auth.curhat` joins every room in `db.chatrooms`; one with `auth.chatroomId` joins that room if
 * it's yours. As the API does, a `message` without an acknowledgement is still saved.
 */
import type { Route } from '@playwright/test';
import type {
  CurhatJoinAck,
  CurhatMessageAck,
  CurhatSocketMessage,
} from '../../src/api/generated';
import { NOW, type Db } from '../fixtures/api';

const SEP = '\x1e';
const POLL_HOLD_MS = 15_000;

export interface FakeSocket {
  sid: string;
  auth: Record<string, unknown>;
  connected: boolean;
  queue: string[];
  waiting: ((packets: string[]) => void) | null;
  /** Rooms this connection is in (see the header for how they're joined). */
  rooms: Set<string>;
}
export interface Emitted {
  event: string;
  data: unknown;
  auth: Record<string, unknown>;
  /** Set when the app asked for an acknowledgement. */
  ackId?: number;
  /** The connection that sent it (P2-C: `ack()` answers it there). */
  sid?: string;
}
/** Answers an acknowledgement; `undefined` means never answer. */
export type AckAnswer = (data: unknown, socket: FakeSocket) => unknown;

export class FakeSocketServer {
  readonly sessions = new Map<string, FakeSocket>();
  readonly received: Emitted[] = [];
  private seq = 0;
  private saved = 0;
  private down = false;
  private closed = false;
  private readonly answers = new Map<string, AckAnswer>();

  constructor(private readonly db?: Db) {
    this.answers.set('message', (data, s) => this.saveMessage(data, s));
    this.answers.set('curhat:join', (data, s) => this.join(data, s));
  }

  /** Answer `event`'s acknowledgements with `fn` from now on (return `undefined` to never answer). */
  answer(event: string, fn: AckAnswer): void {
    this.answers.set(event, fn);
  }

  /**
   * Answer one acknowledgement by hand (P2-C): `entry` is what `emitted()` recorded, `payload` the answer, sent as
   * `43<id>[payload]` to the connection that asked. Use it after `answer(event, () => undefined)` held the answer
   * back, for a late or lost acknowledgement. Returns whether that connection was still there to receive it.
   */
  ack(entry: Emitted, payload: unknown): boolean {
    if (entry.ackId === undefined)
      throw new Error(
        `socket.ack: "${entry.event}" asked for no acknowledgement`,
      );
    const s = entry.sid ? this.sessions.get(entry.sid) : undefined;
    if (!s?.connected) return false;
    this.push(s, `43${entry.ackId}${JSON.stringify([payload])}`);
    return true;
  }

  /** Events the app emitted, optionally only one name. */
  emitted(event?: string): Emitted[] {
    return this.received.filter((e) => !event || e.event === event);
  }

  /** Send an event to every connected socket (or those `to` selects). Returns how many received it. */
  emit(
    event: string,
    data: unknown,
    to: (s: FakeSocket) => boolean = () => true,
  ): number {
    let n = 0;
    for (const s of this.sessions.values()) {
      if (!s.connected || !to(s)) continue;
      this.push(s, `42${JSON.stringify([event, data])}`);
      n++;
    }
    return n;
  }

  /** Drop the connection: pending polls fail and reconnects are refused until `restore()`. */
  drop(): void {
    this.down = true;
    for (const s of this.sessions.values()) this.flush(s, null);
    this.sessions.clear();
  }

  restore(): void {
    this.down = false;
  }

  close(): void {
    this.closed = true;
    for (const s of this.sessions.values()) this.flush(s, ['1']);
  }

  async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    if (url.searchParams.get('transport') !== 'polling')
      return route.abort('blockedbyclient');
    if (this.down || this.closed) return route.abort('connectionrefused');
    const sid = url.searchParams.get('sid');
    if (!sid) return this.handshake(route);
    const session = this.sessions.get(sid);
    if (!session)
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"code":1,"message":"Session ID unknown"}',
      });
    if (request.method() === 'POST') {
      this.receive(session, request.postData() ?? '');
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: 'ok',
      });
    }
    const packets = await this.poll(session);
    if (packets === null) return route.abort('connectionreset');
    return route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=UTF-8',
      body: packets.join(SEP),
    });
  }

  private handshake(route: Route) {
    const sid = `e2e-engine-${++this.seq}`;
    this.sessions.set(sid, {
      sid,
      auth: {},
      connected: false,
      queue: [],
      waiting: null,
      rooms: new Set(),
    });
    const open = {
      sid,
      upgrades: [],
      pingInterval: 25_000,
      pingTimeout: 20_000,
      maxPayload: 1_000_000,
    };
    return route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=UTF-8',
      body: `0${JSON.stringify(open)}`,
    });
  }

  private receive(session: FakeSocket, payload: string) {
    for (const packet of payload.split(SEP)) {
      const type = packet[0];
      if (type === '1') {
        session.connected = false;
        this.sessions.delete(session.sid);
        this.flush(session, ['6']);
      } else if (type === '4') this.receiveSocketIo(session, packet.slice(1));
      // '3' (pong) needs no answer.
    }
  }

  private receiveSocketIo(session: FakeSocket, packet: string) {
    const type = packet[0];
    const rest = packet.slice(1);
    if (type === '0') {
      session.auth = rest ? (JSON.parse(rest) as Record<string, unknown>) : {};
      session.connected = true;
      this.joinOnConnect(session);
      this.push(
        session,
        `40${JSON.stringify({ sid: `e2e-socket-${++this.seq}` })}`,
      );
    } else if (type === '1') {
      session.connected = false;
    } else if (type === '2') {
      const start = rest.indexOf('[');
      const ackId = start > 0 ? Number(rest.slice(0, start)) : undefined;
      const [event, data] = JSON.parse(rest.slice(start)) as [string, unknown];
      if (this.closed) return;
      this.received.push({
        event,
        data,
        auth: session.auth,
        ackId,
        sid: session.sid,
      });
      const answer = this.answers.get(event)?.(data, session);
      if (ackId !== undefined && answer !== undefined)
        this.push(session, `43${ackId}${JSON.stringify([answer])}`);
    }
  }

  private myRooms(): string[] {
    return this.db?.signedIn ? Object.keys(this.db.chatrooms) : [];
  }

  private joinOnConnect(session: FakeSocket) {
    const mine = this.myRooms();
    if (session.auth.curhat === true) mine.forEach((r) => session.rooms.add(r));
    const room = session.auth.chatroomId;
    if (typeof room === 'string' && mine.includes(room))
      session.rooms.add(room);
  }

  private join(data: unknown, session: FakeSocket): CurhatJoinAck {
    if (!this.db?.signedIn) return { ok: false, error: 'unauthorized' };
    const id = (data as { chatroomId?: unknown } | null)?.chatroomId;
    if (typeof id !== 'string' || !id) return { ok: false, error: 'invalid' };
    if (!this.myRooms().includes(id)) return { ok: false, error: 'forbidden' };
    session.rooms.add(id);
    return { ok: true };
  }

  private saveMessage(data: unknown, session: FakeSocket): CurhatMessageAck {
    if (!this.db?.signedIn) return { ok: false, error: 'unauthorized' };
    const { chatroomId, message, replyId } = (data ?? {}) as {
      chatroomId?: unknown;
      message?: unknown;
      replyId?: unknown;
    };
    if (typeof chatroomId !== 'string' || typeof message !== 'string')
      return { ok: false, error: 'invalid' };
    if (!message.trim()) return { ok: false, error: 'invalid' };
    const room = this.db.chatrooms[chatroomId];
    if (!room) return { ok: false, error: 'forbidden' };
    const quoted =
      typeof replyId === 'string' && replyId
        ? room.messages?.find((m) => m.id === replyId)
        : undefined;
    if (typeof replyId === 'string' && replyId && !quoted)
      return { ok: false, error: 'invalid' };
    const saved: CurhatSocketMessage = {
      id: `e2e-message-${++this.saved}`,
      chatroomId,
      replyId: quoted?.id ?? null,
      content: message,
      createdAt: NOW,
      isSender: true,
      ...(quoted
        ? {
            reply: {
              id: quoted.id,
              chatroomId,
              replyId: quoted.replyId,
              content: quoted.content,
              createdAt: quoted.createdAt,
            },
          }
        : {}),
    };
    room.messages = [saved, ...(room.messages ?? [])];
    session.rooms.add(chatroomId);
    return { ok: true, message: saved };
  }

  private push(session: FakeSocket, packet: string) {
    session.queue.push(packet);
    if (session.waiting) this.flush(session, []);
  }

  private flush(session: FakeSocket, extra: string[] | null) {
    const waiting = session.waiting;
    if (!waiting) return;
    session.waiting = null;
    if (extra === null) return waiting(null as unknown as string[]);
    const packets = [...session.queue.splice(0), ...extra];
    waiting(packets);
  }

  private poll(session: FakeSocket): Promise<string[] | null> {
    if (session.queue.length) return Promise.resolve(session.queue.splice(0));
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (session.waiting === done) {
          session.waiting = null;
          resolve(['2']); // ping; the client answers with a pong
        }
      }, POLL_HOLD_MS);
      const done = (packets: string[] | null) => {
        clearTimeout(timer);
        resolve(packets);
      };
      session.waiting = done;
    });
  }
}
