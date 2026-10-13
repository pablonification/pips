/**
 * Profil, Mata kuliahku, Tambah mata kuliah, Notifikasi, Keluar, Kredit and Pasang PIPS! (P1-C). Words are the
 * prototype's (`garis/screens-more.js` `memberCard`, `scrProfil`, `scrMatkul`, `scrMatkulAdd`, `caddResults`,
 * `scrNotif`, `OV.confirm` logout; `garis/app.js` `rm-course`, `pick-k`, `add-courses`, `notif-cat`). Lines marked
 * "new" have no prototype wording (OPEN-QUESTIONS D3, D5, D10) and are listed in the P1-C report.
 */
export const profil = {
  kartu: {
    // The member card's accessible name (memberCard's aria-label).
    label: 'Kartu anggota HMIF: {nama}, NIM {nim}',
  },
  info: {
    judul: 'Informasi akun',
    email: 'Email',
    program: 'Program',
    kampus: 'Kampus',
    semester: 'Semester',
    semesterNilai: '{semester} · {label}',
    grup: 'Grup',
  },
  baris: {
    mataKuliahku: 'Mata kuliahku',
    mataKuliahkuIsi: '{jumlah} mata kuliah · {sks} SKS',
    notifikasi: 'Notifikasi',
    tampilan: 'Tampilan',
    tampilanLabel: 'Tampilan aplikasi',
    sistem: 'Sistem',
    terang: 'Terang',
    gelap: 'Gelap',
    pasang: 'Pasang PIPS!',
    kredit: 'Kredit',
  },
  keluar: {
    tombol: 'Keluar',
    judul: 'Keluar dari PIPS!?',
    isi: 'Kamu perlu masuk lagi dengan email mahasiswa (NIM@std.stei.itb.ac.id). Notifikasi di perangkat ini berhenti sampai kamu masuk lagi.',
    batal: 'Batal',
    // New: sign-out failed; the member stays signed in.
    gagal: 'Gagal keluar. Periksa koneksimu, lalu coba lagi.',
    // New: while sign-out runs.
    keluarProses: 'Keluar…',
  },
  notifikasi: {
    kategori: 'Kategori pengumuman',
    wajib: 'Wajib dari HMIF, tidak bisa dimatikan',
    akademik: 'Termasuk pengingat H-1 acara mata kuliah',
    wajibToast: 'Kategori {nama} wajib dari HMIF dan tidak bisa dimatikan.',
    catatan:
      'Ini hanya mengatur notifikasi. Semua pengumuman tetap muncul di Pengumuman.',
    // New: a mute or unmute failed and the switch went back.
    gagal: 'Notifikasi {nama} gagal diubah. Periksa koneksimu, lalu coba lagi.',
  },
  matkul: {
    semester: 'Semester {semester} · {label}',
    dipakai: 'Dipakai untuk apa?',
    dipakaiIsi:
      'Mata kuliah menentukan isi Ding Dong, acara Akademik di Kalender beserta pengingat H-1, dan pengumuman kelas yang kamu terima. Atur ulang tiap semester.',
    kelas: 'Kelas {kelas}',
    hapus: 'Hapus {kode} {nama} dari daftar',
    jumlahSks: 'Jumlah SKS',
    tambah: 'Tambah mata kuliah',
    kosong: 'Belum ada mata kuliah semester ini',
    dihapus: '{kode} dihapus dari mata kuliahmu.',
    // New: a remove or its undo failed; the list is put back as the server has it.
    hapusGagal: '{kode} gagal dihapus. Periksa koneksimu, lalu coba lagi.',
    urungGagal: '{kode} gagal dikembalikan. Periksa koneksimu, lalu coba lagi.',
    // New: the list couldn't load.
    gagalMuat: 'Mata kuliahmu gagal dimuat.',
  },
  tambah: {
    cari: 'Cari mata kuliah',
    placeholder: 'Cari kode atau nama, misalnya IF2211',
    tidakAda: 'Tidak ada mata kuliah untuk “{kata}”.',
    kelasGrup: 'Kelas {kode}',
    kelasPilihan: 'K{k}',
    tambahkan: 'Tambahkan',
    tambahkanJumlah: '({jumlah})',
    pilihDulu: 'Pilih kelas (K1–K3) di mata kuliah yang mau kamu tambahkan.',
    ditambahkan:
      '{jumlah} mata kuliah ditambahkan. Ding Dong dan Kalender ikut diperbarui.',
    // New: sending the picks, and its failure (the picks stay).
    menambahkan: 'Menambahkan…',
    gagal: 'Mata kuliah gagal ditambahkan. Periksa koneksimu, lalu coba lagi.',
    gagalMuat: 'Daftar mata kuliah gagal dimuat.',
  },
  // Kredit (a toast in the prototype; new copy): its load failed.
  kredit: {
    gagal: 'Kredit gagal dimuat.',
  },
  // Pasang PIPS! (a toast in the prototype; new copy, OPEN-QUESTIONS D3).
  pasang: {
    judul: 'Pasang PIPS!',
    isi: 'Buka PIPS! langsung dari layar utama, seperti aplikasi lain. Di iPhone, notifikasi juga hanya sampai lewat PIPS! yang terpasang.',
    tombol: 'Pasang PIPS!',
    terpasang: 'PIPS! sudah terpasang di perangkat ini.',
    berhasil: 'PIPS! terpasang di perangkat ini.',
    langkahIphone1: 'Ketuk Bagikan di bilah bawah Safari.',
    langkahIphone2: 'Pilih Tambahkan ke Layar Utama.',
    langkahIphone3: 'Ketuk Tambah, lalu buka PIPS! dari layar utama.',
    line: 'Browser di dalam LINE tidak bisa memasang aplikasi. Buka PIPS! di Chrome atau Safari dulu: ketuk menu di pojok, lalu pilih buka di browser lain.',
    android:
      'Buka menu Chrome di pojok kanan atas, lalu pilih Tambahkan ke layar utama.',
    lainnya:
      'Di Chrome atau Edge, pilih ikon pasang di ujung kolom alamat. Di ponsel, pakai menu browser lalu Tambahkan ke layar utama.',
  },
} as const;
