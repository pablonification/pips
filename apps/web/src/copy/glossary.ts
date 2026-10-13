/**
 * The house terms (SPEC "Copy and language", glossary) and the words that must not stand in for them.
 * `tests/copy.test.ts` reads every module in `src/copy/` and fails on:
 *   - a banned word below;
 *   - a service name spelled differently from the registry (`src/lib/services.ts`), e.g. "Dingdong" or
 *     "Curhat Yuk" without its "!";
 *   - capitals the app adds itself: a capitalised word mid-sentence that isn't a name listed here, or an
 *     all-capitals word that isn't a listed acronym.
 * Add terms in their own commit (WORKER-RULES, "Shared files").
 */

/** One term per concept. */
export const HOUSE_TERMS = [
  'PIPS!',
  'Beranda',
  'Pengumuman',
  'Umumkan ulang',
  'Kalender',
  'Acara',
  'Batas waktu',
  'Perlu ditindaklanjuti',
  'Pintasan',
  'Layanan',
  'Form',
  'Mata kuliah',
  'Mata kuliahku',
  'Notifikasi',
  'perangkat ini',
  'Pasang PIPS!',
  'Profil',
  'Masuk',
  'Keluar',
  'Kelola',
  'Magang SPARTA',
  'Data SPARTA Magang',
  'Live Counting & Rekap Form',
] as const;

/** Words that must not appear in their place, with the term to use instead. Matched as whole words, any case. */
export const BANNED_TERMS: ReadonlyArray<
  readonly [banned: string, use: string]
> = [
  ['HMIF App', 'PIPS!'],
  ['Home', 'Beranda'],
  ['Timeline', 'Pengumuman'],
  ['Announcement', 'Pengumuman'],
  ['Reannounce', 'Umumkan ulang'],
  ['Calendar', 'Kalender'],
  ['Settings', 'Profil'],
  ['Pengaturan', 'Profil'],
  ['Log in', 'Masuk'],
  ['Login', 'Masuk'],
  ['Log out', 'Keluar'],
  ['Logout', 'Keluar'],
  ['Sign in', 'Masuk'],
  ['Sign out', 'Keluar'],
  ['HP ini', 'perangkat ini'],
  ['Install', 'Pasang PIPS!'],
  ['Instal', 'Pasang PIPS!'],
  ['Notification', 'Notifikasi'],
  ['Notifications', 'Notifikasi'],
  ['Materi kuliah', 'Ding Dong'],
  ['Cari NIM', 'NIM Finder'],
  ['Testimoni matkul', 'Testi Matkul'],
  ['Tandai semua dibaca', '(the app has no "mark all read")'],
  ['Admin Dashboard', 'Kelola'],
  ['Dashboard Admin', 'Kelola'],
  ['Anda', 'kamu'],
];

/**
 * Names that keep their capitals mid-sentence: places, programmes, organisations, products and the house
 * terms above. Service names come from the registry and needn't be repeated here.
 */
export const PROPER_NOUNS = [
  'PIPS!',
  'HMIF',
  'ITB',
  'Himpunan',
  'Mahasiswa',
  'Informatika',
  'Teknik',
  'Sistem',
  'Teknologi',
  'Informasi',
  'Mata',
  'Kuliah',
  'Umum',
  'Akademik',
  'Welfare',
  'Ganesha',
  'Jatinangor',
  'Google',
  'Drive',
  'WIB',
  'Beranda',
  'Pengumuman',
  'Kalender',
  'Layanan',
  'Kelola',
  'Profil',
  'Form',
  'Live',
  'Counting',
  'Rekap',
  'Magang',
  'Data',
  'Pasang',
  // P1-C: browsers and devices named in the push and Pasang PIPS! copy, and iOS's own menu words.
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Android',
  'Bagikan',
  'Tambahkan',
  'Layar',
  'Utama',
] as const;

/** All-capitals words the app may show. Anything else in capitals is capitals the app added itself. */
export const ACRONYMS = [
  'PIPS',
  'HMIF',
  'ITB',
  'NIM',
  'SPARTA',
  'PIXEL',
  'IF',
  'STI',
  'WIB',
  'SKS',
  'UTS',
  'UAS',
  'CSV',
  'CTF',
  'UI',
  'UX',
  'IT',
  // P1-C: the LINE app, whose in-app browser can't install PIPS!.
  'LINE',
] as const;
