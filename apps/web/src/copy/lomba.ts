/** Info Lomba: the list, posters and their viewer, **Muat lagi**, and the empty, error and loading lines. */
export const lomba = {
  tutup: 'Tutup {tanggal}, {jam}',
  gratis: 'Gratis',
  daftar: 'Daftar',
  sumber: 'Sumber',
  // Accessible names: the visible label first, then which competition, so the links can be told apart.
  daftarLabel: 'Daftar {nama}',
  sumberLabel: 'Sumber {nama}',
  muatLagi: 'Muat lagi',
  // The 3:4 poster, its button and the poster viewer.
  poster: 'Poster {nama}',
  perbesarPoster: 'Perbesar poster {nama}',
  tutupPoster: 'Tutup poster',
  kosong: 'Belum ada lomba yang dibuka',
  kosongIsi: 'Lomba baru muncul di sini begitu pendaftarannya dibuka.',
  gagal: 'Lomba gagal dimuat.',
  gagalBerikutnya: 'Lomba berikutnya gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  memuat: 'Memuat lomba…',
} as const;
