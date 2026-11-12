/**
 * The house terms and the words that must not stand in for them.
 * `tests/copy.test.ts` reads every module in `src/copy/` and fails on:
 *   - a banned word below;
 *   - a service name spelled differently from the registry (`src/lib/services.ts`), e.g. "Dingdong" or
 *     "Curhat Yuk" without its "!";
 *   - capitals the app adds itself: a capitalised word mid-sentence that isn't a name listed here, or an
 *     all-capitals word that isn't a listed acronym.
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
  // Browsers and devices named in the push and Pasang PIPS! copy, and iOS's own menu words.
  'Chrome',
  'Edge',
  'Firefox',
  'Safari',
  'Android',
  'Bagikan',
  'Tambahkan',
  'Layar',
  'Utama',
  'Tambah',
  // The student email format members sign in with.
  'NIM@std.stei.itb.ac.id',
  // The day-before reminder ("pengingat H-1").
  'H-1',
  // Testi Matkul's "Review Dosen" section and its "Mata Kuliah Pilihan" list.
  'Dosen',
  'Pilihan',
  // The composer's audience choice, named in its errors ("atau ganti ke Semua").
  'Semua',
  // Event titles the add-event form quotes as examples ("Kuis 2", "Deadline Tugas Besar 1",
  // "Rapat Anggota HMIF"), and Testi Matkul's author name for an unnamed one ("Anonim").
  'Kuis',
  'Deadline',
  'Tugas',
  'Besar',
  'Rapat',
  'Anggota',
  'Anonim',
] as const;

/**
 * Other products' names that contain a banned word (the event detail's "Google Calendar" button). The phrase as a whole is allowed; the banned word alone still isn't.
 */
export const PRODUCT_NAMES = ['Google Calendar'] as const;

/**
 * Whole phrases that write a house name another way on purpose: sign-in's greeting "Halo, Pips!" (HMIF calls
 * itself "Pips"). "Pips" anywhere else is still caught.
 */
export const HOUSE_PHRASES = ['Halo, Pips!'] as const;

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
  // The LINE app, whose in-app browser can't install PIPS!.
  'LINE',
  // Magang SPARTA asks for your ID LINE.
  'ID',
  // The upload limit, "maks. 25 MB" (lib/upload-policy.ts).
  'MB',
] as const;
