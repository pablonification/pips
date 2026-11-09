/**
 * Whether a browser request comes from the app itself: an origin in `ALLOWED_ORIGINS`, or the address the request
 * was sent to (the web app and the API on one origin, as staging and local development are through Vite's proxy).
 * Browsers always send `Origin` on cross-site requests, WebSocket handshakes and every POST, so a request with
 * neither `Origin` nor `Referer` isn't another website's page acting with the member's cookie; it's allowed.
 */
export function isAllowedOrigin(
  headers: {
    origin?: string | null;
    referer?: string | null;
    host?: string | null;
    forwardedHost?: string | null;
  },
  allowedOrigins: readonly string[],
) {
  const claimed = headers.origin ?? originOf(headers.referer);
  if (claimed === undefined) return true;
  // "null": a sandboxed frame, a file, or a redirect across sites. Never the app.
  let source: URL;
  try {
    source = new URL(claimed);
  } catch {
    return false;
  }
  if (source.protocol !== 'https:' && source.protocol !== 'http:') return false;
  if (allowedOrigins.some((allowed) => originOf(allowed) === source.origin)) {
    return true;
  }
  const targets = [headers.host, ...(headers.forwardedHost ?? '').split(',')]
    .map((h) => h?.trim().toLowerCase())
    .filter(Boolean);
  return targets.includes(source.host.toLowerCase());
}

function originOf(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return 'null';
  }
}

/** Methods that change nothing: never checked. */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
