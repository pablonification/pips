/**
 * Every page of the app, for the sweep (F1 brief, step 8) and the catalogue's routes (step 3): the shell's route
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

export interface SweepRoute {
  /** The URL with fixture values. */
  url: string;
  /** Who it is checked as: both where the page differs, Raka for Kelola. */
  as: { key: string; use: Partial<HarnessOptions> }[];
}

const NADIA = { key: 'nadia', use: { persona: 'anggota' as const } };
const RAKA = { key: 'raka', use: { persona: 'pengurus' as const } };
const WELFARE = { key: 'welfare', use: { persona: 'pengurus' as const, roles: ['curhatadmin'] } };
const BOTH = [NADIA, RAKA];

export const ROUTES = {
  '/login': { url: '/login', as: [{ key: 'signed-out', use: { persona: null, signedIn: false } }] },
  '/': { url: '/', as: BOTH },
  '/mulai': { url: '/mulai', as: [NADIA] },
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
  '/layanan/sparta': { url: '/layanan/sparta', as: BOTH },
  '/layanan/testi': { url: '/layanan/testi', as: [NADIA] },
  '/layanan/testi/$type': { url: '/layanan/testi/teknik-informatika', as: [NADIA] },
  '/layanan/testi/$type/$semester': { url: '/layanan/testi/teknik-informatika/3', as: [NADIA] },
  '/layanan/testi/$type/$semester/$courseId': {
    url: '/layanan/testi/teknik-informatika/3/course-IF2110',
    as: BOTH,
  },
  '/kelola': { url: '/kelola', as: [RAKA] },
  '/kelola/live': { url: '/kelola/live', as: [RAKA] },
  '/kelola/live/$formId': { url: '/kelola/live/pixel', as: [RAKA] },
  '/kelola/live/$formId/rekap': { url: '/kelola/live/pixel/rekap', as: [RAKA] },
  '/kelola/sparta': { url: '/kelola/sparta', as: [RAKA] },
  '/kelola/sparta/$submissionId': { url: '/kelola/sparta/sub-13525071', as: [RAKA] },
  '/kelola/curhat': { url: '/kelola/curhat', as: [WELFARE] },
  '/kelola/curhat/$roomId': { url: '/kelola/curhat/r1', as: [WELFARE] },
  '/profil': { url: '/profil', as: BOTH },
  '/profil/matkul': { url: '/profil/matkul', as: [NADIA] },
  '/profil/matkul/tambah': { url: '/profil/matkul/tambah', as: [NADIA] },
  '/profil/notifikasi': { url: '/profil/notifikasi', as: BOTH },
  '/profil/kredit': { url: '/profil/kredit', as: [NADIA] },
} satisfies Record<string, SweepRoute>;
