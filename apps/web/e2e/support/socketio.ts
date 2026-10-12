/**
 * A fake socket.io server, enough for Curhat Yuk! and Live Counting to connect, send and receive.
 *
 * It speaks Engine.IO v4 over HTTP long-polling only (the handshake offers no WebSocket upgrade), and the
 * socket.io v5 packets the app uses: CONNECT with `auth`, and EVENT both ways. Each `io()` call in the app opens
 * one session. A test can:
 * - read what the app emitted: `api.socket.emitted('message')`;
 * - push an event to the app: `api.socket.emit('reply', payload, (s) => s.auth.chatroomId === 'r1')`;
 * - drop every connection: `api.socket.drop()`, after which new connections fail until `api.socket.restore()`.
 */
import type { Route } from '@playwright/test';

const SEP = '\x1e';
const POLL_HOLD_MS = 15_000;

export interface FakeSocket {
  sid: string;
  auth: Record<string, unknown>;
  connected: boolean;
  queue: string[];
  waiting: ((packets: string[]) => void) | null;
}
export interface Emitted {
  event: string;
  data: unknown;
  auth: Record<string, unknown>;
}

export class FakeSocketServer {
  readonly sessions = new Map<string, FakeSocket>();
  readonly received: Emitted[] = [];
  private seq = 0;
  private down = false;
  private closed = false;

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
      this.push(
        session,
        `40${JSON.stringify({ sid: `e2e-socket-${++this.seq}` })}`,
      );
    } else if (type === '1') {
      session.connected = false;
    } else if (type === '2') {
      const json = rest.slice(rest.indexOf('['));
      const [event, data] = JSON.parse(json) as [string, unknown];
      if (!this.closed) this.received.push({ event, data, auth: session.auth });
    }
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
