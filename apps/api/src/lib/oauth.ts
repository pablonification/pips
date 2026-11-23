import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The rules of PIPS!'s OAuth 2.1 server for MCP apps (docs/adr/0021-*), with no database and no HTTP, so each has a
 * unit test. The routes are in `controllers/oauth.controller.ts`.
 */

/** Reading only, and changing things as the member. A tool that changes something needs `pips.write`. */
export const SCOPES = ['pips.read', 'pips.write'] as const;
export type Scope = (typeof SCOPES)[number];
export const READ_SCOPE: Scope = 'pips.read';
export const WRITE_SCOPE: Scope = 'pips.write';

/** How long each thing lasts, in seconds. */
export const LIFETIMES = {
  /** From the app's redirect to the consent page until the member decides. */
  request: 10 * 60,
  /** From approval until the app exchanges the code. */
  code: 2 * 60,
  access: 60 * 60,
  refresh: 30 * 24 * 3600,
  /** The session minted for one MCP request (`mcp/session.ts`). */
  mcpSession: 5 * 60,
};

export const MAX_CLIENT_NAME = 80;
export const MAX_REDIRECT_URIS = 10;
export const MAX_REDIRECT_URI_LENGTH = 2000;
export const MAX_STATE_LENGTH = 1000;

/** A random value an attacker can't guess: 32 bytes, URL-safe. */
export function newSecret(prefix = '') {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

/** The value kept in the database for a secret (request id, code, token): its SHA-256. The secrets are random, so no salt is needed. */
export function hashSecret(secret: string) {
  return createHash('sha256').update(secret).digest('base64url');
}

/** PKCE S256 (RFC 7636): BASE64URL(SHA256(verifier)) equals the challenge. */
export function verifyPkce(verifier: string, challenge: string) {
  // RFC 7636 4.1: 43 to 128 characters from the unreserved set.
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(
    createHash('sha256').update(verifier).digest('base64url'),
  );
  const expected = Buffer.from(challenge);
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
}

/** A challenge as S256 makes it: 43 base64url characters. */
export function isS256Challenge(challenge: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * A redirect URI an app may register: `https:`, or `http:` on this machine's loopback address for desktop apps
 * (RFC 8252 7.3). Never a fragment, credentials, or a scheme a browser would run (`javascript:`, `data:`).
 */
export function isAllowedRedirectUri(uri: string) {
  if (uri.length > MAX_REDIRECT_URI_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.hash || uri.includes('#')) return false;
  if (url.username || url.password) return false;
  if (url.protocol === 'https:') return url.hostname !== '';
  if (url.protocol === 'http:') return LOOPBACK_HOSTS.has(url.hostname);
  return false;
}

/**
 * Whether `requested` is one of the client's registered redirect URIs. Exact match, except that a loopback URI may
 * use any port (RFC 8252 7.3: a desktop app picks a free port each time).
 */
export function matchesRegisteredRedirect(
  requested: string,
  registered: readonly string[],
) {
  if (registered.includes(requested)) return true;
  let req: URL;
  try {
    req = new URL(requested);
  } catch {
    return false;
  }
  if (req.protocol !== 'http:' || !LOOPBACK_HOSTS.has(req.hostname))
    return false;
  return registered.some((r) => {
    try {
      const reg = new URL(r);
      return (
        reg.protocol === 'http:' &&
        reg.hostname === req.hostname &&
        reg.pathname === req.pathname &&
        reg.search === req.search
      );
    } catch {
      return false;
    }
  });
}

/**
 * The name an app gave itself, made safe to show as plain text: control and formatting characters removed, spaces
 * collapsed, trimmed and cut to `MAX_CLIENT_NAME`. Empty when nothing is left.
 */
export function cleanClientName(name: unknown) {
  if (typeof name !== 'string') return '';
  const cleaned = name
    // Control characters, and the bidirectional and zero-width marks that can make a name read as another.
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_CLIENT_NAME).join('').trim();
}

/**
 * The scopes asked for, as a sorted list with no repeats. No scope asked: read only. Undefined when one is unknown
 * (`invalid_scope`). `pips.write` always brings `pips.read`.
 */
export function parseScope(scope: string | undefined | null) {
  const asked = (scope ?? '').split(' ').filter(Boolean);
  if (asked.length === 0) return [READ_SCOPE];
  if (!asked.every((s) => (SCOPES as readonly string[]).includes(s)))
    return undefined;
  const set = new Set(asked as Scope[]);
  set.add(READ_SCOPE);
  return SCOPES.filter((s) => set.has(s));
}

/**
 * The scopes the member chose on the consent page, held to what the app asked for: `chosen` may only narrow `asked`
 * (a space-separated list as stored), and `pips.read` is always kept. Nothing chosen: what the app asked for.
 * Undefined when the choice names a scope the app didn't ask for, or one that doesn't exist.
 */
export function narrowScope(
  asked: string,
  chosen: readonly string[] | undefined,
) {
  const had = asked.split(' ').filter(Boolean);
  if (chosen === undefined) return had.join(' ');
  if (!chosen.every((s) => had.includes(s))) return undefined;
  const set = new Set([...chosen, READ_SCOPE]);
  return SCOPES.filter((s) => set.has(s)).join(' ');
}

export function scopeIncludes(scope: string, wanted: Scope) {
  return scope.split(' ').includes(wanted);
}

/** `resource` (RFC 8707): if an app names one, it must be this server's MCP endpoint. Trailing slashes are ignored. */
export function isOurResource(resource: string | undefined, ours: string) {
  if (resource === undefined) return true;
  return resource.replace(/\/+$/, '') === ours.replace(/\/+$/, '');
}

/** The app's redirect URI with `params` added to its query, keeping what it already had. */
export function redirectWith(
  redirectUri: string,
  params: Record<string, string | null | undefined>,
) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  return url.toString();
}

