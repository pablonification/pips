/** Adding, changing and deleting calendar events. */
export const kelolaAcara = {
  judul: {
    akademik: 'Tambah acara Akademik',
    himpunan: 'Tambah acara Himpunan',
    ubah: 'Ubah acara',
  },
  mataKuliah: 'Mata kuliah',
  mataKuliahCatatan:
    'Muncul di kalender anggota yang mengambil mata kuliah ini.',
  judulField: 'Judul',
  contohJudul: {
    akademik: 'Misalnya Kuis 2 atau Deadline Tugas Besar 1',
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
    waktu: 'Isi tanggal dan jam acara.',
    selesai: 'Jam selesai tidak boleh sebelum jam mulai.',
  },
  ditambahkanAkademik:
    'Acara ditambahkan ke kalender anggota {kode} dan Google Calendar-nya.',
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
  // The course catalogue failing inside the dialog, and its loading line.
  katalogGagal: 'Mata kuliah gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  memuatKatalog: 'Memuat mata kuliah…',
} as const;
