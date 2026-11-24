/**
 * Tautan pendek's rules apart from React, so `tests/tautan-rules.test.ts` checks them without a browser.
 */
import { fill } from '~/copy/fill';
import { tautan as copy } from '~/copy/tautan';
import { dayDiff, dShort, hm, wib } from '~/lib/dates';
import { tanggal } from '~/copy/tanggal';

/** Links on a page of the list, and the step of "Tampilkan 50 lagi". */
export const PAGE_SIZE = 50;

/** An address without its scheme and `www.`, as the list and a link's page show where it goes. */
export const bareUrl = (u: string) =>
  u.replace(/^https?:\/\//i, '').replace(/^www\./i, '');

export type DestinationProblem = keyof typeof copy.tujuanMasalah;

/**
 * Why a destination can't be saved, before asking the server, in the order the field says it: nothing typed, a link
 * that is already on s.hmif.dev, then anything that isn't a whole http(s) address with a dotted host (the API's
 * `destinationProblem`; `tests/tautan-rules.test.ts` holds them together).
 */
export function destinationProblem(value: string): DestinationProblem | null {
  const v = value.trim();
  if (!v) return 'kosong';
  if (/^(https?:\/\/)?s\.hmif\.dev(\/|$)/i.test(v)) return 'self';
  if (v.length > 2048 || /\s/.test(v)) return 'invalid';
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'invalid';
  if (!/^[^.]+\.[^.]/.test(url.hostname) || url.username || url.password)
    return 'invalid';
  return null;
}

/** "3 Mar 2026", a link's dates. */
export function dayMonthYear(d: string) {
  const w = wib(d);
  return `${w.day} ${tanggal.bulanPendek[w.month]} ${w.year}`;
}

/** "1 Maret 2027", the claim's last day. */
export function dayMonthYearLong(d: string) {
  const w = wib(d);
  return `${w.day} ${tanggal.bulan[w.month]} ${w.year}`;
}

/** "hari ini", "kemarin", else "Kam 8 Okt": when an old account's links were taken. */
export function whenDay(d: string, now: number) {
  const dd = dayDiff(d, now);
  if (dd === 0) return copy.ambil.hariIni;
  if (dd === -1) return tanggal.kemarin;
  return dShort(d);
}

/** A link's "Dibuat" and "Diubah": Diubah only when it changed after it was made, and never for a form's link. */
export function linkDates(l: {
  createdAt: string;
  updatedAt: string;
  form: unknown;
}): { made: string; changed: string | null } {
  return {
    made: dayMonthYear(l.createdAt),
    changed:
      !l.form && dayMonthYear(l.updatedAt) !== dayMonthYear(l.createdAt)
        ? dayMonthYear(l.updatedAt)
        : null,
  };
}

/** "Tampilkan 50 lagi" and "dari 111": the next step, and how many are left. */
export function moreLabel(shown: number, total: number) {
  const left = total - shown;
  if (left <= 0) return null;
  return {
    label: fill(copy.daftar.tampilkanLagi, {
      jumlah: Math.min(PAGE_SIZE, left),
    }),
    left: fill(copy.daftar.dariSisa, { jumlah: left.toLocaleString('id-ID') }),
  };
}

/** A wrong password: the words, with the tries left from the third wrong one. */
export function wrongWords(triesLeft: number) {
  return triesLeft <= 2
    ? `${copy.ambil.tidakCocok} ${fill(copy.ambil.sisa, { jumlah: triesLeft })}`
    : copy.ambil.tidakCocok;
}

/** Five wrong tries: locked until `until`, said as its WIB time. */
export const lockedWords = (until: string) =>
  fill(copy.ambil.terkunci, { waktu: hm(until) });

/** Kelola's count line: "161 tautan", or for Belum diambil with nothing typed "640 tautan dari 80 akun lama". */
export function adminCount(
  view: 'all' | 'unclaimed',
  search: string,
  total: number,
  accounts: number | null,
) {
  const n = total.toLocaleString('id-ID');
  if (view === 'unclaimed' && !search.trim() && accounts !== null)
    return fill(copy.kelola.dariAkun, {
      jumlah: n,
      akun: accounts.toLocaleString('id-ID'),
    });
  return fill(copy.kelola.jumlah, { jumlah: n });
}
