/**
 * NIM Finder (P2-B), worded as the prototype words it (garis/screens-more.js `scrNim`, `nimResults`; garis/app.js
 * `copy-nim`). Lines the prototype has no words for (searching, errors, a failed copy) are new copy, listed in the
 * P2-B report.
 */
export const nim = {
  cariLabel: 'Cari nama atau NIM',
  placeholder: 'Ketik nama atau NIM',
  minimal: 'Ketik minimal 3 huruf nama atau angka NIM.',
  hasil: '{jumlah} hasil. Pilih untuk menyalin NIM.',
  // New copy (Dev 1, P2-B round 2): at the API's cap, so the count isn't taken for the total.
  hasilBatas: '{jumlah}+ hasil. Pilih untuk menyalin NIM.',
  tidakAda: 'Tidak ada anggota dengan nama atau NIM “{kata}”.',
  salinLabel: 'Salin NIM {nim}, {nama}',
  disalin: 'NIM {nim} disalin.',
  // New copy.
  mencari: 'Mencari…',
  gagal: 'Pencarian gagal.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  gagalSalin: 'NIM {nim} gagal disalin. Coba lagi.',
} as const;
