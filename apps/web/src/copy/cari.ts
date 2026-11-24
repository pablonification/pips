/**
 * Global search sources. The palette's own words (Tindakan, Pintasan, the empty result, the key hints) are in
 * `common.palette`. `kata` are hidden words an item is also found by.
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
    kata: 'matkul sks course',
  },
  buatTautan: {
    label: 'Buat tautan pendek',
    hint: 'Tautan pendek',
    kata: 's.hmif.dev link shortener singkat',
  },
  ambilTautan: {
    label: 'Ambil tautan lama s.hmif.dev',
    hint: 'Tautan pendek',
    kata: 'klaim akun lama shortener',
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
