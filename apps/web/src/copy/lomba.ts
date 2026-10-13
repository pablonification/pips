/**
 * Info Lomba (P2-B), worded as the prototype words it (garis/screens-more.js `scrLomba`; garis/ui.js `rupiah`), and
 * **Muat lagi** from SPEC story 78. Lines the prototype has no words for (empty, errors, loading) are new copy,
 * listed in the P2-B report.
 */
export const lomba = {
  tutup: 'Tutup {tanggal}, {jam}',
  gratis: 'Gratis',
  daftar: 'Daftar',
  sumber: 'Sumber',
  // Accessible names: the visible label first, then which competition, so the links can be told apart.
  daftarLabel: 'Daftar {nama}',
  sumberLabel: 'Sumber {nama}',
  muatLagi: 'Muat lagi',
  // New copy.
  kosong: 'Belum ada lomba yang dibuka',
  kosongIsi: 'Lomba baru muncul di sini begitu pendaftarannya dibuka.',
  gagal: 'Lomba gagal dimuat.',
  gagalBerikutnya: 'Lomba berikutnya gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  memuat: 'Memuat lomba…',
} as const;
