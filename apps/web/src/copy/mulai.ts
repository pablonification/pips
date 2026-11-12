/**
 * First run (`/mulai`). The steps reuse Beranda's "Perlu ditindaklanjuti" rows and their words.
 */
export const mulai = {
  // The page's name in the top bar, the document title and back.
  judul: 'Mulai',
  // One line under the greeting.
  isi: 'Atur ini dulu supaya PIPS! langsung berguna untukmu.',
  matkul: 'Atur mata kuliah semester ini',
  matkulIsi: 'Ding Dong dan acara Akademik masih kosong.',
  atur: 'Atur',
  notif: 'Notifikasi belum menyala',
  notifMenyala: 'Notifikasi menyala di perangkat ini',
  nyalakan: 'Nyalakan',
  pasang: 'Pasang PIPS!',
  // Installing is optional.
  pasangIsi: 'Pilihan: buka PIPS! langsung dari layar utama.',
  pasangTombol: 'Pasang',
  // A step that's done, as icon, word and colour.
  selesai: 'Selesai',
  langkah: 'Langkah memulai',
  keBeranda: 'Ke Beranda',
  lewati: 'Lewati',
} as const;
