import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { JWT_ALG } from './jwt';
import { SESSION_COOKIE } from './session-cookie';

/**
 * A fixed-window counter in memory: the API runs as one instance, so no shared store is needed. Old windows are
 * swept as it goes, so memory stays bounded by the keys seen in the last window.
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const { limit, windowMs, now = Date.now } = options;
  const windows = new Map<string, { count: number; resetAt: number }>();
  let nextSweep = 0;
  return {
    /** Counts one request for `key`: whether it's within the limit, and the seconds until the window resets. */
    hit(key: string) {
      const t = now();
      if (t >= nextSweep) {
        for (const [k, w] of windows) if (w.resetAt <= t) windows.delete(k);
        nextSweep = t + windowMs;
      }
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
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

/**
 * The client's address. Behind Cloudflare or a proxy, the first forwarded address; else the connection's. A
 * client can forge the forwarded headers only to spread its own requests over more counters, never to use up
 * someone else's.
 */
export function clientAddress(c: Context) {
  const forwarded =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0] ??
    c.req.header('x-real-ip');
  if (forwarded?.trim()) return forwarded.trim();
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
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
