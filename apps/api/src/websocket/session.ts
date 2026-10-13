import { verify } from 'hono/jwt';
import { JWT_ALG } from '~/lib/jwt';

/**
 * The signed-in member behind a socket, read from the handshake's session cookie. `roles` are the roles at the
 * handshake; access checks read them again. `expiresAt` is the token's expiry (ms), when the socket is cut off.
 */
export interface SocketSession {
  userId: string;
  roles: string[];
  expiresAt: number | null;
}

/** Whether the session's token has run out. */
export function sessionExpired(
  s: Pick<SocketSession, 'expiresAt'>,
  now: number = Date.now(),
): boolean {
  return s.expiresAt !== null && now >= s.expiresAt;
}

export function extractTokenFromCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  const prefix = 'hmif-app.access-cookie=';
  const raw = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(prefix));
  if (!raw) return undefined;
  return decodeURIComponent(raw.slice(prefix.length));
}

/**
 * The session cookie rides along on the handshake (clients connect with `withCredentials`; it is httpOnly, so
 * they can't send it themselves). No cookie, a bad signature or an expired token: no session.
 */
export async function readSocketSession(
  cookieHeader: string | undefined,
  jwtSecret: string,
  getUserRoles: (userId: string) => Promise<string[]>,
): Promise<SocketSession | null> {
  const token = extractTokenFromCookie(cookieHeader);
  if (!token) return null;
  try {
    const payload = await verify(token, jwtSecret, JWT_ALG);
    const userId = payload.id;
    if (typeof userId !== 'string' || !userId) return null;
    const expiresAt =
      typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    return { userId, roles: await getUserRoles(userId), expiresAt };
  } catch {
    return null;
  }
}
