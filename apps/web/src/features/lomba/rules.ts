/**
 * Info Lomba's rules (P2-B), from the prototype's `scrLomba` and `rupiah`, and SPEC story 78 (every page
 * reachable). Pure, so `tests/lomba-rules.test.ts` checks them without a browser. Dates are WIB whatever the
 * device's zone (src/lib/dates.ts).
 */
import type { Competition } from '~/api/generated';
import { fill } from '~/copy/fill';
import { lomba as copy } from '~/copy/lomba';
import { dayDiff, dShort, hm } from '~/lib/dates';

/** The API's page size (`COMPETITIONS_PER_PAGE` in apps/api's competitions.repo.ts). */
export const LOMBA_PAGE = 10;

type Deadline = Competition['registrationDeadline'] | null | undefined;

/** Still open by the app's clock, as the prototype keeps only `close > NOW` (a cached list can be old). */
export function isOpen(deadline: Deadline, now: number): boolean {
  if (!deadline) return true;
  const t = Date.parse(deadline);
  return Number.isNaN(t) || t > now;
}

/** "Tutup Rab 14 Okt, 23.59", in WIB. */
export function deadlineLine(deadline: string): string {
  return fill(copy.tutup, { tanggal: dShort(deadline), jam: hm(deadline) });
}

/** Three calendar days (WIB) or fewer left: the line takes the danger colour (the prototype's `cd`). */
export function isUrgent(deadline: string, now: number): boolean {
  return dayDiff(deadline, now) <= 3;
}

/** "Rp150.000"; "Gratis" when there is no fee (null, empty or 0); a price that isn't a number as stored. */
export function rupiah(price: string | number | null | undefined): string {
  if (price == null) return copy.gratis;
  const raw = String(price).trim();
  if (!raw) return copy.gratis;
  if (!/^\d+(\.\d+)?$/.test(raw)) return raw;
  const n = Math.round(Number(raw));
  if (n === 0) return copy.gratis;
  return `Rp${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** A link as stored, with `https://` added when it has no scheme (as today's card does). */
export function withScheme(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`;
}

/**
 * The offset of the next page: how many competitions the API has returned so far (not how many are shown after
 * leaving out closed ones), or undefined after a page shorter than a full one. Today's `PAGE_SIZE = 0` asked for
 * offset 0 again and never reached page 2.
 */
export function nextOffset(pages: Competition[][]): number | undefined {
  const last = pages[pages.length - 1];
  if (!last || last.length < LOMBA_PAGE) return undefined;
  return pages.reduce((n, p) => n + p.length, 0);
}
