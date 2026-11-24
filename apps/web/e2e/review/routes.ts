/**
 * Every page of the app, for the route sweep and the flow catalogue: the shell's route
 * registry (src/lib/shell/routes.ts) plus /login. tests/review-routes.test.ts fails, at type check and when run, until
 * every route in the registry has an entry here. Each `$param` is filled with a fixture value.
 * Left out: /dev/shell (production builds drop it) and the forwarding routes /kelola/acara, /kelola/lomba and
 * /kelola/testi, which the old-links flow follows instead.
 */
import type { HarnessOptions } from '../support/test';

export const FORWARDING = {
  '/kelola/acara': '/kalender?tambah=acara',
  '/kelola/lomba': '/layanan/lomba',
  '/kelola/testi': '/layanan/testi',
} as const;

/** Not swept: production builds drop it. */
export const LEFT_OUT = ['/dev/shell'] as const;

interface SweepRoute {
  /** The URL with fixture values. */
  url: string;
  /** Who it is checked as: both where the page differs, Raka for Kelola. */
  as: { key: string; use: Partial<HarnessOptions> }[];
}

const NADIA = { key: 'nadia', use: { persona: 'anggota' as const } };
const RAKA = { key: 'raka', use: { persona: 'pengurus' as const } };
const WELFARE = {
  key: 'welfare',
  use: { persona: 'pengurus' as const, roles: ['curhatadmin'] },
};
const BOTH = [NADIA, RAKA];

export const ROUTES = {
  '/login': {
    url: '/login',
    as: [{ key: 'signed-out', use: { persona: null, signedIn: false } }],
  },
  '/': { url: '/', as: BOTH },
  '/mulai': { url: '/mulai', as: [NADIA] },
  '/hubungkan': { url: '/hubungkan?permintaan=req-claude', as: [NADIA] },
  '/pengumuman': { url: '/pengumuman', as: BOTH },
  '/pengumuman/$id': { url: '/pengumuman/p1', as: BOTH },
  '/pengumuman/tulis': { url: '/pengumuman/tulis', as: BOTH },
  '/kalender': { url: '/kalender', as: BOTH },
  '/layanan': { url: '/layanan', as: BOTH },
  '/layanan/dingdong': { url: '/layanan/dingdong', as: [NADIA] },
  '/layanan/nim': { url: '/layanan/nim?q=rak', as: [NADIA] },
  '/layanan/lomba': { url: '/layanan/lomba', as: [NADIA] },
  '/layanan/curhat': { url: '/layanan/curhat', as: BOTH },
  '/layanan/curhat/$roomId': { url: '/layanan/curhat/r1', as: [NADIA] },
  '/layanan/form': { url: '/layanan/form', as: BOTH },
  '/layanan/form/$formId': { url: '/layanan/form/pixel', as: [NADIA] },
  // Raka (admin) may manage it: Kelola form ini beside the way to his own forms.
  '/f/$name': { url: '/f/rencana-ta-2023', as: BOTH },
  '/layanan/testi': { url: '/layanan/testi', as: [NADIA] },
  '/layanan/testi/$type': {
    url: '/layanan/testi/teknik-informatika',
    as: [NADIA],
  },
  '/layanan/testi/$type/$semester': {
    url: '/layanan/testi/teknik-informatika/3',
    as: [NADIA],
  },
  '/layanan/testi/$type/$semester/$courseId': {
    url: '/layanan/testi/teknik-informatika/3/course-IF2110',
    as: BOTH,
  },
  '/layanan/tautan': { url: '/layanan/tautan', as: BOTH },
  '/layanan/tautan/$id': { url: '/layanan/tautan/l-kalkulus', as: [NADIA] },
  '/layanan/tautan/ambil': { url: '/layanan/tautan/ambil', as: [NADIA] },
  // No sign-in: anyone who followed a wrong s.hmif.dev link reads it.
  '/tautan-tidak-ditemukan': {
    url: '/tautan-tidak-ditemukan?nama=makrab-2027',
    as: [{ key: 'signed-out', use: { persona: null, signedIn: false } }],
  },
  '/kelola': { url: '/kelola', as: [RAKA] },
  '/kelola/form': { url: '/kelola/form', as: [RAKA] },
  '/kelola/form/$formId': { url: '/kelola/form/wisuda', as: [RAKA] },
  '/kelola/form/$formId/pratinjau': {
    url: '/kelola/form/makrab/pratinjau',
    as: [RAKA],
  },
  '/kelola/live': { url: '/kelola/live', as: [RAKA] },
  '/kelola/live/$formId': { url: '/kelola/live/pixel', as: [RAKA] },
  '/kelola/live/$formId/rekap': { url: '/kelola/live/pixel/rekap', as: [RAKA] },
  '/kelola/curhat': { url: '/kelola/curhat', as: [WELFARE] },
  '/kelola/tautan': { url: '/kelola/tautan', as: [RAKA] },
  '/kelola/tautan/$id': { url: '/kelola/tautan/l-semnas', as: [RAKA] },
  '/kelola/curhat/$roomId': { url: '/kelola/curhat/r1', as: [WELFARE] },
  '/profil': { url: '/profil', as: BOTH },
  '/profil/matkul': { url: '/profil/matkul', as: [NADIA] },
  '/profil/matkul/tambah': { url: '/profil/matkul/tambah', as: [NADIA] },
  '/profil/notifikasi': { url: '/profil/notifikasi', as: BOTH },
  '/profil/kredit': { url: '/profil/kredit', as: [NADIA] },
  '/profil/data-diri': { url: '/profil/data-diri', as: [NADIA] },
  '/profil/aplikasi': { url: '/profil/aplikasi', as: [NADIA] },
} satisfies Record<string, SweepRoute>;
