/**
 * Curhat Yuk!'s words (P2-C): the list, a room, the composer and deleting a room, as the prototype words them
 * (garis/screens-more.js `scrCurhat`, `scrRoom`, `OV.confirm` 'del-room'; app.js `renderPhone`, `new-room`,
 * `confirm-yes`). Strings marked "new copy" aren't in the prototype; they are listed in reports/P2-C-curhat.md for
 * the owner (OPEN-QUESTIONS D7). No exclamation marks of our own (SPEC "Copy and language").
 */
export const curhat = {
  daftar: {
    // The privacy note: still open for HMIF Welfare (OPEN-QUESTIONS, "For HMIF"); the prototype's words.
    anonim: 'Anonim.',
    anonimIsi: 'Namamu tidak ditampilkan ke tim Welfare.',
    kamu: 'Kamu',
    welfare: 'Welfare',
    pratinjau: '{siapa}: {pesan}',
    belumAdaPesan: 'Belum ada pesan',
    pesanBaru: ', {jumlah} pesan baru',
    dipakai: '{jumlah} dari {maks} ruang dipakai',
    mulai: 'Mulai ruang baru',
    penuh: 'Hapus salah satu ruang untuk membuat yang baru.',
    penuhToast: 'Maksimal 3 ruang. Hapus salah satu ruang dulu.',
    dibuat: 'Ruang “{nama}” dibuat. Namamu tetap tersembunyi.',
    kosongJudul: 'Belum ada ruang cerita',
    kosongIsi: 'Mulai ruang baru untuk ngobrol dengan tim Welfare HMIF.',
    // New copy: the loading and error states, and a room that couldn't be started.
    memuat: 'Memuat ruang…',
    gagal: 'Ruang cerita gagal dimuat.',
    gagalBuat: 'Ruang baru gagal dibuat. Coba lagi.',
  },
  ruang: {
    // A room without a name (the prototype's `titleOf`).
    tanpaNama: 'Ruang',
    hariIni: 'Hari ini',
    kamuSr: 'Kamu: ',
    welfareSr: 'Welfare: ',
    membalasSr: 'Membalas: ',
    membalas: 'Membalas: {pesan}',
    waktuWelfare: 'Welfare · {jam}',
    balas: 'Balas',
    batalMembalas: 'Batal membalas',
    tulis: 'Tulis pesan…',
    tulisLabel: 'Tulis pesan untuk tim Welfare',
    kirim: 'Kirim pesan',
    pertama: 'Tulis pesan pertamamu. Tim Welfare membalas di sini.',
    percakapan: 'Percakapan {nama}',
    hapusIni: 'Hapus ruang ini',
    hapus: 'Hapus ruang',
    tidakDitemukan: 'Ruang tidak ditemukan',
    tidakDitemukanIsi: 'Ruang ini sudah dihapus.',
    kembali: 'Kembali ke Curhat Yuk!',
    // New copy (OPEN-QUESTIONS D7): the delivery states, built from the bubble's time line and the Balas line.
    mengirim: 'Mengirim',
    terkirim: 'Terkirim',
    waktuTerkirim: 'Terkirim · {jam}',
    gagal: 'Gagal',
    kirimUlang: 'Kirim ulang',
    // New copy (OPEN-QUESTIONS D7): only Curhat's connection is down; the device is online.
    terputus: 'Koneksi Curhat terputus. Menyambungkan lagi…',
  },
  hapus: {
    judul: 'Hapus ruang ini?',
    isi: 'Seluruh percakapan di ruang ini hilang, juga untuk tim Welfare.',
    ya: 'Hapus ruang',
    batal: 'Batal',
    dihapus: 'Ruang dihapus.',
    // New copy: the delete failed.
    gagal: 'Ruang gagal dihapus. Coba lagi.',
  },
} as const;
