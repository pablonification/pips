import type { FileRouteTypes } from '~/routeTree.gen';
import { type Capability, can } from './capabilities';

/*
 * The service registry (SPEC "Service registry, programme windows and campaigns"): one typed list that Layanan,
 * Beranda's tiles, global search and analytics all read, so adding or retiring a service needs no layout code.
 * Entries come from the locked prototype (`garis/data.js` SERVICES and TILES, `garis/screens-more.js`
 * kelolaItems), checked against FEATURES.md: members' names, the real destinations, the real role rules.
 * Add entries in their own commit and don't reorder others' (WORKER-RULES, "Shared files").
 */

export const SERVICE_GROUPS = [
  'Kuliah',
  'Teman dan himpunan',
  'Kesempatan',
  'Administrasi',
  'Kelola',
] as const;
export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

/** Keys of the Garis icon set (the prototype's `IC` in `garis/ui.js`); P0-A's icon components plug in by key. */
export type ServiceIconKey =
  | 'folder'
  | 'testi'
  | 'nim'
  | 'curhat'
  | 'form'
  | 'lomba'
  | 'beasiswa'
  | 'lowongan'
  | 'kas'
  | 'surat'
  | 'grafik'
  | 'kelola'
  | 'kalender';

/** A path in the app's route tree, checked by TypeScript. */
export type AppPath = FileRouteTypes['to'];

interface ServiceBase {
  id: string;
  /** The name members know. Never renamed (FEATURES.md, memory: feature grounding). */
  label: string;
  description: string;
  group: ServiceGroup;
  /**
   * Who keeps it running: the role key of the team behind it where the code shows one, otherwise `pips` (the
   * app's maintainers). Unconfirmed by HMIF; see the P0-B report.
   */
  owner: string;
  /**
   * ISO date-times (WIB offset): from `validFrom`, up to but not including `validUntil`, as the server's windows
   * open and close. Outside them the service is hidden from lists; its route still exists.
   */
  validFrom?: string;
  validUntil?: string;
  /** Extra words global search matches, lower case. */
  synonyms: readonly string[];
  /** Hidden from anyone without it. */
  capability?: Capability;
  icon: ServiceIconKey;
}

export interface InternalService extends ServiceBase {
  kind: 'internal';
  destination: AppPath;
}

/** Opens over HTTPS in a new tab, never replacing the app's page; named "situs luar, tab baru" for screen readers. */
export interface ExternalService extends ServiceBase {
  kind: 'external';
  destination: `https://${string}`;
}

export type Service = InternalService | ExternalService;

