/**
 * Beranda: the agenda card, services, attention rows and Kelola summary. The greeting is the shell's
 * (`common.shell.halo`).
 */
export const beranda = {
  layanan: 'Layanan',
  lainnya: 'Lainnya',
  situsLuar: '(situs luar)',
  perlu: {
    judul: 'Perlu ditindaklanjuti',
    kosong: 'Tidak ada yang perlu diurus.',
    lihat: 'Lihat',
    welfare: 'Balasan baru dari Welfare',
    diRuang: 'Di {jumlah} ruang',
    buka: 'Buka',
    bagian: '{jumlah} bagian',
    isi: 'Isi',
    aturMatkul: 'Atur mata kuliah semester ini',
    matkulKosong: 'Ding Dong dan acara Akademik masih kosong.',
    atur: 'Atur',
    notifikasiMati: 'Notifikasi belum menyala',
    nyalakan: 'Nyalakan',
    // The deadline's and the Welfare reply's line: "Besok, 23.59".
    waktu: '{hari}, {jam}',
    memuat: 'Memuat yang perlu ditindaklanjuti…',
    // The rows that are known stay; one line for the sources that failed or aren't kept offline.
    sebagianGagal: 'Sebagian gagal dimuat.',
    belumTersimpan: 'Bagian ini belum tersimpan di perangkat ini.',
    sebagianBelumTersimpan: 'Sebagian belum tersimpan di perangkat ini.',
  },
  belumDibaca: {
    judul: 'Pengumuman belum dibaca',
    semua: 'Semua',
    kosong: 'Semua sudah dibaca.',
    tandaBelum: '(belum dibaca)',
    memuat: 'Memuat pengumuman…',
    gagal: 'Pengumuman gagal dimuat.',
    belumTersimpan: 'Pengumuman belum tersimpan di perangkat ini.',
  },
  kelola: {
    judul: 'Kelola',
    live: 'Live Counting',
    sudahMengisi: 'sudah mengisi',
  },
} as const;
