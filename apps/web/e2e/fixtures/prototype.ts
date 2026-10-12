/**
 * The locked Garis v4 prototype's sample data, ported as is from
 * ops/ui-revamp-review/runtime/extra/garis-v4/locked-2026-10-12/source/garis/data.js.
 *
 * This file keeps the prototype's own shapes so a reviewer can compare it line by line with data.js.
 * `api.ts` turns it into the real API's shapes. Where the two disagree, see NOTES.md.
 */

/** Wall-clock time in Asia/Jakarta (WIB, UTC+7), as an ISO string in UTC. */
export function wib(
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  year = 2026,
): string {
  return new Date(
    Date.UTC(year, month - 1, day, hour - 7, minute),
  ).toISOString();
}

/** The prototype's "now": Kamis, 8 Oktober 2026, 13.35 WIB (see NOTES.md for why the harness uses it). */
export const NOW = wib(10, 8, 13, 35);
export const SEMESTER = {
  year: 2026,
  code: 'Ganjil' as const,
  label: 'Ganjil 2026/2027',
};

export const ANGKATAN: { year: number; name: string | null }[] = [
  { year: 2019, name: 'Async' },
  { year: 2020, name: 'Init' },
  { year: 2021, name: 'Sudo' },
  { year: 2022, name: 'Byte' },
  { year: 2023, name: null },
  { year: 2024, name: null },
  { year: 2025, name: 'PIXEL' },
];

export const ROLE_NAMES = {
  welfarenakademik: 'Welfare and Academics',
  akademik: 'Akademik',
  welfare: 'Welfare',
  de: 'DE',
  admin: 'Admin',
  cnc: 'Competition and Community',
  cardev: 'Career Development',
  ring1: 'Ring 1 DE',
  curhatadmin: 'Curhat Admin',
  peoplemanage: 'People Management',
} as const;
export type RoleKey = keyof typeof ROLE_NAMES;

export type PersonaKey = 'anggota' | 'pengurus';
export interface Persona {
  key: PersonaKey;
  name: string;
  nim: string;
  major: 'IF' | 'STI';
  angkatan: number;
  kampus: 'Ganesha' | 'Jatinangor';
  status: string;
  semester: number;
  roles: RoleKey[];
}
export const PERSONAS: Record<PersonaKey, Persona> = {
  anggota: {
    key: 'anggota',
    name: 'Nadia Putri',
    nim: '13525045',
    major: 'IF',
    angkatan: 2025,
    kampus: 'Ganesha',
    status: 'Anggota Biasa',
    semester: 3,
    roles: [],
  },
  pengurus: {
    key: 'pengurus',
    name: 'Raka Pratama',
    nim: '13524087',
    major: 'IF',
    angkatan: 2024,
    kampus: 'Ganesha',
    status: 'Anggota Biasa',
    semester: 5,
    roles: ['welfarenakademik', 'akademik', 'de', 'admin'],
  },
};
export const email = (nim: string) => `${nim}@std.stei.itb.ac.id`;

export interface ProtoCourse {
  code: string;
  name: string;
  sks: number;
  major: 'IF' | 'STI' | 'OTHER';
  sem: number;
  drive: boolean;
}
export const COURSES: ProtoCourse[] = (
  [
    ['IF2110', 'Algoritma dan Pemrograman II', 3, 'IF', 3],
    ['IF2120', 'Probabilitas dan Statistika', 3, 'IF', 3],
    ['IF2123', 'Aljabar Linier dan Geometri', 3, 'IF', 3],
    ['IF2130', 'Sistem Operasi', 3, 'IF', 3],
    ['IF2150', 'Rekayasa Perangkat Lunak', 4, 'IF', 3],
    ['IF2180', 'Socio-informatika dan Profesionalisme', 2, 'IF', 3],
    ['IF2211', 'Strategi Algoritma', 3, 'IF', 4],
    ['IF2224', 'Teori Bahasa Formal dan Otomata', 4, 'IF', 4],
    ['IF2230', 'Jaringan Komputer', 3, 'IF', 4],
    ['IF2240', 'Basis Data', 3, 'IF', 4],
    ['IF3150', 'Manajemen Proyek Perangkat Lunak', 2, 'IF', 4],
    ['IF3110', 'Pengembangan Aplikasi Berbasis Web', 3, 'IF', 5],
    ['IF3130', 'Sistem Paralel dan Terdistribusi', 3, 'IF', 5],
    ['IF3140', 'Sistem Basis Data', 3, 'IF', 5],
    ['IF3141', 'Sistem Informasi', 3, 'IF', 5],
    ['IF3151', 'Interaksi Manusia Komputer', 3, 'IF', 5],
    ['IF3170', 'Inteligensi Buatan', 4, 'IF', 5],
    ['IF3210', 'Pengembangan Aplikasi Piranti Bergerak', 2, 'IF', 6],
    ['IF3250', 'Proyek Perangkat Lunak', 4, 'IF', 6],
    ['IF3270', 'Pembelajaran Mesin', 3, 'IF', 6],
    ['IF4020', 'Kriptografi', 3, 'IF', 0],
    ['IF4061', 'Visualisasi Data dan Informasi', 3, 'IF', 0],
    ['IF4010', 'Pemrograman Unit Pemrosesan Grafis', 3, 'IF', 0, false],
    ['II2110', 'Matematika Diskret', 3, 'STI', 3],
    ['II2120', 'Jaringan Komputer', 3, 'STI', 3],
    ['II2130', 'Sistem dan Arsitektur Komputer', 3, 'STI', 3],
    ['IF2040', 'Pemodelan Basis Data', 3, 'STI', 3],
    ['DP3011', 'Berpikir Desain', 3, 'OTHER', 0],
    ['DK3014', 'Psikologi Persepsi', 3, 'OTHER', 0],
    ['BI2001', 'Pengetahuan Lingkungan', 2, 'OTHER', 0],
  ] as [string, string, number, ProtoCourse['major'], number, boolean?][]
).map(([code, name, sks, major, sem, drive = true]) => ({
  code,
  name,
  sks,
  major,
  sem,
  drive,
}));

