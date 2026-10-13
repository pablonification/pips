/**
 * The API mock layer and its guard.
 *
 * Every request the page makes goes through `ApiMock.dispatch`:
 * - `/api/**` is answered by a handler: a test's own override first, then the read-only defaults (handlers.ts).
 *   A request with no handler is aborted and fails the test. A write (POST, PUT, PATCH, DELETE) is only ever
 *   answered by a handler the test registered itself with `api.on(...)`; otherwise it is aborted and fails the test.
 * - `/socket.io/` is answered by the fake socket.io server (socketio.ts).
 * - `/__e2e__/` serves generated avatars, posters and photos (media.ts).
 * - Other same-origin requests (the built app's files) go to the `vite preview` server.
 * - Requests to any other origin (Google, Sentry, analytics, web fonts) are blocked and recorded, never sent.
 */
import type { BrowserContext, Request, Route } from '@playwright/test';
import type { Db } from '../fixtures/api';
import { defaultHandlers } from './handlers';
import { serveMedia } from './media';
import { FakeSocketServer } from './socketio';

const BRAND = Symbol('mock-reply');
export type MockReply =
  | {
      [BRAND]: true;
      kind: 'json';
      status: number;
      body: unknown;
      delayMs: number;
      headers?: Record<string, string>;
    }
  | {
      [BRAND]: true;
      kind: 'text';
      status: number;
      body: string;
      delayMs: number;
      contentType: string;
    }
  | { [BRAND]: true; kind: 'abort'; error: string; delayMs: number }
  | { [BRAND]: true; kind: 'hang' };

/** Build replies for handlers. A handler may also return plain data, which becomes a 200 JSON response. */
export const reply = {
  json: (body: unknown, status = 200): MockReply => ({
    [BRAND]: true,
    kind: 'json',
    status,
    body,
    delayMs: 0,
  }),
  status: (
    status: number,
    body: unknown = { message: `e2e: HTTP ${status}` },
  ): MockReply => ({ [BRAND]: true, kind: 'json', status, body, delayMs: 0 }),
  text: (
    body: string,
    status = 200,
    contentType = 'text/plain',
  ): MockReply => ({
    [BRAND]: true,
    kind: 'text',
    status,
    body,
    delayMs: 0,
    contentType,
  }),
  /** Fail at the network level, like a dropped connection (`failed`) or no network (`internetdisconnected`). */
  abort: (
    error:
      | 'failed'
      | 'internetdisconnected'
      | 'timedout'
      | 'connectionreset' = 'failed',
  ): MockReply => ({ [BRAND]: true, kind: 'abort', error, delayMs: 0 }),
  /** Never answer: the request stays pending, which shows loading states. */
  hang: (): MockReply => ({ [BRAND]: true, kind: 'hang' }),
  /** Answer after a delay, for slow responses. */
  delay: (delayMs: number, inner: MockReply | unknown): MockReply => {
    const r = isReply(inner) ? inner : reply.json(inner);
    return r.kind === 'hang' ? r : { ...r, delayMs };
  },
};
const isReply = (x: unknown): x is MockReply =>
  typeof x === 'object' && x !== null && BRAND in x;

export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Parsed JSON body, the raw text for other bodies, or undefined. */
  body: unknown;
  db: Db;
  request: Request;
}
export type Handler = (req: MockRequest) => unknown | Promise<unknown>;

interface Registered {
  method: string;
  pattern: RegExp;
  keys: string[];
  source: string;
  handler: Handler;
  explicit: boolean;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: string;
  body: unknown;
  /** `explicit`: a test's handler; `default`: a read-only default; `unhandled` and `blocked`: aborted. */
  outcome:
    | 'explicit'
    | 'default'
    | 'unhandled'
    | 'unmocked-write'
    | 'blocked'
    | 'socket'
    | 'media'
    | 'app'
    | 'offline';
  status?: number;
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function compile(spec: string): {
  method: string;
  pattern: RegExp;
  keys: string[];
} {
  const m = /^(GET|POST|PUT|PATCH|DELETE|\*) (\/\S*)$/.exec(spec.trim());
  if (!m)
    throw new Error(
      `api.on: write the route as "METHOD /path/:param", got "${spec}"`,
    );
  const keys: string[] = [];
  const source = m[2]
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, k: string) => {
      keys.push(k);
      return '([^/]+)';
    });
  return { method: m[1], pattern: new RegExp(`^${source}/?$`), keys };
}

export class ApiMock {
  readonly requests: RecordedRequest[] = [];
  readonly problems: string[] = [];
  readonly socket: FakeSocketServer;
  private handlers: Registered[] = [];
  private closed = false;
  private offline = false;
  private context: BrowserContext | null = null;
  private readonly origin: string;

  constructor(
    readonly db: Db,
    baseURL: string,
  ) {
    this.origin = new URL(baseURL).origin;
    this.socket = new FakeSocketServer(db);
    for (const [spec, handler] of Object.entries(defaultHandlers))
      this.register(spec, handler, false);
  }

  /**
   * Answer `METHOD /path/:param` with `handler` for the rest of this test. Overrides any earlier handler for the
   * same request, including the defaults. This is the only way a write gets an answer.
   */
  on(spec: string, handler: Handler | MockReply | object): this {
    const fn: Handler =
      typeof handler === 'function' ? (handler as Handler) : () => handler;
    this.register(spec, fn, true);
    return this;
  }

  /** Every request with this method and path that reached a handler, oldest first. */
  calls(spec: string): RecordedRequest[] {
    const { method, pattern } = compile(spec);
    return this.requests.filter(
      (r) =>
        (method === '*' || r.method === method) &&
        pattern.test(r.path) &&
        (r.outcome === 'explicit' || r.outcome === 'default'),
    );
  }

