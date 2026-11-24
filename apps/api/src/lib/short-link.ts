import { randomInt } from 'node:crypto';
import type { PushData } from './push-manager';

// Tautan pendek (docs/adr/0024-*): the rules for names, destinations, the redirect and the claim, with no database.

/** One rule for every new or renamed name, a short link's or a form's: letters, numbers and hyphens, 3 to 50. */
export const NAME_MIN = 3;
export const NAME_MAX = 50;
const NAME = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/;

/** Why a new name can't be used, in the order the field says it; null when its form is fine. */
export type NameProblem = 'characters' | 'too_short' | 'too_long' | 'hyphens';

/** What holds a name that is otherwise fine: another link or form now (`taken`), or a deleted one (`used`). */
export type NameHeld = 'taken' | 'used';

/** Why a name can't be had: the rule, or who holds it (`heldAs`: the name as held, capitals and all). */
export type NameRefusal =
  | { problem: NameProblem | 'used'; heldAs?: undefined; heldBy?: undefined }
  | { problem: 'taken'; heldAs: string; heldBy: 'link' | 'form' };

/** The refusal for a name: its rule first, then what holds it (looked up only when the rule passes). */
export async function nameRefusal(
  name: string,
  holderOf: (name: string) => Promise<{
    held: NameHeld;
    heldAs: string;
    heldBy: 'link' | 'form';
  } | null>,
): Promise<NameRefusal | null> {
  const problem = nameProblem(name);
  if (problem) return { problem };
  const holder = await holderOf(name);
  if (!holder) return null;
  return holder.held === 'used'
    ? { problem: 'used' }
    : { problem: 'taken', heldAs: holder.heldAs, heldBy: holder.heldBy };
}

/** Whether a refusal is the name's own fault (400) rather than someone holding it (409). */
export const isRuleProblem = (r: NameRefusal) =>
  r.problem !== 'taken' && r.problem !== 'used';

/** Spaces become hyphens, as the field does while typing; capitals stay, for reading (BayarKasHMIF). */
export const tidyName = (v: string) => v.trim().replace(/\s+/g, '-');

export function nameProblem(name: string): NameProblem | null {
  if (/[^A-Za-z0-9-]/.test(name)) return 'characters';
  if (name.length < NAME_MIN) return 'too_short';
  if (name.length > NAME_MAX) return 'too_long';
  if (!NAME.test(name)) return 'hyphens';
  return null;
}

/** Names are compared without capitals. The database folds with `lower()`, which agrees for every name the rule allows. */
export const foldName = (name: string) => name.toLowerCase();

// No l, o, 0 or 1: a random name is often read off a poster.
const RANDOM_LETTERS = 'abcdefghijkmnpqrstuvwxyz23456789';
export const RANDOM_NAME_LENGTH = 6;

export function randomName(): string {
  let s = '';
  for (let i = 0; i < RANDOM_NAME_LENGTH; i++)
    s += RANDOM_LETTERS[randomInt(RANDOM_LETTERS.length)];
  return s;
}

/** The longest destination accepted: longer than any real form or drive address, short enough for a link row. */
export const DESTINATION_MAX = 2048;

export type DestinationProblem = 'invalid' | 'self';

/**
 * Why a destination can't be saved; null when it can. It must be a whole http(s) address with a dotted host, as the
 * field asks ("Tulis alamat lengkap, diawali https://"), and not another s.hmif.dev link.
 */
export function destinationProblem(
  destination: string,
  shortHost: string,
): DestinationProblem | null {
  const v = destination.trim();
  if (!v || v.length > DESTINATION_MAX || /\s/.test(v)) return 'invalid';
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid';
  if (!/^[^.]+\.[^.]/.test(url.hostname) || url.username || url.password)
    return 'invalid';
  if (url.hostname.toLowerCase() === hostName(shortHost)) return 'self';
  return null;
}

