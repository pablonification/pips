/**
 * NIM Finder's rules (P2-B), from the prototype's `nimResults` and SPEC "Layanan detail screens". Pure, so
 * `tests/nim-rules.test.ts` checks them without a browser.
 */
import type { NimFinderResult } from '~/api/generated';
import { fill } from '~/copy/fill';
import { nim as copy } from '~/copy/nim';

/** The API refuses a search under 3 characters (trimmed). */
export const NIM_MIN = 3;

/** The most members the API returns for one search (apps/api/src/lib/nim-finder.ts `NIM_FINDER_LIMIT`). */
export const NIM_MAX = 30;

/** The query to search, trimmed; null while it is under 3 characters. */
export function nimQuery(raw: string | undefined): string | null {
  const q = (raw ?? '').trim();
  return q.length >= NIM_MIN ? q : null;
}

/**
 * The order members are shown in: the exact NIM first, then NIMs starting with the query, then other NIM matches,
 * then name matches, each group A–Z by name. Whatever order the API sends.
 */
export function rankMembers(
  results: NimFinderResult[],
  q: string,
): NimFinderResult[] {
  const needle = q.trim().toLocaleLowerCase('id');
  const group = (m: NimFinderResult) =>
    m.nim === needle
      ? 0
      : m.nim.startsWith(needle)
        ? 1
        : m.nim.includes(needle)
          ? 2
          : 3;
  return [...results].sort(
    (a, b) =>
      group(a) - group(b) ||
      a.fullName.localeCompare(b.fullName, 'id', { sensitivity: 'base' }),
  );
}

export type NimPhase =
  | { kind: 'short' }
  | { kind: 'loading' }
  | { kind: 'done'; count: number; typed: string }
  | { kind: 'error' };

/** The polite status line under the search box. */
export function nimStatus(phase: NimPhase): string {
  switch (phase.kind) {
    case 'short':
      return copy.minimal;
    case 'loading':
      return copy.mencari;
    case 'error':
      return '';
    case 'done':
      return phase.count
        ? fill(phase.count >= NIM_MAX ? copy.hasilBatas : copy.hasil, {
            jumlah: phase.count,
          })
        : fill(copy.tidakAda, { kata: phase.typed });
  }
}
