/*
 * Kelola's rules, pure and unit-tested in tests/kelola-rules.test.ts: who gets in, the forms entry, the live count,
 * the plaque's line, the bars, the recap's pages. Every time is WIB,
 * whatever the device's zone. Who may do what comes from the capability map, never a role list of its own.
 */
import type { AdminFormListItem } from '~/api/generated';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { dayDiff, dShort, hm } from '~/lib/dates';
import { REKAP_PAGE_SIZE } from './access';

export {
  gateRedirect,
  kelolaAccess,
  kelolaServices,
  LATEST_COUNT,
  REKAP_PAGE_SIZE,
  type KelolaPage,
} from './access';

/** One active form goes straight to its live page, two or more list, none is empty. */
export function formsEntry(
  forms: readonly Pick<AdminFormListItem, 'id'>[],
): { kind: 'forward'; formId: string } | { kind: 'list' } | { kind: 'empty' } {
  if (forms.length === 1) return { kind: 'forward', formId: forms[0].id };
  return forms.length ? { kind: 'list' } : { kind: 'empty' };
}

/** A form's row caption: "Ditutup {waktu}" once past `closesAt`, else "Dibuka {waktu}". */
export function formCaption(
  form: Pick<AdminFormListItem, 'opensAt' | 'closesAt'>,
  format: (at: string) => string,
  now: number = Date.now(),
): string {
  if (form.closesAt && Date.parse(form.closesAt) <= now)
    return fill(copy.formulir.ditutup, { waktu: format(form.closesAt) });
  return fill(copy.formulir.dibuka, { waktu: format(form.opensAt) });
}

/** Switched on, opened and not closed. The live square shows only then (and connected). */
export function formIsOpen(
  form: Pick<AdminFormListItem, 'opensAt' | 'closesAt' | 'isActive'>,
  now: number = Date.now(),
): boolean {
  return (
    form.isActive &&
    Date.parse(form.opensAt) <= now &&
    (!form.closesAt || now < Date.parse(form.closesAt))
  );
}

/**
 * The count shown: the larger of the fetched total and the newest live event's (responses are never deleted), so a
 * slow count answer arriving after an event never lowers it.
 */
export function liveTotal(
  fetched: number | undefined,
  eventTotal: number | undefined,
): number | undefined {
  if (fetched === undefined) return eventTotal;
  if (eventTotal === undefined) return fetched;
  return Math.max(fetched, eventTotal);
}

/** "orang sudah mengisi · terakhir 13.31 WIB"; another day "terakhir Rab 7 Okt, 13.31 WIB"; none: the first part. */
export function plaqueLine(
  newestAt: string | null | undefined,
  now: number | Date = Date.now(),
): string {
  if (!newestAt) return copy.live.orangMengisi;
  const last =
    dayDiff(newestAt, now) === 0
      ? fill(copy.live.terakhir, { waktu: hm(newestAt) })
      : fill(copy.live.terakhirHari, {
          hari: dShort(newestAt),
          waktu: hm(newestAt),
        });
  return `${copy.live.orangMengisi} · ${last}`;
}

/** A row's time: "13.31" today, "Rab 7 Okt" another day. */
export function rowTime(at: string, now: number | Date = Date.now()): string {
  return dayDiff(at, now) === 0 ? hm(at) : dShort(at);
}

export interface Bar {
  label: string;
  count: number;
  /** The filled share of the track, 0–1: `count / max`, 0 when nobody chose anything. */
  ratio: number;
}

/** One `.hbar` per option; a rating question shows 1 to 5 in order, with 0 for a value nobody chose. */
export function questionBars(question: {
  type: 'radio' | 'checkbox' | 'rating';
  options: readonly { value: string; count: number }[];
}): Bar[] {
  const rows =
    question.type === 'rating'
      ? [1, 2, 3, 4, 5].map((n) => ({
          value: String(n),
          count: question.options
            .filter((o) => Number(o.value) === n)
            .reduce((sum, o) => sum + o.count, 0),
        }))
      : question.options;
  const max = Math.max(0, ...rows.map((r) => r.count));
  return rows.map((r) => ({
    label: r.value,
    count: r.count,
    ratio: max > 0 ? r.count / max : 0,
  }));
}

export function pageCount(total: number, size = REKAP_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}
