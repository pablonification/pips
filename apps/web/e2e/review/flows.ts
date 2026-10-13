/**
 * F1's flow catalogue: every user flow and use case the owner's review package records (F1 brief, step 3).
 *
 * One entry per flow. The flow itself is in `flows/<area>.flow.ts`, as a Playwright test per variant (person) that
 * is also a journey: each step asserts what it shows. `pnpm --filter web review record` records each flow at its
 * layouts in light, then in dark (the dark set first) as far as the day's disk budget allows.
 *
 * - `locked`: the locked prototype screens the flow passes through, as the fidelity report names them: a route
 *   screen as `<persona>-<route>` (`anggota-beranda`, from fidelity/names.mjs), or an extra screen (`i-palette`).
 * - `owners`: the task that built what the flow shows (its report names the deviations and open questions).
 * - `variants`: who the flow is recorded as. A flow with two variants gets a recording for each
 *   (`<layout>-<theme>-<variant>.mp4`).
 */

export const LAYOUTS = ['phone', 'tablet', 'desktop', 'narrow320'] as const;
export const THEMES = ['light', 'dark'] as const;
export const OWNERS = [
  'P0-A',
  'P0-B',
  'P0-C',
  'P0-D',
  'P1-A',
  'P1-B',
  'P1-C',
  'P2-A',
  'P2-B',
  'P2-C',
  'P3-A',
  'P3-B',
  'P3-C',
  'C1',
] as const;
export const AREAS = [
  { id: 'access', title: 'Access and session' },
  { id: 'shell', title: 'Shell, search and theme' },
  { id: 'beranda', title: 'Beranda' },
  { id: 'pengumuman', title: 'Pengumuman' },
  { id: 'kalender', title: 'Kalender' },
  { id: 'layanan', title: 'Layanan' },
  { id: 'form', title: 'Form and Magang SPARTA' },
  { id: 'curhat', title: 'Curhat Yuk!' },
  { id: 'profil', title: 'Profil' },
  { id: 'kelola', title: 'Kelola' },
  { id: 'states', title: 'States' },
] as const;
/** The fixtures' people (fixtures/api.ts): Nadia Putri (anggota, IF 2025 PIXEL) and Raka Pratama (pengurus). */
export const PERSONAS = ['anggota', 'pengurus', null] as const;

export type Layout = (typeof LAYOUTS)[number];
export type Theme = (typeof THEMES)[number];
export type Owner = (typeof OWNERS)[number];
export type AreaId = (typeof AREAS)[number]['id'];
export type Persona = (typeof PERSONAS)[number];

export interface Variant {
  /** File-name part and test-title part: `nadia`, `raka`, `android`, … */
  key: string;
  persona: Persona;
  /** Who, in plain words, with any override ("Nadia, no courses (override)"). */
  who: string;
  /** Only these of the flow's layouts (a platform recorded at phone size only). */
  layouts?: Layout[];
}

export interface Flow {
  id: string;
  title: string;
  area: AreaId;
  variants: Variant[];
  layouts: Layout[];
  themes: Theme[];
  /** In the dark set: recorded in dark first if not every flow fits (F1 brief, "The dark set"). */
  darkSet: boolean;
  /** SPEC user stories it shows (1–157). */
  stories: number[];
  owners: Owner[];
  /** The path it opens first. */
  startsAt: string;
  /** One sentence: what the owner should check, with the rules and the fixtures' values. */
  check: string;
  /** Locked screens it passes through (fidelity names without layout and theme). */
  locked: string[];
  /** Added by F1 because a report shows a use case the brief's tables miss: the source. */
  addedFrom?: string;
}

const NADIA: Variant = { key: 'nadia', persona: 'anggota', who: 'Nadia' };
const RAKA: Variant = { key: 'raka', persona: 'pengurus', who: 'Raka' };
const ALL: Layout[] = ['phone', 'tablet', 'desktop'];
const BOTH: Theme[] = ['light', 'dark'];

