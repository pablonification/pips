/**
 * Form: the list, filling, the check page, sending and the thank-you, with the states of a form that isn't open
 * (Belum dibuka with its time and countdown, Ditutup, not for your angkatan, not found) and a failed send.
 */
export const form = {
  daftar: {
    kosongJudul: 'Belum ada form untukmu',
    kosongIsi: 'Form muncul di sini kalau HMIF membuka form untuk angkatanmu.',
    bagian: '{jumlah} bagian',
    // The opening and closing time on a card.
    dibuka: 'Dibuka {waktu}',
    ditutup: 'Ditutup {waktu}',
    gagal: 'Form gagal dimuat.',
    memuat: 'Memuat form…',
  },
  isi: {
    bagianDari: 'Bagian {nomor} dari {jumlah}',
    wajib: 'Pertanyaan ini wajib diisi',
    masihAda: 'Masih ada pertanyaan wajib yang belum diisi.',
    opsional: '(opsional)',
    bolehLebih: 'Boleh pilih lebih dari satu.',
    dariAkun: 'Diisi dari akunmu. Ubah kalau perlu.',
    skala: '1 = sangat kurang, 5 = sangat baik',
    sebelumnya: 'Sebelumnya',
    lanjut: 'Lanjut',
    kembaliKeRingkasan: 'Kembali ke ringkasan',
    memuat: 'Memuat pertanyaan…',
  },
  periksa: {
    judul: 'Periksa jawabanmu',
    ubah: 'Ubah',
    ubahBagian: 'Ubah jawaban bagian {bagian}',
    lainnya: 'Lainnya: {isi}',
    dariLima: '{n} dari 5',
    tidakDiisi: 'Tidak diisi',
    kosong: '–',
    kirimJawaban: 'Kirim jawaban',
  },
  kirim: {
    judul: 'Kirim jawaban?',
    isi: 'Jawaban tidak bisa diubah setelah dikirim.',
    periksaLagi: 'Periksa lagi',
    kirim: 'Kirim',
    // While it sends, and when it can't.
    mengirim: 'Mengirim…',
    berhasil: 'Form berhasil dikirim!',
    gagal: 'Jawabanmu belum terkirim. Periksa koneksimu, lalu coba lagi.',
  },
  selesai: {
    judul: 'Terima kasih sudah mengisi!',
    isi: 'Jawabanmu sudah terkirim.',
    kembali: 'Kembali ke Beranda',
  },
  // A form that hasn't opened yet.
  belumDibuka: {
    dibuka: 'Dibuka {waktu}',
    sisa: 'Dibuka dalam {sisa}',
    membuka: 'Membuka form…',
    gagal: 'Form belum bisa dibuka.',
    gagalIsi: 'Pertanyaannya belum sampai. Coba lagi sebentar lagi.',
  },
  // Closed, not for your angkatan, not found.
  ditutup: {
    judul: 'Form ini sudah ditutup',
    isi: 'Ditutup {waktu}. Jawaban tidak bisa dikirim lagi.',
    isiTanpaWaktu: 'Jawaban tidak bisa dikirim lagi.',
  },
  bukanUntukmu: {
    judul: 'Form ini bukan untuk angkatanmu',
    isi: 'Form muncul di daftar Form kalau HMIF membukanya untuk angkatanmu.',
  },
  tidakAda: {
    judul: 'Form tidak ditemukan',
    isi: 'Mungkin tautannya salah, atau form ini sudah dihapus.',
  },
  keDaftar: 'Lihat daftar Form',
} as const;
