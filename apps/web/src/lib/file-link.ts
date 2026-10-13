/**
 * Whether a stored file answer may become a link. A member's answer is any string they saved (the API checks only that
 * it is text), so a pengurus clicking "Lihat file" must never be sent to a `javascript:` or `data:` address, a
 * protocol-relative `//host`, or a look-alike with credentials, tabs or line breaks in it.
 *
 * The rule: an absolute http(s) address with no whitespace, control characters or backslashes, and no user name or
 * password. When the app knows its file storage (`mediaBase`, the API's `R2_PUBLIC_URL` given to the web build as
 * `VITE_MEDIA_URL`), the address must also sit under it: same origin and path prefix. Returns the address to link to,
 * or `null` to show the answer as plain text.
 */
export function fileHref(
  answer: string | null | undefined,
  mediaBase?: string | null,
): string | null {
  if (!answer) return null;
  const raw = answer.trim();
  // The URL parser drops tabs and line breaks and reads "\" as "/", so "java\tscript:" or "https:\\evil" would pass
  // a check made on the parsed address. Refuse them in the text itself.
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (!/^https?:\/\/[^/]/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || !url.hostname) return null;

  const base = storageBase(mediaBase);
  if (base === undefined) return url.href;
  if (base === null) return null;
  if (url.origin !== base.origin) return null;
  const prefix = base.pathname.endsWith('/')
    ? base.pathname
    : `${base.pathname}/`;
  if (prefix !== '/' && !url.pathname.startsWith(prefix)) return null;
  return url.href;
}

/** `undefined` when no storage is configured; `null` when it's configured but unreadable (then nothing links). */
function storageBase(mediaBase?: string | null): URL | null | undefined {
  const value = mediaBase?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

/** The app's file storage, from the build (`VITE_MEDIA_URL`); empty when not set. */
export const MEDIA_BASE: string = import.meta.env?.VITE_MEDIA_URL ?? '';
