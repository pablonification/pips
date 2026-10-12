import { sessionCookie, type TestUser } from './session';

/** Sends a request through a router (no server, no database), signed in as `user` unless it's null. */
export async function callRouter(
  router: {
    request: (path: string, init?: RequestInit) => Response | Promise<Response>;
  },
  user: TestUser | null,
  method: string,
  path: string,
  body?: unknown,
) {
  const headers: Record<string, string> = {};
  if (user) headers.Cookie = await sessionCookie(user);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await router.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}
