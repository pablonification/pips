/**
 * Global search's sources (P1-A brief, rule 13; the prototype's `palIndex` in garis/app.js): what each group lists
 * and how its rows read. Ranking, grouping and the limit of 12 are P0-C's `paletteResults` (src/lib/shell/palette.ts).
 * Pure, so `tests/cari-rules.test.ts` checks them.
 */
import type { Info, NimFinderResult } from '~/api/generated';
import { cari as t } from '~/copy/cari';
import { fill } from '~/copy/fill';
import { dShort, dayDiff, hm } from '~/lib/dates';
import { byStart, type CalEvent } from '~/features/kalender/rules';

/** Pengumuman and Orang ask the API from this many characters (NIM Finder's own minimum). */
export const REMOTE_MIN = 3;
/** How long typing must pause before the API is asked. */
export const REMOTE_DEBOUNCE_MS = 250;
/** Kalender lists upcoming events this many days ahead. */
export const UPCOMING_DAYS = 21;

/** Whether a query is long enough to ask the API (trimmed, as the API trims it). */
export const asksApi = (query: string) => query.trim().length >= REMOTE_MIN;

/**
 * Whether the API's results for `query` are still on their way (P1-A round 2): typing hasn't paused yet (`settled`
 * is the query the API was last asked about), or a request is out. Until then an empty list isn't "no results".
 */
export function remotePending(
  query: string,
  settled: string,
  fetching: readonly boolean[],
): boolean {
  if (!asksApi(query)) return false;
  return query.trim() !== settled.trim() || fetching.some(Boolean);
}

/**
 * The highlighted result (P1-A round 2): the first, until the member moves the highlight; then theirs while it is
 * still listed. Results that arrive later and rank first take the highlight, as Enter runs the first (`app.js`).
 */
export function chosenResult(
  moved: string | null,
  ids: readonly string[],
): string {
  return moved !== null && ids.includes(moved) ? moved : (ids[0] ?? '');
}

/** Upcoming events within 21 days, by start (the prototype's `up`). */
export function upcomingEvents(
  events: readonly CalEvent[],
  now: number,
): CalEvent[] {
  return events
    .filter(
      (e) =>
        Date.parse(e.start) > now && dayDiff(e.start, now) <= UPCOMING_DAYS,
    )
    .sort(byStart);
}

/** An event's hint: "Sel 13 Okt 13.00". */
export const eventHint = (e: CalEvent) =>
  fill(t.waktuAcara, { hari: dShort(e.start), jam: hm(e.start) });

/** A post's row: its title, or the first 64 characters of its text with "…". */
export const postLabel = (i: Pick<Info, 'title' | 'content'>) =>
  i.title || fill(t.potong, { awal: i.content.slice(0, 64) });

/** A person's hint: "13525045 · IF". Only name, NIM and programme, whatever else the API sends. */
export const personHint = (p: Pick<NimFinderResult, 'nim' | 'major'>) =>
  fill(t.orang, { nim: p.nim, prodi: p.major });
