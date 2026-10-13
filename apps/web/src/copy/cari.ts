/**
 * Global search's sources (P1-A): the words of the prototype's `palIndex` (`garis/app.js`). The palette's own words
 * (Tindakan, Pintasan, the empty result, the key hints) are P0-C's, in `common.palette`. `kata` are the hidden words
 * an item is also found by, as the prototype's `kw`.
 */
export const cari = {
  grup: {
    pengumuman: 'Pengumuman',
    kalender: 'Kalender',
    mataKuliah: 'Mata kuliah',
    orang: 'Orang',
  },
  buatPengumuman: {
    label: 'Buat pengumuman',
    hint: 'Pengumuman',
    kata: 'tulis umumkan post',
  },
  tambahMatkul: {
    label: 'Tambah mata kuliah',
    hint: 'Mata kuliahku',
    kata: 'matkul sks kelas course',
  },
  nyalakanNotifikasi: {
    label: 'Nyalakan notifikasi',
    hint: 'Profil',
    kata: 'notif push izin',
  },
  tema: { kata: 'tema mode dark light gelap terang' },
  // A post without a title shows the start of its text with "…"; a course's hint; an event's "Sel 13 Okt 13.00".
  potong: '{awal}…',
  dingDong: 'Ding Dong',
  kataMatkul: 'materi drive',
  waktuAcara: '{hari} {jam}',
  orang: '{nim} · {prodi}',
} as const;