/** Courses each sample member set for this semester, with their class (K1–K3). */
export const MY_COURSES: Record<PersonaKey, [string, number][]> = {
  anggota: [
    ['IF2110', 2],
    ['IF2120', 2],
    ['IF2123', 1],
    ['IF2130', 2],
    ['IF2150', 2],
    ['IF2180', 3],
  ],
  pengurus: [
    ['IF3110', 1],
    ['IF3130', 1],
    ['IF3140', 2],
    ['IF3141', 1],
    ['IF3151', 2],
    ['IF3170', 1],
  ],
};

export interface ProtoEvent {
  id: string;
  cat: 'himpunan' | 'akademik';
  code?: string;
  title: string;
  s: string;
  e: string;
  desc: string;
}
export const EVENTS: ProtoEvent[] = [
  {
    id: 'h1',
    cat: 'himpunan',
    title: 'Sharing Session: Magang di Startup',
    s: wib(10, 8, 19),
    e: wib(10, 8, 21),
    desc: 'Bareng tiga alumni IF dan STI yang sekarang kerja di startup. Auditorium CC Timur, terbuka untuk semua angkatan.',
  },
  {
    id: 'h2',
    cat: 'himpunan',
    title: 'Bakti Sosial HMIF',
    s: wib(10, 10, 8),
    e: wib(10, 10, 12),
    desc: 'Kumpul di selasar Labtek V pukul 07.30. Pakai kaus HMIF.',
  },
  {
    id: 'h3',
    cat: 'himpunan',
    title: 'Rapat Anggota HMIF',
    s: wib(10, 15, 19),
    e: wib(10, 15, 21),
    desc: 'Laporan tengah periode kepengurusan. Daring; tautan dikirim lewat pengumuman.',
  },
  {
    id: 'h4',
    cat: 'himpunan',
    title: 'Dies Natalis HMIF ke-44',
    s: wib(11, 10, 18),
    e: wib(11, 10, 21),
    desc: 'Merayakan 44 tahun HMIF ITB, yang berdiri 10 November 1982.',
  },
  // Nadia, semester 3
  {
    id: 'a1',
    cat: 'akademik',
    code: 'IF2120',
    title: 'Kuis 1',
    s: wib(10, 7, 9),
    e: wib(10, 7, 10),
    desc: 'Bab 1–3. Boleh bawa kalkulator.',
  },
  {
    id: 'a2',
    cat: 'akademik',
    code: 'IF2123',
    title: 'Kuis 2',
    s: wib(10, 8, 15),
    e: wib(10, 8, 16, 40),
    desc: 'Determinan dan balikan matriks.',
  },
  {
    id: 'a3',
    cat: 'akademik',
    code: 'IF2110',
    title: 'Deadline Tugas Besar 1',
    s: wib(10, 9, 23, 59),
    e: wib(10, 9, 23, 59),
    desc: 'Kumpulkan di Edunex. Satu kelompok tiga orang.',
  },
  {
    id: 'a4',
    cat: 'akademik',
    code: 'IF2130',
    title: 'Praktikum 2',
    s: wib(10, 12, 13),
    e: wib(10, 12, 15),
    desc: 'Modul 2: penjadwalan proses.',
  },
  {
    id: 'a5',
    cat: 'akademik',
    code: 'IF2150',
    title: 'Deadline Milestone 1',
    s: wib(10, 14, 23, 59),
    e: wib(10, 14, 23, 59),
    desc: 'Dokumen kebutuhan perangkat lunak, kumpulkan di Edunex.',
  },
  {
    id: 'a6',
    cat: 'akademik',
    code: 'IF2110',
    title: 'UTS',
    s: wib(10, 19, 9),
    e: wib(10, 19, 11),
    desc: 'Ruang dibagi per kelas; cek pengumuman jadwal UTS.',
  },
  {
    id: 'a7',
    cat: 'akademik',
    code: 'IF2123',
    title: 'UTS',
    s: wib(10, 20, 13),
    e: wib(10, 20, 15),
    desc: 'Bawa KTM.',
  },
  {
    id: 'a8',
    cat: 'akademik',
    code: 'IF2120',
    title: 'UTS',
    s: wib(10, 21, 9),
    e: wib(10, 21, 11),
    desc: 'Boleh bawa kalkulator dan satu lembar catatan.',
  },
  {
    id: 'a9',
    cat: 'akademik',
    code: 'IF2130',
    title: 'UTS',
    s: wib(10, 22, 13),
    e: wib(10, 22, 15),
    desc: 'Bawa KTM.',
  },
  {
    id: 'a10',
    cat: 'akademik',
    code: 'IF2150',
    title: 'UTS',
    s: wib(10, 23, 9),
    e: wib(10, 23, 11),
    desc: 'Bawa KTM.',
  },
  // Raka, semester 5
  {
    id: 'b1',
    cat: 'akademik',
    code: 'IF3170',
    title: 'Kuis 1',
    s: wib(10, 8, 10),
    e: wib(10, 8, 11),
    desc: 'Pencarian dan heuristik.',
  },
  {
    id: 'b2',
    cat: 'akademik',
    code: 'IF3110',
    title: 'Deadline Tugas Besar 1',
    s: wib(10, 9, 23, 59),
    e: wib(10, 9, 23, 59),
    desc: 'Aplikasi web monolitik. Kumpulkan tautan repositori di Edunex.',
  },
  {
    id: 'b3',
    cat: 'akademik',
    code: 'IF3151',
    title: 'Deadline Tugas 2',
    s: wib(10, 13, 23, 59),
    e: wib(10, 13, 23, 59),
    desc: 'Laporan evaluasi heuristik, kumpulkan di Edunex.',
  },
  {
    id: 'b4',
    cat: 'akademik',
    code: 'IF3140',
    title: 'Praktikum 3',
    s: wib(10, 12, 15),
    e: wib(10, 12, 17),
    desc: 'Indeks dan optimasi kueri.',
  },
  {
    id: 'b5',
    cat: 'akademik',
    code: 'IF3140',
    title: 'UTS',
    s: wib(10, 19, 13),
    e: wib(10, 19, 15),
    desc: 'Bawa KTM.',
  },
  {
    id: 'b6',
    cat: 'akademik',
    code: 'IF3130',
    title: 'UTS',
    s: wib(10, 20, 9),
    e: wib(10, 20, 11),
    desc: 'Bawa KTM.',
  },
  {
    id: 'b7',
    cat: 'akademik',
    code: 'IF3170',
    title: 'UTS',
    s: wib(10, 21, 13),
    e: wib(10, 21, 15),
    desc: 'Bawa KTM.',
  },
  {
    id: 'b8',
    cat: 'akademik',
    code: 'IF3151',
    title: 'UTS',
    s: wib(10, 22, 9),
    e: wib(10, 22, 11),
    desc: 'Bawa KTM.',
  },
  {
    id: 'b9',
    cat: 'akademik',
    code: 'IF3141',
    title: 'UTS',
    s: wib(10, 23, 13),
    e: wib(10, 23, 15),
    desc: 'Bawa KTM.',
  },
];