export const SERVICES = [
  // Kuliah
  {
    id: 'dingdong',
    label: 'Ding Dong',
    description: 'Folder materi mata kuliahmu semester ini',
    group: 'Kuliah',
    kind: 'internal',
    destination: '/layanan/dingdong',
    owner: 'akademik',
    synonyms: ['materi', 'drive', 'folder', 'kuliah'],
    icon: 'folder',
  },
  {
    id: 'testi',
    label: 'Testi Matkul',
    description: 'Cerita kakak tingkat tentang tiap mata kuliah',
    group: 'Kuliah',
    kind: 'internal',
    destination: '/layanan/testi',
    owner: 'akademik',
    synonyms: ['testimoni', 'review', 'dosen', 'matkul'],
    icon: 'testi',
  },
  // Teman dan himpunan
  {
    id: 'nim',
    label: 'NIM Finder',
    description: 'Cari teman lewat nama atau NIM',
    group: 'Teman dan himpunan',
    kind: 'internal',
    destination: '/layanan/nim',
    owner: 'pips',
    synonyms: ['nim', 'teman', 'orang', 'cari'],
    icon: 'nim',
  },
  {
    id: 'curhat',
    label: 'Curhat Yuk!',
    description: 'Ngobrol anonim dengan tim Welfare HMIF',
    group: 'Teman dan himpunan',
    kind: 'internal',
    destination: '/layanan/curhat',
    owner: 'welfare',
    synonyms: ['curhat', 'cerita', 'welfare', 'anonim'],
    icon: 'curhat',
  },
  {
    id: 'form',
    label: 'Form',
    description: 'Form dari HMIF untuk angkatanmu',
    group: 'Teman dan himpunan',
    kind: 'internal',
    destination: '/layanan/form',
    owner: 'admin',
    synonyms: ['form', 'formulir', 'survei', 'kuesioner'],
    icon: 'form',
  },
  // Kesempatan
  {
    id: 'lomba',
    label: 'Info Lomba',
    description: 'Lomba yang pendaftarannya masih buka',
    group: 'Kesempatan',
    kind: 'internal',
    destination: '/layanan/lomba',
    owner: 'cnc',
    synonyms: ['lomba', 'kompetisi', 'gemastik', 'ctf'],
    icon: 'lomba',
  },
  {
    // Seasonal and closed (FEATURES.md §11): hidden from lists after its deadline, as the prototype hides it.
    // The owner asked for the member side to be built anyway (2026-10-13); its route stays.
    id: 'sparta',
    label: 'Magang SPARTA',
    description: 'Pilihan divisi magang angkatan 2025',
    group: 'Kesempatan',
    kind: 'internal',
    destination: '/layanan/sparta',
    owner: 'peoplemanage',
    // SPARTA's closing time on the server (apps/api/src/lib/sparta-window.ts), from which it is closed.
    validUntil: '2026-08-23T23:59:00+07:00',
    synonyms: ['sparta', 'magang', 'divisi'],
    icon: 'kelola',
  },
  {
    id: 'beasiswa',
    label: 'Beasiswa',
    description: 'Mading Beasiswa HMIF',
    group: 'Kesempatan',
    kind: 'external',
    destination: 'https://s.hmif.dev/MadingBeasiswa',
    owner: 'pips',
    synonyms: ['beasiswa', 'mading'],
    icon: 'beasiswa',
  },
  {
    id: 'lowongan',
    label: 'LowonginAja!',
    description: 'Lowongan magang dan kerja',
    group: 'Kesempatan',
    kind: 'external',
    destination: 'https://s.hmif.dev/LowonginAja!',
    owner: 'pips',
    synonyms: ['lowongan', 'magang', 'kerja', 'karier'],
    icon: 'lowongan',
  },
  // Administrasi
  {
    id: 'kas',
    label: 'Bayar Kas!',
    description: 'Bayar iuran kas HMIF',
    group: 'Administrasi',
    kind: 'external',
    destination: 'https://s.hmif.dev/BayarKasHMIF',
    owner: 'pips',
    synonyms: ['kas', 'iuran', 'bayar', 'uang'],
    icon: 'kas',
  },
  {
    id: 'surat',
    label: 'Surat & Proposal',
    description: 'Layanan administrasi HMIF 2025/2026',
    group: 'Administrasi',
    kind: 'external',
    destination: 'https://s.hmif.dev/LayananAdministrasiHMIF2526',
    owner: 'pips',
    synonyms: ['surat', 'proposal', 'administrasi', 'peminjaman'],
    icon: 'surat',
  },
  // Kelola: only the user's own tools (SPEC "Kelola and role-aware UI").
  {
    id: 'live',
    label: 'Live Counting & Rekap Form',
    description: 'Pengisi form secara realtime, rekap, dan analitik',
    group: 'Kelola',
    kind: 'internal',
    destination: '/kelola/live',
    owner: 'admin',
    capability: 'liveCounting',
    synonyms: ['admin', 'form', 'live', 'rekap'],
    icon: 'grafik',
  },
  {
    id: 'sparta-data',
    label: 'Data SPARTA Magang',
    description: 'Pilihan divisi magang angkatan 2025 · ditutup 23 Agu 2026',
    group: 'Kelola',
    kind: 'internal',
    destination: '/kelola/sparta',
    owner: 'peoplemanage',
    capability: 'spartaData',
    synonyms: ['sparta', 'magang', 'admin'],
    icon: 'kelola',
  },
  {
    // Deviation (report, round 2): the prototype shows it to `akademik` and `ring1` alike, but its form adds a
    // course's Akademik event, which the server allows `akademik` only (calendar.controller.ts); `ring1` adds
    // Himpunan events from Kalender's "Tambah acara" (canCreateEvent). P3-B: /kelola/acara forwards to
    // /kalender?tambah=acara, the dialog over Kalender (a destination is a typed path, without a query).
    id: 'acara',
    label: 'Tambah acara Akademik',
    description: 'Kuis, UTS, dan tenggat per mata kuliah',
    group: 'Kelola',
    kind: 'internal',
    destination: '/kelola/acara',
    owner: 'akademik',
    capability: 'createAkademikEvent',
    synonyms: ['acara', 'kalender', 'tambah'],
    icon: 'kalender',
  },
  // P3-C: Welfare's inbox (a proposal, OPEN-QUESTIONS D9); the description is new copy.
  {
    id: 'curhat-inbox',
    label: 'Curhat Yuk!',
    description: 'Balas ruang curhat anggota',
    group: 'Kelola',
    kind: 'internal',
    destination: '/kelola/curhat',
    owner: 'welfare',
    capability: 'respondCurhat',
    synonyms: ['curhat', 'welfare', 'balas'],
    icon: 'curhat',
  },
] as const satisfies readonly Service[];

