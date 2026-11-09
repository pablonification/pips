import { getConnInfo } from '@hono/node-server/conninfo';
import { isIP } from 'node:net';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { JWT_ALG } from './jwt';
import { SESSION_COOKIE } from './session-cookie';

/**
 * A fixed-window counter in memory: the API runs as one instance, so no shared store is needed. Old windows are
 * swept as it goes, and at most `maxKeys` counters are kept (the oldest window goes first), so a flood of new
 * addresses can't grow it without end.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}) {
  const { limit, windowMs, maxKeys = 10_000, now = Date.now } = options;
  // In the order each window opened, so the first entry is the oldest.
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;
  const sweep = (t: number) => {
    for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
    nextSweep = t + windowMs;
  };
  return {
    /** Counts one request for `key`: whether it's within the limit, and the seconds until the window resets. */
    hit(key: string) {
      const t = now();
      if (t >= nextSweep) sweep(t);
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        windows.delete(key);
        if (windows.size >= maxKeys) sweep(t);
        while (windows.size >= maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest === undefined) break;
          windows.delete(oldest);
        }
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      return {
        ok: w.count <= limit,
        retryAfter: Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
      };
    },
    size: () => windows.size,
  };
}

/** Where the client's address is read from (`CLIENT_IP_HEADER`). */
export const CLIENT_IP_SOURCES = [
  'x-forwarded-for',
  'cf-connecting-ip',
  'none',
] as const;
export type ClientIpSource = (typeof CLIENT_IP_SOURCES)[number];

/**
 * The client's address, from the one source the deployment trusts:
 * - `x-forwarded-for` (default): the right-most entry, the one the nearest proxy appended. Entries to its left come
 *   from the client or proxies further out, and anyone can write them.
 * - `cf-connecting-ip`: Cloudflare's header, only when the API can be reached through Cloudflare alone.
 * - `none`: the connection's own address, when nothing sits in front.
 * The header missing or not an address: the connection's address.
 */
export function pickClientAddress(
  header: (name: string) => string | undefined,
  source: ClientIpSource,
  connection: () => string | undefined,
) {
  let candidate: string | undefined;
  if (source === 'x-forwarded-for')
    candidate = header('x-forwarded-for')
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1);
  else if (source === 'cf-connecting-ip')
    candidate = header('cf-connecting-ip')?.trim();
  if (candidate && isIP(candidate)) return candidate;
  return connection() ?? 'unknown';
}

/** The client's address for a request (pickClientAddress), from the source `CLIENT_IP_HEADER` names. */
export function clientAddress(c: Context, source: ClientIpSource) {
  return pickClientAddress(
    (name) => c.req.header(name),
    source,
    () => {
      try {
        return getConnInfo(c).remote.address;
      } catch {
        return undefined;
      }
    },
  );
}

/** The signed-in member's id from a valid session cookie, or undefined. Never trusted unverified. */
export async function sessionUserId(c: Context, secret: string) {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return undefined;
  try {
    const payload = await verify(token, secret, JWT_ALG);
    return typeof payload.id === 'string' ? payload.id : undefined;
  } catch {
    return undefined;
  }
}

/** Answers 429 with `Retry-After` once `key`'s requests pass the limit; a request with no key isn't counted. */
export function rateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  key: (c: Context) => Promise<string | undefined> | string | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    const k = await key(c);
    if (k !== undefined) {
      const { ok, retryAfter } = limiter.hit(k);
      if (!ok) {
        c.header('Retry-After', String(retryAfter));
        return c.json({ error: 'Too many requests' }, 429);
      }
    }
    await next();
  };
}