export interface ProtoCategory {
  id: string;
  name: string;
  roles: RoleKey[] | null;
  required: boolean;
}
export const CATEGORIES: ProtoCategory[] = [
  { id: 'akademik', name: 'Akademik', roles: ['akademik'], required: false },
  { id: 'himpunan', name: 'Himpunan', roles: ['de'], required: true },
  { id: 'lomba', name: 'Lomba', roles: ['cnc'], required: false },
  {
    id: 'beasiswa',
    name: 'Beasiswa',
    roles: ['welfare', 'welfarenakademik'],
    required: false,
  },
  { id: 'karier', name: 'Karier', roles: ['cardev'], required: false },
  { id: 'umum', name: 'Umum', roles: null, required: false },
];

export interface ProtoPerson {
  name: string;
  nim: string;
  ang: number;
  gender: 'F' | 'M';
}
export const PEOPLE = {
  raka: { name: 'Raka Pratama', nim: '13524087', ang: 2024, gender: 'M' },
  nadia: { name: 'Nadia Putri', nim: '13525045', ang: 2025, gender: 'F' },
  salsa: { name: 'Salsabila Rahman', nim: '18224031', ang: 2024, gender: 'F' },
  dimas: { name: 'Dimas Aditya', nim: '13523044', ang: 2023, gender: 'M' },
  aulia: { name: 'Aulia Rahma', nim: '13524110', ang: 2024, gender: 'F' },
  kevin: { name: 'Kevin Wijaya', nim: '18223062', ang: 2023, gender: 'M' },
  bima: { name: 'Bima Santoso', nim: '13525071', ang: 2025, gender: 'M' },
  tasya: { name: 'Tasya Amelia', nim: '18225012', ang: 2025, gender: 'F' },
} satisfies Record<string, ProtoPerson>;
export type PersonKey = keyof typeof PEOPLE;
export const PERSON_OF: Record<PersonaKey, PersonKey> = {
  anggota: 'nadia',
  pengurus: 'raka',
};

