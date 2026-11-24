/**
 * Tautan pendek's sample data, as the shortlink-v1 prototype has it (garis/tautan.js): Nadia's six links (matched by
 * her student email at the import, one made on the old service with an underscore), the four real HMIF service names
 * given made-up owners, other members' links, old accounts' links nobody has taken, and Raka's 161 (the most anyone
 * has), drawn by the prototype's own seeded random so the list comes out the same. Destinations are made up.
 */
import { PEOPLE, type PersonKey } from './prototype';

const WIB = (y: number, mo: number, d: number, h = 10, mi = 0) =>
  new Date(Date.UTC(y, mo - 1, d, h - 7, mi)).toISOString();

export interface StoredShortLink {
  id: string;
  name: string;
  /** Newest first. */
  olderNames: string[];
  destination: string;
  /** Who holds it, by NIM; null while an old account's link waits to be claimed. */
  owner: string | null;
  /** The old s.hmif.dev account it came from, while nobody holds it. */
  oldAccount: string | null;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

/** An old s.hmif.dev account (password `rahasia`), as the claim looks it up. */
export interface OldAccount {
  password: string;
  /** Another login of the same account (its email). */
  alias?: string;
  claimedBy?: PersonKey;
  claimedAt?: string;
  /** Matched at the import to this member, by email or NIM. */
  matched?: PersonKey;
  twoFactor?: boolean;
}

let n = 0;
const L = (
  name: string,
  destination: string,
  owner: PersonKey | null,
  made: string,
  clicks: number,
  o: { changed?: string; old?: string; id?: string } = {},
): StoredShortLink => ({
  id: o.id ?? `l${++n}`,
  name,
  olderNames: [],
  destination,
  owner: owner ? PEOPLE[owner].nim : null,
  oldAccount: o.old ?? null,
  clicks,
  createdAt: made,
  updatedAt: o.changed ?? made,
});

/** Today in the harness: Kamis, 8 Oktober 2026, 13.35 WIB. */
const NOW_MS = Date.parse(WIB(2026, 10, 8, 13, 35));

function sample(): StoredShortLink[] {
  n = 0;
  const list: StoredShortLink[] = [
    L(
      'bukber-pixel-25',
      'https://docs.google.com/forms/d/e/1FAIpQLSc9bukberPIXEL25x/viewform',
      'nadia',
      WIB(2026, 9, 28, 20, 14),
      186,
      { id: 'l-bukber' },
    ),
    L(
      'catatan-kalkulus-1b',
      'https://drive.google.com/drive/folders/1aXoKalkulus1BcatatanNP',
      'nadia',
      WIB(2026, 3, 3),
      742,
      { changed: WIB(2026, 5, 19), id: 'l-kalkulus' },
    ),
    L(
      'PixelStudyGroup',
      'https://chat.whatsapp.com/Kx9PixelStudyGroupSample',
      'nadia',
      WIB(2026, 8, 30),
      311,
      { id: 'l-pixelstudy' },
    ),
    L(
      'jadwal-piket-sekre',
      'https://docs.google.com/spreadsheets/d/1PkPiketSekrePIXELsample/edit',
      'nadia',
      WIB(2026, 9, 14),
      58,
      { id: 'l-piket' },
    ),
    L(
      'slide-pti-k4',
      'https://www.canva.com/design/DAGpti4kel/view',
      'nadia',
      WIB(2026, 9, 22),
      23,
      { id: 'l-slide' },
    ),
    // Made on the old service: an underscore, which new names can't have.
    L(
      'Catatan_PTI',
      'https://docs.google.com/document/d/1CatatanPTIsample/edit',
      'nadia',
      WIB(2026, 2, 16),
      129,
      { id: 'l-pti' },
    ),
    L(
      'BayarKasHMIF',
      'https://docs.google.com/forms/d/e/1FAIpQLSdKasHMIFsample/viewform',
      'raka',
      WIB(2024, 8, 19),
      6132,
      { id: 'l-kas' },
    ),
    L(
      'LayananAdministrasiHMIF2526',
      'https://docs.google.com/forms/d/e/1FAIpQLSeAdmHMIF2526sample/viewform',
      'raka',
      WIB(2025, 8, 4),
      2894,
      { id: 'l-adm' },
    ),
    L(
      'LowonginAja!',
      'https://docs.google.com/spreadsheets/d/1LowonginAjaSampleSheet/edit',
      'aulia',
      WIB(2024, 10, 1),
      4980,
      { id: 'l-lowongin' },
    ),
    L(
      'MadingBeasiswa',
      'https://www.notion.so/hmif/Mading-Beasiswa-sample',
      'salsa',
      WIB(2024, 9, 12),
      3410,
      { id: 'l-mading' },
    ),
    L(
      'tutor-strategi-algo',
      'https://drive.google.com/drive/folders/1TutorStrAlgSample',
      'aulia',
      WIB(2026, 2, 10),
      905,
    ),
    L(
      'pixel-welcoming-galeri',
      'https://drive.google.com/drive/folders/1WelparGaleriSample',
      'salsa',
      WIB(2026, 9, 21),
      1288,
    ),
    L(
      'kuesioner-ta-23',
      'https://docs.google.com/forms/d/e/1FAIpQLSkuesionerTA23/viewform',
      'dimas',
      WIB(2026, 9, 30),
      97,
    ),
    L(
      'kevin-cv',
      'https://www.canva.com/design/DAGkevincv/view',
      'kevin',
      WIB(2025, 1, 7),
      64,
    ),
    L(
      'ArkavDocs24',
      'https://drive.google.com/drive/folders/1ArkavDocs24sample',
      'kevin',
      WIB(2024, 2, 2),
      1203,
    ),
    L(
      'bimbel-uts-ganjil',
      'https://docs.google.com/document/d/1BimbelUTSsample/edit',
      'bima',
      WIB(2026, 10, 2),
      141,
    ),
    L(
      'foto-angkatan-25',
      'https://drive.google.com/drive/folders/1FotoAngkatan25',
      'tasya',
      WIB(2026, 9, 9),
      377,
    ),
    // Not matched at the import: waiting to be claimed.
    L(
      'SemnasIF25',
      'https://www.canva.com/design/DAGsemnasIF25/view',
      null,
      WIB(2025, 4, 2),
      2140,
      { old: 'panitia.semnas', id: 'l-semnas' },
    ),
    L(
      'semnas-rundown',
      'https://docs.google.com/spreadsheets/d/1SemnasRundown/edit',
      null,
      WIB(2025, 4, 9),
      310,
      { old: 'panitia.semnas' },
    ),
    L(
      'semnas-daftar',
      'https://docs.google.com/forms/d/e/1FAIpQLSsemnasDaftar/viewform',
      null,
      WIB(2025, 3, 20),
      976,
      { old: 'panitia.semnas' },
    ),
    L(
      'arkav-sponsor-deck',
      'https://www.canva.com/design/DAGarkavSponsor/view',
      null,
      WIB(2023, 11, 14),
      88,
      { old: 'ardiwk' },
    ),
    L(
      'pressrelease-oktober',
      'https://docs.google.com/document/d/1PressReleaseOkt/edit',
      null,
      WIB(2024, 10, 3),
      44,
      { old: 'humas.ext' },
    ),
    L(
      'wisnu-porto',
      'https://wisnu-portfolio.example.dev',
      null,
      WIB(2023, 6, 1),
      12,
      { old: 'wisnu.dev' },
    ),
    L(
      'PIXEL-OSKM-Kel12',
      'https://docs.google.com/document/d/1OSKMkel12/edit',
      null,
      WIB(2025, 8, 4),
      96,
      { old: 'nadia.putri', id: 'l-oskm' },
    ),
    L(
      'kumpul-kelompok-12',
      'https://docs.google.com/spreadsheets/d/1Kumpulkel12/edit',
      null,
      WIB(2025, 8, 6),
      41,
      { old: 'nadia.putri' },
    ),
    L(
      'ttd-kelompok12',
      'https://docs.google.com/forms/d/e/1FAIpQLSttdkel12/viewform',
      null,
      WIB(2025, 8, 8),
      17,
      { old: 'nadia.putri' },
    ),
    L(
      'foto-oskm-kel12',
      'https://drive.google.com/drive/folders/1FotoOSKMkel12',
      null,
      WIB(2025, 8, 15),
      230,
      { old: 'nadia.putri' },
    ),
  ];
  // Raka's 160 more, as the prototype draws them.
  let seed = 9013;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rid = (k: number) =>
    Array.from(
      { length: k },
      () =>
        'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789'[
          Math.floor(rnd() * 58)
        ],
    ).join('');
  const gDest = () => {
    const r = rnd();
    return r < 0.3
      ? `https://docs.google.com/forms/d/e/1FAIpQL${rid(18)}/viewform`
      : r < 0.55
        ? `https://docs.google.com/spreadsheets/d/1${rid(20)}/edit`
        : r < 0.72
          ? `https://drive.google.com/drive/folders/1${rid(20)}`
          : r < 0.84
            ? `https://docs.google.com/document/d/1${rid(20)}/edit`
            : r < 0.92
              ? `https://www.canva.com/design/DAG${rid(8)}/view`
              : `https://chat.whatsapp.com/${rid(18)}`;
  };
  const a = [
    'Rapat',
    'Notulen',
    'Absen',
    'Materi',
    'BankSoal',
    'Jadwal',
    'Kuis',
    'Asistensi',
    'Evaluasi',
    'Proker',
    'LPJ',
    'Rundown',
    'Timeline',
    'Sponsor',
    'Proposal',
    'Dokumentasi',
    'Pendaftaran',
    'Feedback',
    'Rekap',
    'Tutor',
  ];
  const b = [
    'Akademik',
    'IF2110',
    'IF2120',
    'IF2123',
    'IF2130',
    'IF2150',
    'UTS',
    'UAS',
    'Bimbel',
    'Kaderisasi',
    'Wisuda',
    'Seminar',
    'Makrab',
    'Ganjil',
    'Genap',
  ];
  const c = ['24', '25', '2526', '26', 'Sem3', 'Sem5'];
  const seen = new Set(list.map((x) => x.name.toLowerCase()));
  const from = Date.parse(WIB(2024, 8, 1));
  while (list.filter((x) => x.owner === PEOPLE.raka.nim).length < 160) {
    const s = `${a[Math.floor(rnd() * a.length)]}${b[Math.floor(rnd() * b.length)]}${c[Math.floor(rnd() * c.length)]}`;
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    const made = new Date(from + rnd() * (NOW_MS - from - 864e5)).toISOString();
    const dest = gDest();
    list.push(L(s, dest, 'raka', made, Math.floor(rnd() ** 3 * 2400)));
  }
  // Made this morning.
  list.push(
    L(
      'rapat-akademik-kamis',
      'https://docs.google.com/document/d/1RapatAkdKamis/edit',
      'raka',
      WIB(2026, 10, 8, 11, 2),
      12,
    ),
  );
  return list;
}

/** A fresh copy each time: a test may change its own. */
export const sampleShortLinks = (): StoredShortLink[] => sample();

/** Names of links deleted before today: never given out again. Stored without capitals. */
export const sampleGoneNames = (): string[] => [
  'oprec-asisten-pti',
  'daftar-bukber-24',
];

export const sampleOldAccounts = (): Record<string, OldAccount> => ({
  'nadia.putri': { password: 'rahasia', alias: 'nadia.putri@example.com' },
  'panitia.semnas': { password: 'rahasia' },
  ardiwk: { password: 'rahasia' },
  'humas.ext': { password: 'rahasia' },
  'wisnu.dev': { password: 'rahasia' },
  'arkav.panitia': {
    password: 'rahasia',
    claimedBy: 'kevin',
    claimedAt: WIB(2026, 10, 8, 9, 12),
  },
  nadiaputri07: { password: 'rahasia' },
  '13525945@std.stei.itb.ac.id': { password: 'rahasia', matched: 'nadia' },
  'ketua.lama': { password: 'rahasia', twoFactor: true },
});

/** The claim's window: three months after the switch (the prototype's sample switch, 1 December 2026). */
export const CLAIM_UNTIL = WIB(2027, 3, 1, 23, 59);

/** A published form's clicks on s.hmif.dev, as the prototype counts them. */
export const FORM_CLICKS: Record<string, number> = {
  makrab: 412,
  welpar: 380,
  suara: 655,
  pixel: 1210,
  ta: 98,
  belajar: 0,
};
