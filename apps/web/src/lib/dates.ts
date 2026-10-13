/**
 * Dates the way PIPS! says them (the prototype's `rel`, `dLong`, `dShort` and `hm` in garis/ui.js): Indonesian
 * words, the time as "13.35", always in WIB (UTC+7, no daylight saving) whatever the device's zone. Shared by every
 * screen (P1-B made it; P1-A's Beranda and Kalender use the same words).
 * The words are in `src/copy/tanggal.ts`.
 */
import { fill } from '~/copy/fill';
import { tanggal } from '~/copy/tanggal';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const { hari, hariPendek, bulan, bulanPendek } = tanggal;

type DateLike = Date | string | number;

const ms = (d: DateLike) => (d instanceof Date ? d.getTime() : new Date(d).getTime());

/** The calendar fields of an instant in WIB. */
export function wib(d: DateLike) {
  const t = new Date(ms(d) + WIB_OFFSET_MS);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth(),
    day: t.getUTCDate(),
    weekday: t.getUTCDay(),
    hours: t.getUTCHours(),
    minutes: t.getUTCMinutes(),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "12.30" */
export function hm(d: DateLike) {
  const w = wib(d);
  return `${pad(w.hours)}.${pad(w.minutes)}`;
}

/** "Kamis, 8 Oktober" */
export function dLong(d: DateLike) {
  const w = wib(d);
  return `${hari[w.weekday]}, ${w.day} ${bulan[w.month]}`;
}

/** "Sen 5 Okt" */
export function dShort(d: DateLike) {
  const w = wib(d);
  return `${hariPendek[w.weekday]} ${w.day} ${bulanPendek[w.month]}`;
}

/** "Kamis, 8 Oktober 2026 · 12.30", a post's full date (the prototype's `postDetail` byline). */
export function dFull(d: DateLike) {
  return `${dLong(d)} ${wib(d).year} · ${hm(d)}`;
}

/** Whole WIB days from `now`'s day to `d`'s day: 0 today, 1 tomorrow, -1 yesterday. */
export function dayDiff(d: DateLike, now: DateLike = Date.now()) {
  const day = (x: DateLike) => Math.floor((ms(x) + WIB_OFFSET_MS) / DAY_MS);
  return day(d) - day(now);
}

/** "baru saja", "40 menit lalu", "1 jam lalu", "kemarin", else "Sen 5 Okt" (the prototype's `rel`). */
export function rel(d: DateLike, now: DateLike = Date.now()) {
  const mins = Math.round((ms(now) - ms(d)) / 60000);
  const dd = dayDiff(d, now);
  if (dd === 0) {
    if (mins < 1) return tanggal.baruSaja;
    if (mins < 60) return fill(tanggal.menitLalu, { jumlah: mins });
    return fill(tanggal.jamLalu, { jumlah: Math.floor(mins / 60) });
  }
  if (dd === -1) return tanggal.kemarin;
  return dShort(d);
}
