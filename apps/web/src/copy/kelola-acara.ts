/**
 * P3-B: adding, changing and deleting calendar events. The Akademik dialog is worded as the prototype words it
 * (garis/screens-core.js `addEventForm`, screens-more.js `OV.addev`, app.js's `addev` submit branch); everything
 * else is new copy (proposals, listed in the P3-B report).
 */
export const kelolaAcara = {
  judul: {
    akademik: 'Tambah acara Akademik',
    // New copy (proposals).
    himpunan: 'Tambah acara Himpunan',
    ubah: 'Ubah acara',
  },
  mataKuliah: 'Mata kuliah',
  mataKuliahCatatan:
    'Muncul di kalender anggota yang mengambil mata kuliah ini.',
  judulField: 'Judul',
  contohJudul: {
    akademik: 'Misalnya Kuis 2 atau Deadline Tugas Besar 1',
    // New copy (proposal).
    himpunan: 'Misalnya Rapat Anggota HMIF',
  },
  tanggal: 'Tanggal',
  mulai: 'Mulai',
  selesai: 'Selesai',
  deskripsi: 'Deskripsi',
  opsional: '(opsional)',
  contohDeskripsi: 'Materi, tempat, atau cara pengumpulan',
  batal: 'Batal',
  tambahkan: 'Tambahkan',
  galat: {
    judul: 'Tulis judul acara, misalnya Kuis 2.',
    // New copy (proposals).
    waktu: 'Isi tanggal dan jam acara.',
    selesai: 'Jam selesai tidak boleh sebelum jam mulai.',
  },
  ditambahkanAkademik:
    'Acara ditambahkan ke kalender anggota {kode} dan Google Calendar-nya.',
  // New copy (proposals).
  ditambahkanHimpunan:
    'Acara ditambahkan ke kalender semua anggota dan Google Calendar-nya.',
  jenis: 'Jenis acara',
  akademik: 'Akademik',
  himpunan: 'Himpunan',
  simpan: 'Simpan',
  diperbarui: 'Acara diperbarui.',
  opsi: 'Opsi acara {judul}',
  ubah: 'Ubah acara',
  hapus: 'Hapus acara',
  hapusJudul: 'Hapus acara ini?',
  hapusIsi:
    'Acara hilang dari kalender anggota dan Google Calendar-nya. Ini tidak bisa diurungkan.',
  hapusTombol: 'Hapus',
  dihapus: 'Acara dihapus.',
  // New copy: the course catalogue failing inside the dialog, and its loading line.
  katalogGagal: 'Mata kuliah gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  memuatKatalog: 'Memuat mata kuliah…',
} as const;