/** Whether the redirect may send someone there: only an http(s) address, whatever an import brought in. */
export function isSafeDestination(
  destination: string | null,
): destination is string {
  if (!destination) return false;
  try {
    const url = new URL(destination);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** The web app's address: the setting, or the first allowed origin. */
export function webAppUrl(config: {
  WEB_APP_URL?: string;
  ALLOWED_ORIGINS: readonly string[];
}) {
  return (config.WEB_APP_URL ?? config.ALLOWED_ORIGINS[0] ?? '').replace(
    /\/+$/,
    '',
  );
}

/** A Host header or setting without its port, lower case. */
export function hostName(host: string): string {
  const h = host.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  const colon = h.lastIndexOf(':');
  return colon === -1 ? h : h.slice(0, colon);
}

/** Whether a request with this Host header is for the short-link host. */
export function isShortHost(
  hostHeader: string | undefined,
  shortHost: string | undefined,
): boolean {
  if (!hostHeader || !shortHost) return false;
  return hostName(hostHeader) === hostName(shortHost);
}

function decoded(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

/**
 * The names a request to the short-link host may mean, best first. The old service matched the raw path with its
 * query, never decoded, so a name with `?` or `&` in it lives in the query: try that, then its percent-decoded form
 * (a browser sends a space or `¿` encoded), then the path alone and its decoded form (a name with `?utm=…` added).
 * `rawTarget` is everything after the host's first slash, as sent.
 */
export function nameCandidates(rawTarget: string): string[] {
  const target = rawTarget.split('#')[0];
  const q = target.indexOf('?');
  const path = q === -1 ? target : target.slice(0, q);
  const out: string[] = [];
  for (const c of [target, decoded(target), path, decoded(path)]) {
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** A row the redirect's one lookup returns: the name that matched and what its link leads to. */
export interface RedirectRow {
  name: string;
  folded: string;
  linkId: string;
  destination: string | null;
  formId: string | null;
  formName: string | null;
  deleted: boolean;
}

/**
 * Which row a request means: an exact name first (in the candidates' order), then the one link whose name matches
 * without capitals. Two links that differ only in capitals (old twins) are both a match without capitals, so neither
 * is chosen that way.
 */
export function pickRedirect(
  rows: readonly RedirectRow[],
  candidates: readonly string[],
): RedirectRow | null {
  for (const c of candidates) {
    const exact = rows.find((r) => r.name === c);
    if (exact) return exact;
  }
  for (const c of candidates) {
    const f = foldName(c);
    const links = new Set(
      rows.filter((r) => r.folded === f).map((r) => r.linkId),
    );
    if (links.size === 1) return rows.find((r) => r.folded === f) ?? null;
  }
  return null;
}

export type RedirectAnswer =
  | { kind: 'link'; location: string; linkId: string }
  | { kind: 'not_found'; location: string }
  | { kind: 'app'; location: string };

/** Pages of the web app the redirect and the pushes send people to. */
export const SHORT_LINK_PATHS = {
  list: '/layanan/tautan',
  link: (id: string) => `/layanan/tautan/${encodeURIComponent(id)}`,
  notFound: (name: string) =>
    `/tautan-tidak-ditemukan?nama=${encodeURIComponent(name)}`,
  form: (name: string) => `/f/${encodeURIComponent(name)}`,
};

/**
 * Where a request to the short-link host goes. `/` and the old dashboard's pages (`/dash…`) open the member's links
 * in PIPS!, unless a link has that name; a name that doesn't exist, was deleted or leads to anything but http(s)
 * opens the small not-found page.
 */
export function redirectAnswer(
  rawTarget: string,
  row: RedirectRow | null,
  webAppUrl: string,
): RedirectAnswer {
  if (row && !row.deleted) {
    if (row.formId && row.formName)
      return {
        kind: 'link',
        location: webAppUrl + SHORT_LINK_PATHS.form(row.formName),
        linkId: row.linkId,
      };
    if (!row.formId && isSafeDestination(row.destination))
      return {
        kind: 'link',
        // As a browser would send it: a header can't carry other characters.
        location: new URL(row.destination.trim()).href,
        linkId: row.linkId,
      };
  }
  const target = rawTarget.split('#')[0];
  const path = target.split('?')[0];
  if (!row && (path === '' || /^dash(\/|$)/i.test(path)))
    return { kind: 'app', location: webAppUrl + SHORT_LINK_PATHS.list };
  return {
    kind: 'not_found',
    location: webAppUrl + SHORT_LINK_PATHS.notFound(decoded(target) ?? target),
  };
}

/** Why no browser can open an old name, or null when one can. For the import's report. */
export function unreachableReason(name: string): string | null {
  if (name === '') return 'empty';
  if (name.includes('#')) return '# starts a part the browser never sends';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'a control character';
  if (/^\s|\s$/.test(name)) return 'a space at the start or end is dropped';
  if (name.includes('\\')) return 'a browser turns \\ into /';
  const path = name.split('?')[0];
  if (path.split('/').some((seg) => seg === '.' || seg === '..'))
    return 'a browser removes . and .. from the path';
  return null;
}

/** A student number in an old account's email or username: the first run of eight digits, the email first. */
export function nimFromAccount(
  email: string | null | undefined,
  username: string | null | undefined,
): string | null {
  for (const s of [email?.split('@')[0], username]) {
    const m = s?.match(/(?<!\d)(\d{8})(?!\d)/);
    if (m) return m[1];
  }
  return null;
}

// The claim: an old account's username or email and its password move its links to the member.

export const CLAIM_MAX_TRIES = 5;
export const CLAIM_LOCK_MS = 15 * 60 * 1000;

export interface ClaimLock {
  tries: number;
  lastTryAt: Date;
  lockedUntil: Date | null;
}

/** Whether a lock row blocks a try now. */
export const isLocked = (lock: ClaimLock | null | undefined, now: Date) =>
  !!lock?.lockedUntil && lock.lockedUntil > now;

/**
 * The lock after one more wrong password. Tries older than the lock's length are forgotten; the fifth in a row locks
 * it for 15 minutes and starts the count again.
 */
export function afterWrongTry(
  lock: ClaimLock | null | undefined,
  now: Date,
): ClaimLock {
  const recent =
    lock && now.getTime() - lock.lastTryAt.getTime() < CLAIM_LOCK_MS
      ? lock.tries
      : 0;
  const tries = recent + 1;
  if (tries >= CLAIM_MAX_TRIES)
    return {
      tries: 0,
      lastTryAt: now,
      lockedUntil: new Date(now.getTime() + CLAIM_LOCK_MS),
    };
  return { tries, lastTryAt: now, lockedUntil: null };
}

/** Whether claiming is still open: until the end the setting names, or always when it names none. */
export const claimOpen = (until: Date | undefined, now: Date) =>
  !until || now < until;

// What the owner is told when an admin changes their link: a web push, with no setting to turn it off.

export type OwnerPush =
  | { kind: 'moved'; linkId: string; name: string; to: string }
  | { kind: 'deleted'; linkId: string; name: string }
  | { kind: 'destination'; linkId: string; name: string }
  | { kind: 'renamed'; linkId: string; name: string; from: string };

export function ownerPush(p: OwnerPush, shortHost: string): PushData {
  const at = (name: string) => `${hostName(shortHost)}/${name}`;
  const url = SHORT_LINK_PATHS.link(p.linkId);
  switch (p.kind) {
    case 'moved':
      return {
        title: 'Tautanmu dipindahkan',
        options: {
          body: `Admin HMIF memindahkan ${at(p.name)} ke ${p.to}. Alamatnya tetap bisa dibuka.`,
          data: { url },
        },
      };
    case 'deleted':
      return {
        title: 'Tautanmu dihapus',
        options: {
          body: `Admin HMIF menghapus ${at(p.name)}. Alamat ini tidak bisa dibuka lagi.`,
          data: { url },
        },
      };
    case 'destination':
      return {
        title: 'Tautanmu diubah',
        options: {
          body: `Admin HMIF mengubah tujuan ${at(p.name)}.`,
          data: { url },
        },
      };
    case 'renamed':
      return {
        title: 'Tautanmu diubah',
        options: {
          body: `Admin HMIF mengganti nama ${at(p.from)} jadi ${at(p.name)}. Alamat lama tetap bisa dibuka.`,
          data: { url },
        },
      };
  }
}