export const FLOWS: Flow[] = [
  // Access and session
  {
    id: 'signin-shared-link',
    title: 'A shared link while signed out',
    area: 'access',
    variants: [{ key: 'nadia', persona: 'anggota', who: 'Nadia, signed out' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [1, 2, 24, 47],
    owners: ['P1-C', 'P0-B'],
    startsAt: '/pengumuman/p1',
    check:
      'Signed out, the link goes to /login with the way back kept; Masuk dengan Google opens the post itself, now read; the old push path /timeline/p1 lands on the same post.',
    locked: ['anggota-post'],
  },
  {
    id: 'signin-refused',
    title: 'Sign-in refused',
    area: 'access',
    variants: [{ key: 'signed-out', persona: null, who: 'signed out' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [3],
    owners: ['P1-C'],
    startsAt: '/login',
    check:
      'When the API refuses the account (401), the message names both causes in Indonesian (the std.stei.itb.ac.id account, or not yet on HMIF’s member list), and the page doesn’t loop back into Google.',
    locked: [],
  },
  {
    id: 'phone-browser',
    title: 'A phone browser that hasn’t installed PIPS!',
    area: 'access',
    variants: [{ key: 'nadia', persona: 'anggota', who: 'Nadia, not installed' }],
    layouts: ['phone', 'tablet'],
    themes: BOTH,
    darkSet: false,
    stories: [1, 8],
    owners: ['P0-B', 'P1-C'],
    startsAt: '/',
    check:
      'The app opens straight away in a browser: no install wall (removed by design, SPEC "Removals"). Installing stays optional in Profil.',
    locked: ['anggota-beranda'],
  },
  {
    id: 'first-run',
    title: 'First run after sign-in',
    area: 'access',
    variants: [
      {
        key: 'nadia',
        persona: 'anggota',
        who: 'Nadia with no courses, push off, not installed (overrides)',
      },
    ],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [5, 7, 105],
    owners: ['P1-C'],
    startsAt: '/login',
    check:
      'Sign-in leads to /mulai, a focused flow with no tab bar: "Halo, Nadia" and steps made from Beranda’s rows. Atur opens Tambah mata kuliah with nothing pre-selected (P1-C open question 3); the step then reads Selesai. Nyalakan explains first. The Pasang PIPS! step shows only when not installed. No locked screen: built on the owner’s go (D2).',
    locked: ['anggota-matkul-add'],
  },
  {
    id: 'install',
    title: 'Pasang PIPS! on each platform',
    area: 'access',
    variants: [
      { key: 'android', persona: 'anggota', who: 'Nadia on Android Chrome', layouts: ['phone'] },
      { key: 'iphone', persona: 'anggota', who: 'Nadia on an iPhone', layouts: ['phone'] },
      { key: 'line', persona: 'anggota', who: 'Nadia in LINE’s in-app browser', layouts: ['phone'] },
      { key: 'desktop', persona: 'anggota', who: 'Nadia on a desktop browser', layouts: ['desktop'] },
    ],
    layouts: ['phone', 'desktop'],
    themes: BOTH,
    darkSet: false,
    stories: [8, 9, 10, 108],
    owners: ['P1-C'],
    startsAt: '/profil',
    check:
      'Android shows the browser’s own install prompt; the iPhone gets short Indonesian steps; LINE’s in-app browser is told to open Chrome or Safari; a desktop browser shows its own state. No locked screen: built on the owner’s go (D3).',
    locked: ['anggota-profil'],
  },
  {
    id: 'session-hiccup',
    title: 'A network hiccup, then offline',
    area: 'access',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [4, 11, 134, 135, 136],
    owners: ['P0-B'],
    startsAt: '/',
    check:
      'A dropped GET /api/me and then a 503 never sign Nadia out; the app retries. Offline, the banner gives the last update time over the cached data; back online it goes.',
    locked: ['anggota-beranda'],
  },
  {
    id: 'signout',
    title: 'Keluar',
    area: 'access',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [12],
    owners: ['P1-C'],
    startsAt: '/profil',
    check:
      'Keluar asks first (a sheet on phones and tablets, a dialog on desktop), then the sign-in page; nothing of Nadia’s stays on the device.',
    locked: ['anggota-profil', 'anggota-ov-confirm'],
  },
  // Shell, search and theme
  {
    id: 'navigation',
    title: 'Getting around',
    area: 'shell',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [13, 14, 15, 16, 17, 18, 20, 21, 25],
    owners: ['P0-C'],
    startsAt: '/',
    check:
      'Every tab, rail item or sidebar item lights for its page; Pengumuman carries the unread badge (3 for Nadia); the avatar opens Profil; back goes through history, and from a deep link to the parent; desktop shows Jejak halaman; each page has its own browser-tab title ("{Halaman} · PIPS!").',
    locked: [
      'anggota-beranda',
      'anggota-pengumuman',
      'anggota-kalender',
      'anggota-layanan',
      'anggota-profil',
      'anggota-dingdong',
    ],
  },
  {
    id: 'search',
    title: 'Global search',
    area: 'shell',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [22, 23, 66],
    owners: ['P1-A', 'P0-C'],
    startsAt: '/',
    check:
      'Cari di PIPS! (and Ctrl/⌘ K or / on desktop) opens the start list; "kas" finds Bayar Kas!; "IF2110" finds the course; "Rak" finds people and opens NIM Finder filled in; an announcement opens; arrows and Enter work; a search with no result says so.',
    locked: ['i-palette', 'i-palette-phone'],
  },
  {
    id: 'theme',
    title: 'Tampilan: Sistem, Terang, Gelap',
    area: 'shell',
    variants: [NADIA],
    layouts: ALL,
    themes: ['light'],
    darkSet: false,
    stories: [106, 107, 125, 126],
    owners: ['P0-A', 'P1-C'],
    startsAt: '/profil',
    check:
      'The switch is instant with no colour smear; the browser’s theme colour follows; the choice survives a reload; search’s theme action switches it too. Recorded once per layout, starting in light (the flow switches theme itself).',
    locked: ['anggota-profil'],
  },
  {
    id: 'keyboard',
    title: 'Keyboard only',
    area: 'shell',
    variants: [NADIA],
    layouts: ['desktop'],
    themes: BOTH,
    darkSet: false,
    stories: [63, 139, 140, 141, 142, 144],
    owners: ['P0-C', 'P1-A'],
    startsAt: '/',
    check:
      'The skip link first; a visible focus ring at every stop; Kalender’s date grid with the arrows, Home, End, Page Up and Page Down; a dialog keeps focus inside, closes with Escape and gives focus back.',
    locked: ['anggota-kalender', 'anggota-ov-event'],
  },
  {
    id: 'reduced-motion',
    title: 'Reduced motion',
    area: 'shell',
    variants: [NADIA],
    layouts: ['phone'],
    themes: ['light'],
    darkSet: false,
    stories: [127, 128],
    owners: ['P0-A'],
    startsAt: '/',
    check:
      'With reduced motion on, nothing moves: Beranda’s bars, a tab switch and a sheet appear without animation.',
    locked: ['anggota-beranda', 'anggota-ov-filter'],
  },
  // Beranda
  {
    id: 'beranda',
    title: 'Beranda',
    area: 'beranda',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [26, 27, 28, 29, 30, 32, 33, 34],
    owners: ['P1-A'],
    startsAt: '/',
    check:
      'The agenda card on today (Kuis 2, Sharing Session), Sabtu (Bakti Sosial HMIF), Minggu ("Tidak ada acara."); Perlu ditindaklanjuti most urgent first from real signals only (the deadline, "Balasan baru dari Welfare" without the message, the PIXEL form with Isi, "Notifikasi belum menyala"); the eight tiles in the real Home’s order (Pintasan on desktop); three unread titles.',
    locked: ['anggota-beranda', 'anggota-ov-event', 'i-event-sheet'],
  },
  {
    id: 'beranda-pengurus',
    title: 'Raka’s Beranda',
    area: 'beranda',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [34, 38],
    owners: ['P1-A'],
    startsAt: '/',
    check:
      'Raka sees his own courses’ events (Kuis 1, IF3170), not Nadia’s; the Kelola card with the live count of the open form; Pintasan on desktop. No Welfare line in the Kelola card (not built, D5).',
    locked: ['pengurus-beranda'],
  },
  {
    id: 'beranda-no-courses',
    title: 'Beranda with no courses this semester',
    area: 'beranda',
    variants: [{ key: 'nadia', persona: 'anggota', who: 'Nadia, no courses (override)' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [6, 27],
    owners: ['P1-A', 'P1-C'],
    startsAt: '/',
    check:
      '"Ding Dong dan acara Akademik masih kosong." with Atur, which opens Mata kuliahku; the card shows only Himpunan events.',
    locked: ['anggota-matkul'],
  },
  {
    id: 'beranda-push',
    title: 'Turning on notifications from Beranda',
    area: 'beranda',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [31, 32, 105],
    owners: ['P1-A', 'P1-C'],
    startsAt: '/',
    check:
      'Nyalakan explains first, then the browser asks; once allowed, "Notifikasi belum menyala" leaves Perlu ditindaklanjuti and a toast confirms.',
    locked: ['anggota-beranda', 'anggota-ov-push', 'i-push-dialog'],
  },
  // Pengumuman
  {
    id: 'pengumuman-unread',
    title: 'Unread announcements',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [16, 33, 39, 42, 43],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'Gold bars mark the unread posts; Belum dibaca shows only them; opening p1 marks it read and the badge drops from 3 to 2; its menu marks it unread again. Nadia sees p3 (for angkatan 2025), not p5 (for the akademik group).',
    locked: ['anggota-pengumuman', 'anggota-post', 'anggota-pop-menu', 'i-post-detail'],
  },
  {
    id: 'pengumuman-filter',
    title: 'Filtering and searching Pengumuman',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [40, 41],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'Hide Akademik, sort Terlama, Belum dibaca; a reload keeps the view (it is in the link); "gemastik" finds p2; a search with no result says "Tidak ada yang ditampilkan" and Tampilkan semua clears it.',
    locked: ['anggota-ov-filter', 'i-filter-sheet'],
  },
  {
    id: 'pengumuman-react-comment',
    title: 'Reactions, comments and sharing',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [44, 45, 46],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'One pixel reaction per person: pick, change, take back; a comment’s reaction; a new comment; the link preview and the Google Form embed; Bagikan, with Salin tautan where the browser can’t share.',
    locked: ['anggota-pop-react', 'i-feed-reacted', 'anggota-post'],
  },
  {
    id: 'pengumuman-missing',
    title: 'A deleted announcement',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [48],
    owners: ['P1-B'],
    startsAt: '/pengumuman/p404',
    check: 'A link to a post that no longer exists says so and leads back to Pengumuman.',
    locked: [],
  },
  {
    id: 'tulis-anggota',
    title: 'Buat pengumuman as a member',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [19, 49],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'Nadia may post only in Umum; sending it empty shows the errors with focus on the first; Umumkan puts the post on top. Title at most 100 characters, text at most 1,000. No tab bar on phones. No autosaved draft (open question A5).',
    locked: ['anggota-tulis', 'i-compose-anggota'],
  },
  {
    id: 'tulis-share',
    title: 'Sharing into PIPS! from another app',
    area: 'pengumuman',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [49],
    owners: ['P1-B', 'P0-B'],
    startsAt: '/pengumuman/tulis',
    check: 'Text, a link and a photo shared from another app open the composer filled in.',
    locked: ['anggota-tulis'],
  },
  {
    id: 'tulis-pengurus',
    title: 'Buat pengumuman as a pengurus',
    area: 'pengumuman',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [51, 52],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'Raka may post in Umum, Akademik, Himpunan and Beasiswa; the audience by angkatan and by his groups, with who will be notified; two photos upload with progress and Umumkan waits for them; only images are offered.',
    locked: [],
  },
  {
    id: 'pengumuman-own-post',
    title: 'Raka’s own posts',
    area: 'pengumuman',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [53, 54],
    owners: ['P1-B'],
    startsAt: '/pengumuman',
    check:
      'Umumkan ulang 3 hours after the last notification: at 13.35, p1 is locked ("Bisa lagi mulai 15.30"), p5 sends and the toast names the audience (no confirmation step: A5). Deleting a comment, then the post, each confirmation naming it.',
    locked: ['pengurus-pengumuman', 'pengurus-pop-menu-own', 'i-desk-own-menu'],
  },
  // Kalender
  {
    id: 'kalender',
    title: 'Kalender',
    area: 'kalender',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [55, 56, 57, 58, 59, 60, 61, 64],
    owners: ['P1-A'],
    startsAt: '/kalender',
    check:
      'The month on today; Jumat 9; Deadline Tugas Besar 1’s detail (time in WIB, course, description, the H-1 reminder state, Google Calendar, Ding Dong, Testi Matkul); the legend; the next month loading; Hari ini; the side panel on desktop. Only this semester’s courses’ Akademik events. Nadia has no Tambah acara.',
    locked: ['anggota-kalender', 'anggota-ov-event', 'i-event-sheet', 'i-tablet-sheet'],
  },
  {
    id: 'kalender-tambah-acara',
    title: 'Tambah, ubah and hapus acara',
    area: 'kalender',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [64, 112],
    owners: ['P3-B'],
    startsAt: '/kalender',
    check:
      'Adding is locked design: the empty-title error; Kuis 2 for IF3170 on Selasa 13 Oktober appears on the day and in search. Ubah acara and Hapus acara are P3-B’s proposals (D9). Also from Layanan’s Kelola row Tambah acara Akademik (it forwards to /kalender?tambah=acara).',
    locked: ['pengurus-kalender', 'pengurus-ov-addev', 'i-desk-addev', 'i-desk-kalender-after'],
  },
  {
    id: 'kalender-himpunan',
    title: 'Tambah acara Himpunan',
    area: 'kalender',
    variants: [
      { key: 'ring1', persona: 'pengurus', who: 'Raka with only ring1 (roles override)' },
      { key: 'both', persona: 'pengurus', who: 'Raka with akademik and ring1 (roles override)' },
    ],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [112],
    owners: ['P3-B'],
    startsAt: '/kalender',
    check:
      'P3-B’s proposal (D9): the dialog without Mata kuliah for ring1 only; with both roles, Jenis acara offers Akademik and Himpunan.',
    locked: [],
  },
  // Layanan
  {
    id: 'layanan',
    title: 'Layanan',
    area: 'layanan',
    variants: [NADIA, RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [65, 67, 70, 79, 80],
    owners: ['P1-C'],
    startsAt: '/layanan',
    check:
      'Four groups (Kuliah, Teman dan himpunan, Kesempatan, Administrasi) with one-line descriptions and members’ names; external services marked and opening in a new tab while the app stays; Raka’s Kelola group last (open question D1); Curhat’s and Form’s badges.',
    locked: ['anggota-layanan', 'pengurus-layanan'],
  },
  {
    id: 'dingdong',
    title: 'Ding Dong',
    area: 'layanan',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [71],
    owners: ['P2-B'],
    startsAt: '/layanan/dingdong',
    check:
      'Nadia’s six courses with full names; a folder opens in a new tab; IF4010 says "Belum ada folder" with its toast; with no courses, Atur mata kuliah.',
    locked: ['anggota-dingdong'],
  },
  {
    id: 'testi-browse',
    title: 'Testi Matkul by programme and semester',
    area: 'layanan',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [72, 73, 74],
    owners: ['P2-B'],
    startsAt: '/layanan/testi',
    check:
      'IF, Semester 3, IF2110; the pager from 1 / 3 to 2 / 3; an STI course’s sections (II2110: Kesan, Tantangan, Saran); a course with none (IF2120) and the Akademik note; Buka Ding Dong.',
    locked: ['anggota-testi-list', 'anggota-testi-course', 'i-testi'],
  },
  {
    id: 'testi-search',
    title: 'Testi Matkul search',
    area: 'layanan',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [72, 103],
    owners: ['P2-B'],
    startsAt: '/layanan/testi',
    check:
      '"if2110" from the start finds IF2110 (today’s app can’t: T3’s finding, fixed in P2-B); a search inside a course list; no match.',
    locked: ['i-testi-search'],
  },
  {
    id: 'nim-finder',
    title: 'NIM Finder',
    area: 'layanan',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [75, 76],
    owners: ['P2-B'],
    startsAt: '/layanan/nim',
    check:
      'Nothing under 3 characters; "rak" gives 2 results; an exact NIM comes first; copying a NIM shows a toast; no match says so. No recent searches (D6).',
    locked: ['anggota-nim'],
  },
  {
    id: 'info-lomba',
    title: 'Info Lomba',
    area: 'layanan',
    variants: [{ key: 'nadia', persona: 'anggota', who: 'Nadia, 12 competitions (override)' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [77, 78],
    owners: ['P2-B'],
    startsAt: '/layanan/lomba',
    check:
      'Soonest deadline first; the danger line within 3 days; "Gratis" and "Rp150.000"; Daftar and Sumber in a new tab; the second page by scrolling and by Muat lagi. No posters (D6).',
    locked: ['anggota-lomba'],
  },
  // Form and Magang SPARTA
  {
    id: 'form-list',
    title: 'Form statuses',
    area: 'form',
    variants: [NADIA, RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [81, 82],
    owners: ['P2-A'],
    startsAt: '/layanan/form',
    check:
      'Isi sekarang, Belum dibuka with its opening time, Sudah diisi; a closed form as Ditutup with its time (D5); a form not open yet counts down and, at the opening time, its questions appear without a reload. Forms go by angkatan: Raka has none.',
    locked: ['anggota-form', 'pengurus-form-empty'],
  },
  {
    id: 'form-pixel',
    title: 'Filling the PIXEL form',
    area: 'form',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [19, 31, 83, 84, 85, 86, 87, 88, 89],
    owners: ['P2-A'],
    startsAt: '/layanan/form/pixel',
    check:
      'Name and NIM filled in; "Bagian 1 dari 5"; a required question’s error, focused; Other opens its follow-up in place; "Draf tersimpan" and the draft back after a reload (kept 14 days); the check page with Ubah; Kirim jawaban asks first; "Terima kasih sudah mengisi"; the draft cleared, Beranda’s row gone, the list says Sudah diisi. No tab bar on phones.',
    locked: [
      'anggota-fill',
      'i-form-required',
      'i-form-draft-restored',
      'i-form-rating',
      'i-form-review',
      'anggota-ov-confirm',
      'i-form-done',
    ],
  },
  {
    id: 'sparta',
    title: 'Magang SPARTA',
    area: 'form',
    variants: [NADIA, RAKA],
    layouts: [...ALL, 'narrow320'],
    themes: BOTH,
    darkSet: false,
    stories: [90, 91, 92, 93],
    owners: ['P2-A'],
    startsAt: '/layanan/sparta',
    check:
      'Closed since Minggu 23 Agustus 2026, 23.59: read-only with Nadia’s draft and no submit; Raka is told it is only for angkatan 2025. Under P2-A’s window override, next season (D4): the deadline and four steps first, the stepper (also at 320 px), divisions ordered with Naikkan and Turunkan, "Draf tersimpan" on every step, a failed save with Coba lagi, the check page, Kirim pilihan divisi?, then read-only.',
    locked: [],
  },
  // Curhat Yuk!
  {
    id: 'curhat-start',
    title: 'Curhat Yuk! rooms',
    area: 'curhat',
    variants: [NADIA, RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [94, 97],
    owners: ['P2-C'],
    startsAt: '/layanan/curhat',
    check:
      'Who reads the messages and what stays anonymous, before the first message; rooms with unread counts; a new room with its random name and the count; at most 3 rooms. Raka has no rooms yet. No crisis help yet: story 95 waits on Welfare.',
    locked: ['anggota-curhat', 'pengurus-curhat-empty'],
  },
  {
    id: 'curhat-room',
    title: 'A Curhat room',
    area: 'curhat',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [19, 96, 97, 98],
    owners: ['P2-C'],
    startsAt: '/layanan/curhat/r1',
    check:
      'Opening Teal Koala clears its unread; Balas on Welfare’s message; Enter adds a line on touch keyboards; Kirim; Mengirim then Terkirim; the connection drops: the banner, Gagal, Kirim ulang, Terkirim; after a lost acknowledgement the message shows once (A11); back and in again, still connected. No tab bar on phones.',
    locked: ['anggota-room', 'i-curhat-room'],
  },
  {
    id: 'curhat-delete',
    title: 'Deleting a Curhat room',
    area: 'curhat',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [99],
    owners: ['P2-C'],
    startsAt: '/layanan/curhat',
    check: 'The confirmation names the room; then it is gone.',
    locked: ['anggota-curhat'],
  },
  {
    id: 'curhat-inbox',
    title: 'Welfare’s inbox',
    area: 'curhat',
    variants: [{ key: 'welfare', persona: 'pengurus', who: 'Raka with curhatadmin (roles override)' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [100],
    owners: ['P3-C'],
    startsAt: '/kelola/curhat',
    check:
      'P3-C’s proposal (D9): every room with unread counts, search, Belum dibaca, pinning, a room with the member’s and a teammate’s messages told apart, a reply. No labels (open question).',
    locked: [],
  },
  // Profil
  {
    id: 'profil',
    title: 'Profil',
    area: 'profil',
    variants: [NADIA, RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [101, 108],
    owners: ['P1-C'],
    startsAt: '/profil',
    check:
      'The member card (status, name, NIM, IF’25 · PIXEL, the official logo on its ink plate), Informasi akun folded, the settings rows, Kredit (no locked screen: D3), Keluar centred.',
    locked: ['anggota-profil', 'pengurus-profil'],
  },
  {
    id: 'matkul',
    title: 'Mata kuliahku',
    area: 'profil',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [7, 102, 103],
    owners: ['P1-C'],
    startsAt: '/profil/matkul',
    check:
      'The semester line, "Dipakai untuk apa?", the total SKS; remove IF2180 then Urungkan; add IF2211 K2 from search (Enter doesn’t reload); back with the new total.',
    locked: ['anggota-matkul', 'anggota-matkul-add', 'i-matkul-add'],
  },
  {
    id: 'notifikasi',
    title: 'Notifikasi',
    area: 'profil',
    variants: [
      { key: 'nadia', persona: 'anggota', who: 'Nadia' },
      { key: 'blocked', persona: 'anggota', who: 'Nadia, the browser blocks notifications' },
      { key: 'iphone', persona: 'anggota', who: 'Nadia on an iPhone browser', layouts: ['phone'] },
    ],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [104, 105, 109],
    owners: ['P1-C'],
    startsAt: '/profil/notifikasi',
    check:
      'Belum aktif, the explainer, then Aktif and a test notification (a local one: no server push, A4); a category off and on (muting stops only the push); a required category locked with its reason; Diblokir with how to fix it; the iPhone note about the installed app.',
    locked: ['anggota-notif', 'anggota-ov-push'],
  },
  // Kelola
  {
    id: 'kelola',
    title: 'Kelola by role',
    area: 'kelola',
    variants: [RAKA, NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [110, 111],
    owners: ['P3-A'],
    startsAt: '/kelola',
    check:
      'Raka’s Kelola lists only the tools his roles allow. Nadia has no Kelola anywhere, and opening /kelola sends her to Layanan (D8).',
    locked: ['pengurus-kelola'],
  },
  {
    id: 'live-counting',
    title: 'Live Counting and Rekap Form',
    area: 'kelola',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: true,
    stories: [114, 119],
    owners: ['P3-A'],
    startsAt: '/kelola/live',
    check:
      '142, a socket update, 143 with the new submitter; the per-question charts; Semua opens Rekap Form with its search and pager; CSV export; with two forms open, the forms list (D8).',
    locked: ['pengurus-live', 'i-desk-live'],
  },
  {
    id: 'sparta-data',
    title: 'Data SPARTA Magang',
    area: 'kelola',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [115, 116],
    owners: ['P3-A'],
    startsAt: '/kelola/sparta',
    check:
      'Search by name and by NIM, the filters, export, a submission’s detail; labelled rows on phones instead of a wide table. No locked screen (D8).',
    locked: [],
  },
  {
    id: 'kelola-lomba',
    title: 'Tambah, ubah and hapus lomba',
    area: 'kelola',
    variants: [{ key: 'cnc', persona: 'pengurus', who: 'Raka with cnc (roles override)' }],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [113, 117],
    owners: ['P3-B'],
    startsAt: '/layanan/lomba',
    check:
      'P3-B’s proposal (D9): Tambah lomba only for cnc, a dialog that keeps focus inside, closes with Escape and fits the screen (a sheet on phones); validation; saved; edit and delete, each confirmed.',
    locked: [],
  },
  {
    id: 'kelola-testi',
    title: 'Tambah testimoni',
    area: 'kelola',
    variants: [RAKA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [112],
    owners: ['P3-B'],
    startsAt: '/layanan/testi/teknik-informatika/3/course-IF2110',
    check:
      'P3-B’s proposal (D9): Tambah testimoni on a course page for akademik; IF’s sections (STI’s on an STI course); "Tulis minimal satu bagian."; the new testimonial in the pager.',
    locked: [],
  },
  // States
  {
    id: 'errors-offline',
    title: 'Errors and offline',
    area: 'states',
    variants: [NADIA],
    layouts: ALL,
    themes: BOTH,
    darkSet: false,
    stories: [135, 136],
    owners: ['P0-A', 'P0-B'],
    startsAt: '/pengumuman',
    check:
      'Pengumuman failing (503) shows its error with Coba lagi, then loads; Kalender offline with nothing cached shows its error; a page that crashes shows the root error page with Muat ulang and Ke Beranda. The words are P0-B’s (D10).',
    locked: [],
  },
  {
    id: 'old-links',
    title: 'Old links still land',
    area: 'states',
    variants: [RAKA],
    layouts: ALL,
    themes: ['light'],
    darkSet: false,
    stories: [18, 24],
    owners: ['P0-B', 'P3-B'],
    startsAt: '/timeline',
    check:
      'Today’s paths (bookmarks, push notifications, shared links) land on the redesign’s pages (P0-B’s redirect table), and the Kelola forwarding paths /kelola/acara, /kelola/lomba and /kelola/testi land where P3-B sends them.',
    locked: [],
    addedFrom:
      'P0-B report (redirect table) and P3-B report (the Kelola forwarding routes); F1 brief step 3 asks that each forwarding route lands where P3-B sends it.',
  },
];

export const flowById = (id: string): Flow => {
  const f = FLOWS.find((x) => x.id === id);
  if (!f) throw new Error(`No flow "${id}" in e2e/review/flows.ts`);
  return f;
};

/** The layouts a variant of a flow is recorded at. */
export const variantLayouts = (f: Flow, v: Variant): Layout[] =>
  v.layouts ? f.layouts.filter((l) => v.layouts!.includes(l)) : f.layouts;

/** Recordings a flow makes in one theme: one per layout and variant. */
export const recordingsPerTheme = (f: Flow) =>
  f.variants.reduce((n, v) => n + variantLayouts(f, v).length, 0);

/** The file name of a recording, without the extension: `<layout>-<theme>` plus `-<variant>` with two or more. */
export const recordingName = (f: Flow, layout: Layout, theme: Theme, variant: string) =>
  f.variants.length > 1 ? `${layout}-${theme}-${variant}` : `${layout}-${theme}`;