/** The six reactions, in the prototype's order. */
export const REACTIONS = [
  'grin',
  'heart-eyes',
  'fire',
  'cry',
  'screaming',
  'party',
] as const;
export type ReactionKey = (typeof REACTIONS)[number];
type Reacts = Partial<Record<ReactionKey, number>>;

export interface ProtoComment {
  by: PersonKey;
  at: string;
  text: string;
  reacts: Reacts;
}
export interface ProtoPost {
  id: string;
  by: PersonKey;
  at: string;
  notified: string;
  title: string;
  body: string;
  link?: { kind: 'sheet' | 'gform' | 'web'; host: string; title: string };
  media?: number;
  cats: string[];
  aud:
    | { type: 'all' }
    | { type: 'angkatan'; values: number[] }
    | { type: 'group'; values: RoleKey[] };
  reacts: Reacts;
  comments: ProtoComment[];
}
export const POSTS: ProtoPost[] = [
  {
    id: 'p1',
    by: 'raka',
    at: wib(10, 8, 12, 30),
    notified: wib(10, 8, 12, 30),
    title: 'Jadwal UTS Ganjil 2026/2027 sudah keluar',
    body: 'UTS berlangsung Senin, 19 Oktober sampai Jumat, 23 Oktober 2026. Jadwal per mata kuliah, termasuk pembagian ruang untuk kelas paralel, ada di spreadsheet berikut.\n\nKalau ada jadwal yang bentrok, tulis di komentar dengan kode mata kuliah dan kelasmu. UTS juga sudah masuk ke Kalender untuk mata kuliah yang kamu atur.',
    link: {
      kind: 'sheet',
      host: 'docs.google.com',
      title: 'Jadwal UTS Ganjil 2026/2027',
    },
    cats: ['akademik'],
    aud: { type: 'all' },
    reacts: { cry: 12, screaming: 7, fire: 3, grin: 2 },
    comments: [
      {
        by: 'bima',
        at: wib(10, 8, 12, 55),
        text: 'Kak, IF2123 K01 sama K02 ruangnya beda ya?',
        reacts: {},
      },
      {
        by: 'raka',
        at: wib(10, 8, 13, 10),
        text: 'Iya, K01 di GKU Timur, K02 di Labtek V. Cek tab kedua di spreadsheet ya.',
        reacts: { 'heart-eyes': 2 },
      },
    ],
  },
  {
    id: 'p2',
    by: 'salsa',
    at: wib(10, 8, 10, 40),
    notified: wib(10, 8, 10, 40),
    title: 'Cari tim Gemastik XIX? Isi form ini',
    body: 'Pendaftaran Gemastik XIX dibuka sampai 20 Oktober. Belum punya tim? Isi form di bawah, nanti kami pasangkan dengan teman lintas angkatan yang bidangnya sama.\n\nDetail lomba dan bidangnya ada di Info Lomba.',
    link: {
      kind: 'gform',
      host: 'docs.google.com/forms',
      title: 'Formulir Cari Tim Gemastik XIX',
    },
    cats: ['lomba'],
    aud: { type: 'all' },
    reacts: { fire: 18, party: 4, 'heart-eyes': 3 },
    comments: [],
  },
  {
    id: 'p3',
    by: 'aulia',
    at: wib(10, 7, 19, 40),
    notified: wib(10, 7, 19, 40),
    title: 'PIXEL, isi Form Analisis Kondisi ya!',
    body: 'Halo PIXEL! HMIF mau kenalan lebih dekat supaya kegiatan santai dan jalan-jalan bareng HMIF makin pas sama yang kalian suka. Formnya ada di PIPS!: Layanan, lalu Form. Ada 5 bagian, kurang lebih 10 menit.',
    cats: ['himpunan'],
    aud: { type: 'angkatan', values: [2025] },
    reacts: { 'heart-eyes': 9, grin: 6 },
    comments: [],
  },
  {
    id: 'p4',
    by: 'dimas',
    at: wib(10, 7, 16, 5),
    notified: wib(10, 7, 16, 5),
    title: '',
    body: 'Info beasiswa bulan Oktober sudah diperbarui di Mading Beasiswa: ada 4 beasiswa baru, dua di antaranya terbuka untuk angkatan 2024 dan 2025. Syarat dan tenggatnya ada di s.hmif.dev/MadingBeasiswa',
    link: { kind: 'web', host: 's.hmif.dev', title: 'Mading Beasiswa HMIF' },
    cats: ['beasiswa'],
    aud: { type: 'all' },
    reacts: { 'heart-eyes': 11, fire: 2 },
    comments: [],
  },
  {
    id: 'p5',
    by: 'raka',
    at: wib(10, 6, 20, 15),
    notified: wib(10, 6, 20, 15),
    title: 'Rapat koordinasi divisi Akademik',
    body: 'Rapat koordinasi Jumat, 9 Oktober pukul 19.00 di Sekretariat HMIF. Agenda: pembagian rekap jadwal UTS dan persiapan Testi Matkul semester depan.',
    cats: ['himpunan'],
    aud: { type: 'group', values: ['akademik'] },
    reacts: { grin: 3 },
    comments: [],
  },
  {
    id: 'p6',
    by: 'kevin',
    at: wib(10, 5, 10, 0),
    notified: wib(10, 5, 10, 0),
    title: 'Sharing Session: Magang di Startup',
    body: 'Kamis, 8 Oktober pukul 19.00 di Auditorium CC Timur, bareng tiga alumni IF dan STI yang sekarang kerja di startup. Terbuka untuk semua angkatan dan sudah ada di Kalender.',
    media: 1,
    cats: ['karier'],
    aud: { type: 'all' },
    reacts: { fire: 21, 'heart-eyes': 8, party: 3 },
    comments: [],
  },
  {
    id: 'p7',
    by: 'bima',
    at: wib(10, 5, 8, 20),
    notified: wib(10, 5, 8, 20),
    title: 'Ketinggalan jaket abu-abu di GKU Timur',
    body: 'Hoodie abu-abu, ada tulisan ITB kecil di dada. Ketinggalan di GKU Timur ruang 9301 Senin pagi. Kalau ada yang lihat, kabari aku ya. Makasih!',
    cats: ['umum'],
    aud: { type: 'all' },
    reacts: { cry: 2, grin: 1 },
    comments: [
      {
        by: 'tasya',
        at: wib(10, 5, 9, 2),
        text: 'Kayaknya ada di pos satpam GKU Timur, coba cek ke sana.',
        reacts: { grin: 1 },
      },
    ],
  },
];
/** Which posts each sample member had already read when the prototype opens. */
export const READ0: Record<PersonaKey, string[]> = {
  anggota: ['p6', 'p7'],
  pengurus: ['p1', 'p4', 'p5', 'p6', 'p7'],
};

