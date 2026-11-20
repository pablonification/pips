import type { calendar_v3 } from 'googleapis/build/src/apis/calendar';

/** How far around now a sync reads: a month back (recent events stay visible), a year ahead. */
export const SYNC_PAST_DAYS = 31;
export const SYNC_FUTURE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET = '+07:00';
/** Longest title and description kept; Google allows far more than a phone shows. */
const MAX_TITLE = 300;
const MAX_DESCRIPTION = 8000;
const MAX_LOCATION = 500;

export function syncWindow(now: number) {
  return {
    from: new Date(now - SYNC_PAST_DAYS * DAY_MS),
    until: new Date(now + SYNC_FUTURE_DAYS * DAY_MS),
  };
}

/** The fields Kalender keeps of one Google event. */
export interface SyncedEvent {
  googleCalendarId: string;
  googleCalendarUrl: string;
  title: string;
  description: string;
  location: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Google Calendar keeps a description as HTML when it was written in Google's editor (`<br>`, `<b>`, `<a href>`), or as
 * plain text. Kalender shows text only, so: line breaks for `<br>`, paragraphs and list items, a link's address after
 * its text when they differ, every other tag dropped, entities decoded, and runs of blank lines folded.
 */
export function descriptionText(html: string | null | undefined): string {
  if (!html) return '';
  let s = html.replace(/\r\n?/g, '\n');
  s = s.replace(
    /<a\b[^>]*?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
    (
      _,
      d: string | undefined,
      q: string | undefined,
      b: string | undefined,
      text: string,
    ) => {
      const href = (d ?? q ?? b ?? '').trim();
      const label = text.replace(/<[^>]*>/g, '').trim();
      if (!href || label === href || label === '') return label || href;
      return `${label} (${href})`;
    },
  );
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n');
  s = s.replace(/<li\b[^>]*>/gi, '• ');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : '';
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.slice(0, MAX_DESCRIPTION);
}

/** A date-only value of an all-day event ("2026-11-27") as midnight WIB. */
function wibMidnight(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00${WIB_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function instant(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * One Google event as Kalender keeps it, or null when Kalender can't show it: cancelled, no id or link, or times that
 * don't read. An all-day event runs from midnight WIB of its first day to midnight after its last (Google's end date
 * is already the day after). An event with no title is named by its calendar's name rather than left blank.
 */
export function toSyncedEvent(
  e: calendar_v3.Schema$Event,
  untitled: string,
): SyncedEvent | null {
  if (e.status === 'cancelled' || !e.id || !e.htmlLink) return null;
  const day = e.start?.dateTime ? null : e.start?.date;
  const allDay = !!day;
  const start = day ? wibMidnight(day) : instant(e.start?.dateTime);
  let end = allDay ? wibMidnight(e.end?.date ?? '') : instant(e.end?.dateTime);
  if (!start) return null;
  if (!end || end.getTime() < start.getTime()) {
    end = allDay ? new Date(start.getTime() + DAY_MS) : start;
  }
  const title = (e.summary ?? '').trim().slice(0, MAX_TITLE) || untitled;
  const location = (e.location ?? '').trim().slice(0, MAX_LOCATION) || null;
  return {
    googleCalendarId: e.id,
    googleCalendarUrl: e.htmlLink,
    title,
    description: descriptionText(e.description),
    location,
    start,
    end,
    allDay,
  };
}

/** What a sync changes in one calendar: rows to add, rows to update (by row id), and rows to remove. */
export interface SyncPlan {
  insert: SyncedEvent[];
  update: Array<{ id: string; event: SyncedEvent }>;
  remove: string[];
}

interface StoredEvent extends SyncedEvent {
  id: string;
}

const same = (a: SyncedEvent, b: SyncedEvent) =>
  a.title === b.title &&
  a.description === b.description &&
  a.location === b.location &&
  a.allDay === b.allDay &&
  a.googleCalendarUrl === b.googleCalendarUrl &&
  a.start.getTime() === b.start.getTime() &&
  a.end.getTime() === b.end.getTime();

/**
 * Compares what Google has now with the rows Kalender holds for that calendar in the same window. A stored row that
 * Google no longer lists was deleted, cancelled or moved out of the window there, so it goes. Rows outside the window
 * are never passed in, so they stay.
 */
export function planSync(
  google: readonly SyncedEvent[],
  stored: readonly StoredEvent[],
): SyncPlan {
  const plan: SyncPlan = { insert: [], update: [], remove: [] };
  const byGoogleId = new Map<string, StoredEvent>();
  for (const row of stored) {
    // Two rows for one Google event: keep the first, remove the other.
    if (byGoogleId.has(row.googleCalendarId)) plan.remove.push(row.id);
    else byGoogleId.set(row.googleCalendarId, row);
  }
  const seen = new Set<string>();
  for (const event of google) {
    if (seen.has(event.googleCalendarId)) continue;
    seen.add(event.googleCalendarId);
    const row = byGoogleId.get(event.googleCalendarId);
    if (!row) plan.insert.push(event);
    else if (!same(row, event)) plan.update.push({ id: row.id, event });
  }
  for (const row of byGoogleId.values()) {
    if (!seen.has(row.googleCalendarId)) plan.remove.push(row.id);
  }
  return plan;
}
