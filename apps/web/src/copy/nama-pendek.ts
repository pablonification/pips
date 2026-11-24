/**
 * A short name's checks, as every name field shows them: making and renaming a short link, and a form's link in
 * Bagikan. Forms and short links share one set of names and one rule (`src/lib/short-name.ts`).
 */
export const namaPendek = {
  tulis: 'Tulis nama pendeknya',
  tersedia: 'Tersedia',
  memeriksa: 'Memeriksa…',
  masalah: {
    characters: 'Hanya huruf, angka, dan tanda hubung',
    too_short: 'Minimal 3 karakter',
    too_long: 'Maksimal 50 karakter (sekarang {jumlah})',
    hyphens: 'Tanda hubung hanya di antara huruf atau angka',
    used: 'Nama ini sudah pernah dipakai',
  },
  dipakai: {
    link: 'Sudah dipakai tautan lain',
    form: 'Sudah dipakai form lain',
  },
  dipakaiSebagai: {
    link: 'Sudah dipakai tautan lain sebagai {nama}',
    form: 'Sudah dipakai form lain sebagai {nama}',
  },
} as const;