export type LombaCategory =
  | 'Competitive Programming'
  | 'Capture The Flag'
  | 'Data Science / Data Analytics'
  | 'UI/UX'
  | 'Game Development'
  | 'Business IT Case'
  | 'Innovation'
  | 'Web Development';
export interface ProtoLomba {
  id: string;
  name: string;
  org: string;
  cats: LombaCategory[];
  open: string;
  close: string;
  price: number;
}
export const LOMBA: ProtoLomba[] = [
  {
    id: 'l2',
    name: 'COMPFEST 18: Capture The Flag',
    org: 'Universitas Indonesia',
    cats: ['Capture The Flag'],
    open: wib(9, 21),
    close: wib(10, 14, 23, 59),
    price: 150000,
  },
  {
    id: 'l1',
    name: 'Gemastik XIX',
    org: 'Puspresnas',
    cats: [
      'Competitive Programming',
      'Data Science / Data Analytics',
      'UI/UX',
      'Capture The Flag',
    ],
    open: wib(10, 1),
    close: wib(10, 20, 23, 59),
    price: 0,
  },
  {
    id: 'l3',
    name: 'Hology 2026: UI/UX Design',
    org: 'Universitas Brawijaya',
    cats: ['UI/UX'],
    open: wib(9, 28),
    close: wib(10, 25, 23, 59),
    price: 100000,
  },
  {
    id: 'l4',
    name: 'Find IT! 2026',
    org: 'Universitas Gadjah Mada',
    cats: ['Competitive Programming', 'Web Development'],
    open: wib(10, 5),
    close: wib(11, 2, 23, 59),
    price: 0,
  },
];