/**
 * The one web host an app's sign-ins can return to, or null. Only when every registered redirect URI is `https:` on
 * that host: a code goes only to a registered URI, so the app is that site. An app that also lists another host or a
 * loopback address could have used either, so it gets null, never the first one listed.
 */
export function returnHost(redirectUris: readonly string[]) {
  let host: string | null = null;
  for (const uri of redirectUris) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || !url.hostname) return null;
    const h = url.hostname.toLowerCase();
    if (host !== null && h !== host) return null;
    host = h;
  }
  return host;
}

/** The host a redirect goes back to, as the consent page shows it. */
export function redirectHost(redirectUri: string) {
  return new URL(redirectUri).host;
}

/** The bearer token in an `Authorization` header, or undefined. */
export function bearerToken(header: string | undefined) {
  const match = /^Bearer[ ]+([A-Za-z0-9\-._~+/]+=*)$/i.exec(
    header?.trim() ?? '',
  );
  return match?.[1];
}

/** Seconds from `now` as a Date. */
export function inSeconds(seconds: number, now = new Date()) {
  return new Date(now.getTime() + seconds * 1000);
}

/** The consent page in the web app, as the route table names it (apps/web/src/lib/shell/routes.ts). */
export const CONSENT_PATH = '/hubungkan';

/**
 * Where everything is, from the settings: the issuer (the API's public address), the MCP resource its tokens are
 * for, the resource's metadata document, and the web app's consent page.
 */
export function oauthUrls(config: {
  API_PUBLIC_URL?: string;
  WEB_APP_URL?: string;
  ALLOWED_ORIGINS: readonly string[];
  PORT: number;
}) {
  const issuer = config.API_PUBLIC_URL ?? `http://localhost:${config.PORT}`;
  const web = (
    config.WEB_APP_URL ??
    config.ALLOWED_ORIGINS[0] ??
    issuer
  ).replace(/\/+$/, '');
  return {
    issuer,
    resource: `${issuer}/mcp`,
    resourceMetadata: `${issuer}/.well-known/oauth-protected-resource/mcp`,
    consentPage: `${web}${CONSENT_PATH}`,
  };
}
