/**
 * Testi Matkul (P2-B), worded as the prototype words it (garis/screens-more.js `scrTesti`, `testiTitle`,
 * `testiStart`, `testiCourseRow`, `testiCount`, `PROG`). Lines the prototype has no words for (errors, an unknown
 * course, loading) are new copy, listed in the P2-B report.
 */
export const testi = {
  program: {
    IF: 'Teknik Informatika',
    STI: 'Sistem dan Teknologi Informasi',
    OTHER: 'Mata Kuliah Umum',
  },
  // Titles (`testiTitle`): "IF · Semester 3", "IF · Pilihan".
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
  kodeSks: '{kode} · {sks} SKS',
  testimoniKe: 'Testimoni {ke} dari {jumlah}',
  posisi: '{ke} / {jumlah}',
  anonim: 'Anonim',
  bagian: {
    overview: 'Overview',
    tugas: 'Tugas',
    reviewDosen: 'Review Dosen',
    kesan: 'Kesan',
    tantangan: 'Tantangan',
    saran: 'Saran',
    // Today's app shows "Dosen: {lecturer}"; the prototype has no place for it (P2-B open question 3).
    dosen: 'Dosen',
  },
  sebelumnya: 'Sebelumnya',
  berikutnya: 'Berikutnya',
  sebelumnyaLabel: 'Testimoni sebelumnya',
  berikutnyaLabel: 'Testimoni berikutnya',
  bukaDingdong: 'Buka Ding Dong {kode}',
  kosongIsi: 'Testimoni dikumpulkan divisi Akademik tiap akhir semester.',
  // New copy: a course that isn't in the catalogue (an old or mistyped link), as Curhat's "Ruang tidak ditemukan".
  tidakDitemukan: 'Mata kuliah tidak ditemukan',
  tidakDitemukanIsi: 'Tautannya mungkin salah atau sudah tidak berlaku.',
  kembali: 'Kembali ke Testi Matkul',
  // New copy: loading and failures.
  memuatMatkul: 'Memuat mata kuliah…',
  memuatTestimoni: 'Memuat testimoni…',
  memuatJumlah: 'Memuat jumlah testimoni…',
  gagalMatkul: 'Mata kuliah gagal dimuat.',
  gagalTestimoni: 'Testimoni gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
} as const;