export type ProtoTesti =
  | { by: string; overview: string; tugas: string; dosen: string }
  | { by: string; kesan: string; tantangan: string; saran: string };
export const TESTI: Record<string, ProtoTesti[]> = {
  IF2123: [
    {
      by: 'Anonim',
      overview:
        'Matriks, determinan, ruang vektor, sampai transformasi geometri. Banyak hitungan, tapi polanya konsisten.',
      tugas:
        'Dua tugas besar pemrograman (misalnya sistem persamaan linier) dan kuis berkala.',
      dosen:
        'Contoh soalnya dekat dengan soal ujian. Catat langkah, bukan cuma jawaban.',
    },
    {
      by: 'Nabila, IF 2024',
      overview: 'Konsepnya jadi dasar grafika dan pembelajaran mesin nanti.',
      tugas: 'Tubes dikerjakan berkelompok; laporan dinilai cukup detail.',
      dosen: 'Sering membuka sesi tanya jawab sebelum ujian.',
    },
  ],
  IF2130: [
    {
      by: 'Anonim',
      overview:
        'Proses, penjadwalan, memori, dan sistem berkas. Praktikumnya membuat konsep terasa nyata.',
      tugas:
        'Praktikum rutin dan satu tugas besar membuat bagian dari kernel sederhana.',
      dosen: 'Penjelasannya runtut; slide cukup untuk belajar ulang.',
    },
    {
      by: 'Galih, IF 2023',
      overview:
        'Butuh terbiasa dengan Linux dan C. Mulai praktik dari minggu pertama.',
      tugas:
        'Tubes paling menyita waktu di semester 3, jadi bagi tugas sejak awal.',
      dosen: 'Responsif di Edunex.',
    },
  ],
  IF2150: [
    {
      by: 'Anonim',
      overview:
        'Belajar proses pengembangan perangkat lunak dari kebutuhan sampai pengujian, berkelompok.',
      tugas: 'Proyek satu semester dengan beberapa milestone dokumen dan demo.',
      dosen:
        'Menilai proses, bukan cuma hasil akhir. Dokumentasikan keputusanmu.',
    },
  ],
  IF2110: [
    {
      by: 'Anonim',
      overview:
        'Lanjutan Dasar Pemrograman: ADT dan struktur data di C. Ritmenya cepat, tapi aman kalau rajin latihan soal praktikum.',
      tugas:
        'Praktikum tiap minggu, dua tugas besar berkelompok (salah satunya game berbasis terminal), dan kuis.',
      dosen:
        'Penjelasan pointer dan alokasi memori jelas. Sering kasih contoh soal ujian tahun lalu.',
    },
    {
      by: 'Fikri, IF 2023',
      overview:
        'Banyak praktik. Konsep list berkait dan pohon jadi kepakai terus di semester berikutnya.',
      tugas:
        'Tugas besar butuh pembagian kerja yang rapi; pakai Git dari awal.',
      dosen: 'Responsif di forum Edunex. Datang ke asistensi kalau mentok.',
    },
    {
      by: 'Anonim',
      overview:
        'Berat di awal kalau belum terbiasa C, tapi slide dan modul praktikumnya lengkap.',
      tugas: 'Kuis kecil hampir tiap dua minggu.',
      dosen: 'Tegas soal tenggat, jadi jangan menunda.',
    },
  ],
  II2110: [
    {
      by: 'Anonim',
      kesan: 'Seru kalau suka logika. Banyak latihan pembuktian.',
      tantangan: 'Induksi dan relasi rekurens butuh waktu untuk terbiasa.',
      saran:
        'Kerjakan latihan di buku setiap minggu, jangan cuma menjelang ujian.',
    },
    {
      by: 'Rani, STI 2024',
      kesan: 'Materinya rapi dan berurutan.',
      tantangan: 'Kombinatorika sering menjebak di soal cerita.',
      saran: 'Bikin rangkuman rumus sendiri dan diskusi bareng teman.',
    },
  ],
};