  /** Every write the page sent, answered or not. */
  get writes(): RecordedRequest[] {
    return this.requests.filter(
      (r) => WRITE_METHODS.has(r.method) && r.path.startsWith('/api/'),
    );
  }

  /** Third-party requests that were blocked. */
  get blocked(): RecordedRequest[] {
    return this.requests.filter((r) => r.outcome === 'blocked');
  }

  async install(context: BrowserContext): Promise<void> {
    this.context = context;
    await context.route('**/*', (route) =>
      this.dispatch(route).catch((e: unknown) => this.routeError(e)),
    );
    // socket.io is faked over HTTP long-polling (it never offers the upgrade); any WebSocket at all is unexpected.
    await context.routeWebSocket(/.*/, (ws) => {
      this.problem(
        `WebSocket ${new URL(ws.url()).pathname}: no WebSocket is mocked`,
      );
      ws.close({ code: 1008, reason: 'e2e: WebSockets are not mocked' }).catch(
        () => undefined,
      );
    });
  }

  /**
   * Take the browser offline (or back online): `navigator.onLine` turns false and every request fails as with no
   * network. Routed requests would otherwise still be answered, so the mock refuses them too.
   */
  async setOffline(offline: boolean): Promise<void> {
    this.offline = offline;
    if (offline) this.socket.drop();
    else this.socket.restore();
    await this.context?.setOffline(offline);
  }

  /** Stop recording (called before the guard's check, so requests during teardown don't count). */
  close(): void {
    this.closed = true;
    this.socket.close();
  }

  private register(spec: string, handler: Handler, explicit: boolean) {
    const { method, pattern, keys } = compile(spec);
    if (!explicit && method !== 'GET')
      throw new Error(`default handlers are read-only: ${spec}`);
    this.handlers.unshift({
      method,
      pattern,
      keys,
      source: spec,
      handler,
      explicit,
    });
  }

  private problem(message: string) {
    if (!this.closed) this.problems.push(message);
  }

  private routeError(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    // The page closed while a request was pending: not a test failure.
    if (/closed|Target page|has been closed|already handled/i.test(message))
      return;
    this.problem(`mock layer error: ${message}`);
  }

  private record(r: RecordedRequest) {
    if (!this.closed) this.requests.push(r);
  }

  private async dispatch(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (this.offline) {
      this.record({
        method,
        path: url.pathname,
        query: url.search,
        body: undefined,
        outcome: 'offline',
      });
      return route.abort('internetdisconnected');
    }
    if (url.origin !== this.origin) {
      this.record({
        method,
        path: `${url.origin}${url.pathname}`,
        query: url.search,
        body: undefined,
        outcome: 'blocked',
      });
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/socket.io/')) {
      this.record({
        method,
        path: url.pathname,
        query: url.search,
        body: request.postData() ?? undefined,
        outcome: 'socket',
      });
      return this.socket.handle(route);
    }
    if (url.pathname.startsWith('/__e2e__/')) {
      this.record({
        method,
        path: url.pathname,
        query: url.search,
        body: undefined,
        outcome: 'media',
      });
      return serveMedia(route, url.pathname);
    }
    if (!url.pathname.startsWith('/api/')) {
      if (method !== 'GET' && method !== 'HEAD') {
        this.record({
          method,
          path: url.pathname,
          query: url.search,
          body: undefined,
          outcome: 'unmocked-write',
        });
        this.problem(
          `${method} ${url.pathname}: a write to the app server with no handler`,
        );
        return route.abort('blockedbyclient');
      }
      this.record({
        method,
        path: url.pathname,
        query: url.search,
        body: undefined,
        outcome: 'app',
      });
      return route.fallback();
    }
    return this.answerApi(route, request, method, url);
  }

  private async answerApi(
    route: Route,
    request: Request,
    method: string,
    url: URL,
  ): Promise<void> {
    const body = parseBody(request);
    const write = WRITE_METHODS.has(method);
    for (const h of this.handlers) {
      if (h.method !== '*' && h.method !== method) continue;
      const m = h.pattern.exec(url.pathname);
      if (!m) continue;
      if (write && !h.explicit) break;
      const params = Object.fromEntries(
        h.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]),
      );
      const record: RecordedRequest = {
        method,
        path: url.pathname,
        query: url.search,
        body,
        outcome: h.explicit ? 'explicit' : 'default',
      };
      this.record(record);
      const result = await h.handler({
        method,
        path: url.pathname,
        params,
        query: url.searchParams,
        body,
        db: this.db,
        request,
      });
      const r = isReply(result) ? result : reply.json(result ?? null);
      return this.fulfil(route, r, record);
    }
    const outcome = write ? 'unmocked-write' : 'unhandled';
    this.record({
      method,
      path: url.pathname,
      query: url.search,
      body,
      outcome,
    });
    this.problem(
      write
        ? `${method} ${url.pathname}: a write with no handler of the test's own (register one with api.on('${method} ${url.pathname}', ...))`
        : `${method} ${url.pathname}${url.search}: no handler`,
    );
    return route.abort('blockedbyclient');
  }

  private async fulfil(
    route: Route,
    r: MockReply,
    record: RecordedRequest,
  ): Promise<void> {
    if (r.kind === 'hang') return; // never answered; the page sees a pending request
    if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
    if (r.kind === 'abort') return route.abort(r.error);
    record.status = r.status;
    if (r.kind === 'text')
      return route.fulfill({
        status: r.status,
        contentType: r.contentType,
        body: r.body,
      });
    return route.fulfill({
      status: r.status,
      contentType: 'application/json',
      body: JSON.stringify(r.body),
      headers: r.headers,
    });
  }
}

function parseBody(request: Request): unknown {
  const text = request.postData();
  if (text == null) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
