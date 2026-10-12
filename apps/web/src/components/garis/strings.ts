/**
 * The words the shared components say themselves, in the prototype's wording. Screens pass their own copy as
 * props (from P0-B's catalog in src/copy/); these are only the components' built-in defaults.
 * When the catalog lands, these move to src/copy/common.ts (noted in the P0-A report).
 */
export const GARIS_STRINGS = {
  close: 'Tutup',
  retry: 'Coba lagi',
  undo: 'Urungkan',
  loading: 'Memuat…',
  saved: 'Draf tersimpan',
  errorTitle: 'Gagal memuat',
  /** "offline · diperbarui 07.45" (SPEC story 135). */
  offline: (time: string) => `Offline · diperbarui ${time}`,
  statusOpen: 'Isi sekarang',
  statusSoon: 'Belum dibuka',
  statusDone: 'Sudah diisi',
} as const;