/** NIM Finder: fictional members to search. */
export const MEMBERS: [string, string, 'IF' | 'STI'][] = [
  ['Raka Pratama', '13524087', 'IF'],
  ['Rakai Prasetyo', '18225019', 'STI'],
  ['Rahma Lestari', '13523090', 'IF'],
  ['Bima Santoso', '13525071', 'IF'],
  ['Tasya Amelia', '18225012', 'STI'],
  ['Salsabila Rahman', '18224031', 'STI'],
  ['Dimas Aditya', '13523044', 'IF'],
  ['Aulia Rahma', '13524110', 'IF'],
  ['Kevin Wijaya', '18223062', 'STI'],
  ['Nadia Putri', '13525045', 'IF'],
  ['Farhan Akbar', '13525003', 'IF'],
  ['Putri Maharani', '18225044', 'STI'],
];

export interface ProtoMessage {
  id: string;
  me: boolean;
  at: string;
  text: string;
  reply?: string;
  unread?: boolean;
}
export const ROOMS: Record<
  PersonaKey,
  { id: string; title: string; msgs: ProtoMessage[] }[]
> = {
  anggota: [
    {
      id: 'r1',
      title: 'Teal Koala',
      msgs: [
        {
          id: 'm1',
          me: true,
          at: wib(10, 5, 21, 10),
          text: 'Kak, aku lagi kewalahan bagi waktu antara tubes sama kepanitiaan. Normal nggak sih?',
        },
        {
          id: 'm2',
          me: false,
          at: wib(10, 6, 9, 5),
          text: 'Normal banget kok, banyak yang ngerasain hal yang sama di semester 3. Boleh cerita, tenggat terdekatmu apa aja?',
        },
        {
          id: 'm3',
          me: true,
          at: wib(10, 6, 12, 30),
          text: 'Tubes 1 IF2110 Jumat ini, terus rapat kepanitiaan tiap Rabu malam.',
        },
        {
          id: 'm4',
          me: false,
          at: wib(10, 8, 10, 12),
          reply: 'm3',
          text: 'Oke, coba kita susun bareng ya. Mau aku bantu bikin jadwal mingguan sampai UTS?',
          unread: true,
        },
      ],
    },
    {
      id: 'r2',
      title: 'Amber Heron',
      msgs: [
        {
          id: 'm5',
          me: true,
          at: wib(9, 14, 20, 0),
          text: 'Makasih kak udah dengerin kemarin, aku udah lebih lega.',
        },
        {
          id: 'm6',
          me: false,
          at: wib(9, 14, 20, 30),
          text: 'Sama-sama! Kapan pun mau cerita lagi, ruang ini tetap ada.',
        },
      ],
    },
  ],
  pengurus: [],
};

export interface ProtoQuestion {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'rating';
  options?: string[];
  dependsOn?: [string, string];
  optional?: boolean;
  hint?: string;
}
const OTHER_NOTE =
  'Sebutkan yang kamu maksud. (Kalau belum punya jawaban pasti, isi tanda "-".)';
