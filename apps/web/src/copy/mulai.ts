/**
 * First run (`/mulai`, P1-C; SPEC stories 5–7): no locked design (OPEN-QUESTIONS D2, "just make it good"). The steps
 * reuse Beranda's "Perlu ditindaklanjuti" rows and their words (garis/screens-core.js `attention`); the rest is new
 * copy, listed in the P1-C report.
 */
export const mulai = {
  // The page's name in the top bar, the document title and back (new).
  judul: 'Mulai',
  // New: one line under the greeting.
  isi: 'Atur ini dulu supaya PIPS! langsung berguna untukmu.',
  matkul: 'Atur mata kuliah semester ini',
  matkulIsi: 'Ding Dong dan acara Akademik masih kosong.',
  atur: 'Atur',
  notif: 'Notifikasi belum menyala',
  notifMenyala: 'Notifikasi menyala di perangkat ini',
  nyalakan: 'Nyalakan',
  pasang: 'Pasang PIPS!',
  // New: installing is optional.
  pasangIsi: 'Pilihan: buka PIPS! langsung dari layar utama.',
  pasangTombol: 'Pasang',
  // New: a step that's done, as icon, word and colour.
  selesai: 'Selesai',
  langkah: 'Langkah memulai',
  keBeranda: 'Ke Beranda',
  lewati: 'Lewati',
} as const;
