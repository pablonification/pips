/**
 * Form (P2-A): the list, filling, the check page, sending and the thank-you. Words are the prototype's
 * (`garis/screens-more.js` `scrForm`, `qBlock`, `savedMark`, `answerText`, `reviewPage`, `scrFill`, `OV.confirm`
 * `send-form`; `garis/app.js` `confirm-yes`). The states the prototype doesn't draw (Belum dibuka with its time and
 * countdown, Ditutup, not for your angkatan, not found, a failed send) are new copy (OPEN-QUESTIONS D5), listed in
 * the P2-A report.
 */
export const form = {
  daftar: {
    kosongJudul: 'Belum ada form untukmu',
    kosongIsi: 'Form muncul di sini kalau HMIF membuka form untuk angkatanmu.',
    bagian: '{jumlah} bagian',
    // New: the opening and closing time on a card (SPEC story 81).
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
    // New: while it sends, and when it can't.
    mengirim: 'Mengirim…',
    berhasil: 'Form berhasil dikirim!',
    gagal:
      'Jawabanmu belum terkirim. Jawaban dan drafmu tetap aman, coba kirim lagi.',
  },
  selesai: {
    judul: 'Terima kasih sudah mengisi!',
    isi: 'Jawabanmu sudah terkirim.',
    kembali: 'Kembali ke Beranda',
  },
  // New: a form that hasn't opened yet (OPEN-QUESTIONS D5).
  belumDibuka: {
    dibuka: 'Dibuka {waktu}',
    sisa: 'Dibuka dalam {sisa}',
    membuka: 'Membuka form…',
    gagal: 'Form belum bisa dibuka.',
    gagalIsi: 'Pertanyaannya belum sampai. Coba lagi sebentar lagi.',
  },
  // New: closed, not for your angkatan, not found.
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