/** "Form Analisis Kondisi PIXEL" as the prototype shows it. Section ids come from the real seed. */
export const PIXEL_FORM = {
  id: 'pixel',
  slug: 'pixel-analisis-kondisi-2025',
  angkatan: [2025],
  title: 'Form Analisis Kondisi PIXEL',
  opensAt: wib(9, 12, 13),
  desc: 'Bantu HMIF kenalan lebih dekat sama kamu, angkatan 2025 — biar kegiatan santai & jalan-jalan bareng HMIF makin pas sama yang kamu suka!',
  sections: [
    {
      id: 'identitas',
      title: 'Identitas',
      qs: [
        { id: 'q1', label: 'Hai dengan siapa di sini?', type: 'text' },
        { id: 'q2', label: 'Mau tau nim kamu dong', type: 'text' },
        {
          id: 'q3',
          label: 'Dari angkatan mana nih?',
          type: 'radio',
          options: ['PIXEL'],
        },
        {
          id: 'q4',
          label: 'Jurusan IF/STI deh?',
          type: 'radio',
          options: ['IF', 'STI'],
        },
        {
          id: 'q5',
          label: 'Kelas berapa tuh?',
          type: 'radio',
          options: ['IF K1', 'IF K2', 'IF K3', 'STI Genap', 'STI Ganjil'],
        },
      ],
    },
    {
      id: 'kegiatan-suka',
      title: 'Biasanya kamu suka kegiatan apa?',
      qs: [
        {
          id: 'q6',
          label: 'Saat waktu luang, kegiatan apa yang paling kamu suka?',
          type: 'checkbox',
          options: [
            'Main game',
            'Menonton film atau serial',
            'Mendengarkan musik',
            'Olahraga',
            'Membaca',
            'Jalan-jalan',
            'Istirahat',
            'Other',
          ],
        },
        {
          id: 'q22',
          label: OTHER_NOTE,
          type: 'text',
          dependsOn: ['q6', 'Other'],
        },
        {
          id: 'q8',
          label:
            'Selama ikut kegiatan HMIF atau SPARTA, kegiatan atau momen apa yang paling kamu suka?',
          type: 'textarea',
        },
      ],
    },
    {
      id: 'kegiatan-santai-hmif',
      title: 'Kegiatan santai bareng HMIF',
      qs: [
        {
          id: 'q9',
          label:
            'Apa yang bikin kamu nantinya tertarik ikut kegiatan santai HMIF?',
          type: 'checkbox',
          options: [
            'Kegiatannya sesuai minat',
            'Ada teman yang ikut',
            'Ingin kenal warga HMIF lain',
            'Waktunya cocok',
            'Tempatnya mudah dijangkau',
            'Biayanya terjangkau',
            'Belum tertarik ikut :<',
            'Other',
          ],
        },
        {
          id: 'q24',
          label: OTHER_NOTE,
          type: 'text',
          dependsOn: ['q9', 'Other'],
        },
        {
          id: 'q12',
          label:
            'Kapan kamu biasanya punya waktu untuk ikut kegiatan santai HMIF?',
          type: 'textarea',
        },
      ],
    },
    {
      id: 'jalan-jalan-hmif',
      title: 'Jalan-jalan bareng HMIF',
      qs: [
        {
          id: 'q16',
          label:
            'Kalau jalan-jalan bareng HMIF diadakan setelah libur semester, apakah kamu tertarik ikut?',
          type: 'radio',
          options: ['Tertarik', 'Belum bisa memastikan', 'Tidak tertarik'],
        },
        {
          id: 'q17',
          label: 'Jika tidak tertarik, kenapa?',
          type: 'textarea',
          dependsOn: ['q16', 'Tidak tertarik'],
        },
        {
          id: 'q18',
          label:
            'Kira-kira acara HMIF apa yang kamu antusias banget untuk ikut kalau diadakan?',
          type: 'radio',
          options: [
            'Lomba Keinformatikaan Internal',
            'Nonton Bareng PIPS',
            'Others',
          ],
        },
        {
          id: 'q19',
          label: OTHER_NOTE,
          type: 'text',
          dependsOn: ['q18', 'Others'],
        },
      ],
    },
    {
      id: 'feedback-welpar',
      title: 'Feedback Welcoming Party 2025',
      qs: [
        {
          id: 'q29',
          label:
            'Secara keseluruhan, gimana penilaian kamu soal Welcoming Party 2025?',
          hint: '1 = sangat kurang, 5 = sangat baik',
          type: 'rating',
        },
        {
          id: 'q30',
          label:
            'Apabila ada masukan untuk Welcoming Party 2025 boleh diisi di bawah ya',
          type: 'textarea',
          optional: true,
        },
      ],
    },
  ] as { id: string; title: string; qs: ProtoQuestion[] }[],
};

/** Admin "Live Counting & Rekap Form": latest submitters of the PIXEL form (fictional). */
export const LIVE = {
  count: 142,
  latest: [
    ['13525103', 'Farah Nabila', 'IF', wib(10, 8, 13, 31)],
    ['18225077', 'Yoga Prakoso', 'STI', wib(10, 8, 13, 22)],
    ['13525088', 'Intan Permata', 'IF', wib(10, 8, 12, 58)],
    ['13525003', 'Farhan Akbar', 'IF', wib(10, 8, 12, 41)],
  ] as [string, string, 'IF' | 'STI', string][],
  q4: [
    ['IF', 96],
    ['STI', 46],
  ] as [string, number][],
  q16: [
    ['Tertarik', 81],
    ['Belum bisa memastikan', 49],
    ['Tidak tertarik', 12],
  ] as [string, number][],
};

/** Layanan: the real Home tiles' external links (FEATURES.md §12). */
export const EXTERNAL_SERVICES = [
  {
    id: 'beasiswa',
    name: 'Beasiswa',
    url: 'https://s.hmif.dev/MadingBeasiswa',
  },
  { id: 'kas', name: 'Bayar Kas!', url: 'https://s.hmif.dev/BayarKasHMIF' },
  {
    id: 'surat',
    name: 'Surat & Proposal',
    url: 'https://s.hmif.dev/LayananAdministrasiHMIF2526',
  },
  {
    id: 'lowongan',
    name: 'LowonginAja!',
    url: 'https://s.hmif.dev/LowonginAja!',
  },
];
