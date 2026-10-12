import { verify } from 'hono/jwt';
import { JWT_ALG } from '~/lib/jwt';

/** The signed-in member behind a socket, read once from the handshake's session cookie. */
export interface SocketSession {
  userId: string;
  roles: string[];
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
    return { userId, roles: await getUserRoles(userId) };
  } catch {
    return null;
  }
}
