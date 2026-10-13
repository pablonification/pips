/*
 * Kelola's rules (P3-A), pure and unit-tested in tests/kelola-rules.test.ts: who gets in, the forms entry, the live
 * count, the plaque's line, the bars, the recap's pages and Data SPARTA Magang's filters and statistics. Every time
 * is WIB, whatever the device's zone. Who may do what comes from the capability map, never a role list of its own.
 */
import type {
  AdminFormListItem,
  InternshipDepartment,
  InternshipSubmission,
} from '~/api/generated';
import { fill } from '~/copy/fill';
import { kelola as copy } from '~/copy/kelola';
import { can } from '~/lib/capabilities';
import { dayDiff, dShort, hm } from '~/lib/dates';
import { visibleServices, type Service } from '~/lib/services';

type WithRoles = { roles?: readonly string[] | null } | null | undefined;

// ---------- Who gets in ----------

export type KelolaPage = 'hub' | 'live' | 'sparta' | 'curhat';

/** The Kelola rows this member has, in the registry's order (the hub and Layanan's Kelola group). */
export function kelolaServices(user: WithRoles, now = new Date()): Service[] {
  return visibleServices(user, now).filter((s) => s.group === 'Kelola');
}

/**
 * Whether `user` may open a Kelola page; otherwise where to send them (with `replace`): to the hub when they have
 * another Kelola tool, else to Layanan (the prototype's `switchPersona`).
 */
export function kelolaAccess(
  user: WithRoles,
  page: KelolaPage,
  now = new Date(),
): { allowed: true } | { allowed: false; to: '/kelola' | '/layanan' } {
  const hasKelola = kelolaServices(user, now).length > 0;
  const allowed =
    page === 'hub'
      ? hasKelola
      : page === 'live'
        ? can(user, 'liveCounting')
        : page === 'curhat'
          ? // P3-C: Welfare's Curhat inbox.
            can(user, 'respondCurhat')
          : can(user, 'spartaData');
  if (allowed) return { allowed: true };
  return {
    allowed: false,
    to: page !== 'hub' && hasKelola ? '/kelola' : '/layanan',
  };
}

// ---------- The forms entry ----------

/** One active form goes straight to its live page, two or more list, none is empty. */
export function formsEntry(
  forms: readonly Pick<AdminFormListItem, 'id'>[],
): { kind: 'forward'; formId: string } | { kind: 'list' } | { kind: 'empty' } {
  if (forms.length === 1) return { kind: 'forward', formId: forms[0].id };
  return forms.length ? { kind: 'list' } : { kind: 'empty' };
}

/** A form's row caption: "Ditutup {waktu}" once past `closesAt`, else "Dibuka {waktu}" (P2-A's date format). */
export function formCaption(
  form: Pick<AdminFormListItem, 'opensAt' | 'closesAt'>,
  format: (at: string) => string,
  now: number = Date.now(),
): string {
  if (form.closesAt && Date.parse(form.closesAt) <= now)
    return fill(copy.formulir.ditutup, { waktu: format(form.closesAt) });
  return fill(copy.formulir.dibuka, { waktu: format(form.opensAt) });
}

// ---------- Live Counting ----------

/** P2-A's window rule: switched on, opened and not closed. The live square shows only then (and connected). */
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

/** A row's time: "13.31" today, "Rab 7 Okt" another day (the rule `scrCurhat` uses). */
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

// ---------- Rekap Form ----------

export const REKAP_PAGE_SIZE = 20;
/** The newest responses on the live page. */
export const LATEST_COUNT = 5;

export function pageCount(total: number, size = REKAP_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

// ---------- Data SPARTA Magang ----------

export const PRIORITIES = [1, 2, 3, 4] as const;
export type Priority = (typeof PRIORITIES)[number];
export type SpartaStatus = 'terkunci' | 'draf';

export interface SpartaFilters {
  q?: string;
  divisi?: string;
  pilihan?: Priority;
  status?: SpartaStatus;
}

export interface DivisionInfo {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

/** Every division with its department, in the departments' order. */
export function divisionsOf(
  departments: readonly InternshipDepartment[],
): DivisionInfo[] {
  return departments.flatMap((d) =>
    (d.divisions ?? []).map((div) => ({
      id: div.id,
      name: div.name,
      departmentId: d.id,
      departmentName: d.name,
    })),
  );
}

const choiceAt = (s: InternshipSubmission, p: number) =>
  s.choices?.find((c) => c.priorityOrder === p);

/** Status only (the statistics count what matches it, as today). */
export function matchesStatus(
  s: Pick<InternshipSubmission, 'isLocked'>,
  status: SpartaStatus | undefined,
): boolean {
  return !status || (status === 'terkunci') === s.isLocked;
}

/**
 * Today's rule: with a priority chosen, the choice at that priority must exist and, with a division chosen, be that
 * division; with only a division chosen, any choice of it matches. Status and search (name or NIM, any case) apply
 * on top.
 */
export function filterSubmissions(
  subs: readonly InternshipSubmission[],
  f: SpartaFilters,
): InternshipSubmission[] {
  const q = f.q?.trim().toLowerCase();
  return subs.filter((s) => {
    if (f.pilihan) {
      const c = choiceAt(s, f.pilihan);
      if (!c) return false;
      if (f.divisi && c.divisionId !== f.divisi) return false;
    } else if (f.divisi && !s.choices?.some((c) => c.divisionId === f.divisi))
      return false;
    if (!matchesStatus(s, f.status)) return false;
    if (q && !s.fullName.toLowerCase().includes(q) && !s.nim.includes(q))
      return false;
    return true;
  });
}

export function hasFilters(f: SpartaFilters): boolean {
  return !!(f.q?.trim() || f.divisi || f.pilihan || f.status);
}

export interface StatRow {
  key: string;
  label: string;
  count: number;
}

/** Today's `InternshipStatsCharts` counts: first choices or all, per department or per division, highest first. */
export function spartaStats(
  subs: readonly InternshipSubmission[],
  divisions: readonly DivisionInfo[],
  groupBy: 'departemen' | 'divisi',
  metric: 'pertama' | 'semua',
): StatRow[] {
  const byId = new Map(divisions.map((d) => [d.id, d]));
  const counts = new Map<string, StatRow>();
  for (const s of subs) {
    for (const c of s.choices ?? []) {
      if (metric === 'pertama' && c.priorityOrder !== 1) continue;
      const d = byId.get(c.divisionId);
      if (!d) continue;
      const key = groupBy === 'divisi' ? d.id : d.departmentId;
      const label =
        groupBy === 'divisi'
          ? fill(copy.sparta.divisiOpsi, {
              departemen: d.departmentName,
              divisi: d.name,
            })
          : d.departmentName;
      const row = counts.get(key) ?? { key, label, count: 0 };
      row.count += 1;
      counts.set(key, row);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/** "–" for an empty field (a draft's Kelas, ID LINE). */
export function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : copy.sparta.kosongTanda;
}

/** The division chosen at a priority, or "–" when there's none (a partial draft) or it no longer exists. */
export function priorityName(
  s: InternshipSubmission,
  p: number,
  divisions: ReadonlyMap<string, DivisionInfo>,
): string {
  const c = choiceAt(s, p);
  return (c && divisions.get(c.divisionId)?.name) || copy.sparta.kosongTanda;
}

/** The choices in priority order. */
export function choicesInOrder(s: InternshipSubmission) {
  return [...(s.choices ?? [])].sort(
    (a, b) => a.priorityOrder - b.priorityOrder,
  );
}
