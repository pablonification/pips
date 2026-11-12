/** Testi Matkul: titles, course rows, testimonials, and the unknown-course, loading and error lines. */
export const testi = {
  program: {
    IF: 'Teknik Informatika',
    STI: 'Sistem dan Teknologi Informasi',
    OTHER: 'Mata Kuliah Umum',
  },
  // Titles: "IF · Semester 3", "IF · Pilihan".
  judulSemester: '{program} · Semester {semester}',
  judulPilihan: '{program} · Pilihan',
  semester: 'Semester {semester}',
  pilihan: 'Mata Kuliah Pilihan',
  cariLabel: 'Cari mata kuliah',
  cariSemua: 'Cari kode atau nama mata kuliah',
  cariDaftar: 'Cari kode atau nama',
  jumlahMatkul: '{jumlah} mata kuliah',
  jumlahTestimoni: '{jumlah} testimoni',
  belumAdaTestimoni: 'Belum ada testimoni',
  tidakAdaMatkul: 'Tidak ada mata kuliah',
  cobaKodeLain: 'Coba kode atau nama lain.',
  cobaKataLain: 'Coba kata lain atau semester lain.',
  sks: '{sks} SKS',
  anonim: 'Anonim',
  bagian: {
    overview: 'Overview',
    tugas: 'Tugas',
    reviewDosen: 'Review Dosen',
    kesan: 'Kesan',
    tantangan: 'Tantangan',
    saran: 'Saran',
    // The lecturer's name (the API's `lecturer`), last.
    dosen: 'Dosen',
  },
  // A section over 280 characters folds to six lines behind these.
  bacaSelengkapnya: 'Baca selengkapnya',
  ringkasLagi: 'Ringkas lagi',
  bukaDingdong: 'Buka Ding Dong {kode}',
  kosongIsi: 'Testimoni dikumpulkan divisi Akademik tiap akhir semester.',
  // A course that isn't in the catalogue (an old or mistyped link).
  tidakDitemukan: 'Mata kuliah tidak ditemukan',
  tidakDitemukanIsi: 'Tautannya mungkin salah atau sudah tidak berlaku.',
  kembali: 'Kembali ke Testi Matkul',
  // Loading and failures.
  memuatMatkul: 'Memuat mata kuliah…',
  memuatTestimoni: 'Memuat testimoni…',
  gagalMatkul: 'Mata kuliah gagal dimuat.',
  gagalTestimoni: 'Testimoni gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
} as const;
