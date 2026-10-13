/**
 * Times for Form and Magang SPARTA, always in WIB (UTC+7, no daylight saving), as the prototype writes them:
 * "Sab 12 Sep, 13.00" on a card, "Sabtu, 12 September 2026, 13.00 WIB" on the form, "Min, 23 Agu 2026 pukul 23.59"
 * for SPARTA (garis/data.js `FORMS.opens`, `A.svc`). Hand-rolled, so they don't depend on the browser's locale data.
 */
const WIB_MS = 7 * 3600_000;

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function wib(at: string | Date | number) {
  const d = new Date(new Date(at).getTime() + WIB_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    day: d.getUTCDay(),
    date: d.getUTCDate(),
    month: d.getUTCMonth(),
    year: d.getUTCFullYear(),
    time: `${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())}`,
  };
}

/** "Sab 12 Sep, 13.00": a card's caption. */
export function shortWhen(at: string | Date | number): string {
  const w = wib(at);
  return `${HARI_PENDEK[w.day]} ${w.date} ${BULAN_PENDEK[w.month]}, ${w.time}`;
}

/** "Sabtu, 12 September 2026, 13.00 WIB": the form's own page. */
export function longWhen(at: string | Date | number): string {
  const w = wib(at);
  return `${HARI[w.day]}, ${w.date} ${BULAN[w.month]} ${w.year}, ${w.time} WIB`;
}

/** "Min, 23 Agu 2026 pukul 23.59": SPARTA's deadline. */
export function deadlineWhen(at: string | Date | number): string {
  const w = wib(at);
  return `${HARI_PENDEK[w.day]}, ${w.date} ${BULAN_PENDEK[w.month]} ${w.year} pukul ${w.time}`;
}

/** "07.45": the offline banner's last update. */
export function clockWhen(at: string | Date | number): string {
  return wib(at).time;
}

/**
 * What is left until a time, for the countdown: "2 hari 3 jam", "3 jam 5 menit", "4 menit 9 detik", "9 detik".
 * Two units at most, the larger first; never negative.
 */
export function remaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h ? `${d} hari ${h} jam` : `${d} hari`;
  if (h > 0) return m ? `${h} jam ${m} menit` : `${h} jam`;
  if (m > 0) return sec ? `${m} menit ${sec} detik` : `${m} menit`;
  return `${sec} detik`;
}
