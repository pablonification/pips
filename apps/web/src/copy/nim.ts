/** NIM Finder: searching, results, a failed copy and its errors. */
export const nim = {
  cariLabel: 'Cari nama atau NIM',
  placeholder: 'Ketik nama atau NIM',
  minimal: 'Ketik minimal 3 huruf nama atau angka NIM.',
  hasil: '{jumlah} hasil. Pilih untuk menyalin NIM.',
  // At the API's cap, so the count isn't taken for the total.
  hasilBatas: '{jumlah}+ hasil. Pilih untuk menyalin NIM.',
  tidakAda: 'Tidak ada anggota dengan nama atau NIM “{kata}”.',
  salinLabel: 'Salin NIM {nim}, {nama}',
  disalin: 'NIM {nim} disalin.',
  mencari: 'Mencari…',
  gagal: 'Pencarian gagal.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  gagalSalin: 'NIM {nim} gagal disalin. Coba lagi.',
} as const;