export type ServiceId = (typeof SERVICES)[number]['id'];

/** Beranda's tiles on phones and tablets: seven services in today's Home order, then Lainnya (`garis/data.js` TILES). */
export const BERANDA_TILES = [
  'dingdong',
  'nim',
  'testi',
  'lomba',
  'curhat',
  'beasiswa',
  'kas',
] as const satisfies readonly ServiceId[];

/** Pintasan: global search's start and desktop Beranda's shortcuts (`garis/data.js` PINS). */
export const PINNED_SERVICES = [
  'dingdong',
  'testi',
  'nim',
  'kas',
] as const satisfies readonly ServiceId[];

export function serviceById(id: ServiceId): Service {
  return SERVICES.find((s) => s.id === id)!;
}

/** Inside its validity window at `now` (both ends inclusive). */
export function isServiceActive(service: Service, now: Date = new Date()) {
  const t = now.getTime();
  if (service.validFrom && t < Date.parse(service.validFrom)) return false;
  if (service.validUntil && t >= Date.parse(service.validUntil)) return false;
  return true;
}

type WithRoles = Parameters<typeof can>[0];

/** What `user` sees at `now`: active services they have the capability for, in registry order. */
export function visibleServices(
  user: WithRoles,
  now: Date = new Date(),
): Service[] {
  return (SERVICES as readonly Service[]).filter(
    (s) =>
      isServiceActive(s, now) && (!s.capability || can(user, s.capability)),
  );
}

/**
 * A member service global search leaves out for whoever sees the Kelola row that replaces it (P3-C review, deviation
 * 5): for Welfare, "Curhat Yuk!" leads to the inbox, which the Kelola row "Balas ruang curhat anggota" already finds,
 * so search shows it once. Layanan and Beranda keep the member row.
 */
const SEARCH_REPLACED_BY: Partial<Record<ServiceId, ServiceId>> = {
  curhat: 'curhat-inbox',
};

/** What global search lists for `user` at `now`: `visibleServices` without the rows a Kelola row replaces. */
export function searchableServices(
  user: WithRoles,
  now: Date = new Date(),
): Service[] {
  const visible = visibleServices(user, now);
  const ids = new Set<string>(visible.map((s) => s.id));
  return visible.filter((s) => {
    const by = SEARCH_REPLACED_BY[s.id as ServiceId];
    return !by || !ids.has(by);
  });
}

/** `visibleServices` grouped in SPEC's order; groups with nothing visible are left out (Kelola for members). */
export function servicesByGroup(user: WithRoles, now: Date = new Date()) {
  const visible = visibleServices(user, now);
  return SERVICE_GROUPS.map((group) => ({
    group,
    services: visible.filter((s) => s.group === group),
  })).filter((g) => g.services.length > 0);
}

/** Global search over labels, descriptions and synonyms; case and accents ignored. */
export function searchServices(
  query: string,
  user: WithRoles,
  now: Date = new Date(),
): Service[] {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return searchableServices(user, now).filter((s) => {
    const haystack = fold([s.label, s.description, ...s.synonyms].join(' '));
    return terms.every((t) => haystack.includes(t));
  });
}
