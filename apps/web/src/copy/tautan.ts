/**
 * Tautan pendek: s.hmif.dev inside PIPS!. The member's list, making a link, a link's page, taking links from an old
 * s.hmif.dev account, Kelola's list of every link, and the page an unknown name opens.
 */
export const tautan = {
  judul: 'Tautan pendek',
  /** The address's fixed part, shown before every name. */
  host: 's.hmif.dev/',

  daftar: {
    cari: 'Cari tautanmu',
    cariPlaceholder: 'Cari nama atau tujuan',
    urutkan: 'Urutkan',
    terbaru: 'Terbaru',
    palingDiklik: 'Paling diklik',
    cocok: '{jumlah} tautan cocok',
    tidakAda: 'Tidak ada tautanmu dengan “{q}”.',
    klik: 'klik',
    salinNama: 'Salin s.hmif.dev/{nama}',
    tampilkanLagi: 'Tampilkan {jumlah} lagi',
    dariSisa: 'dari {jumlah}',
    ambilBaris: 'Ambil tautan dari akun lama s.hmif.dev',
    ambilLama: 'Ambil tautan lama',
    buat: 'Buat tautan',
    kosong: 'Belum ada tautan',
    form: 'Form',
    memuat: 'Memuat tautanmu…',
    gagal: 'Tautanmu gagal dimuat.',
    periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  },

  buat: {
    judul: 'Buat tautan pendek',
    tujuan: 'Tujuan',
    namaPendek: 'Nama pendek',
    kosongkan: 'Kosongkan untuk nama acak.',
    batal: 'Batal',
    buat: 'Buat tautan',
    membuat: 'Membuat…',
    siap: 'Tautan siap',
    selesai: 'Selesai',
    gagal: 'Tautan gagal dibuat. Coba lagi.',
  },

  /** The destination's checks, in the order the field shows them. */
  tujuanMasalah: {
    kosong: 'Tempel alamatnya dulu',
    self: 'Ini sudah tautan s.hmif.dev',
    invalid: 'Tulis alamat lengkap, diawali https://',
  },

  salin: {
    salin: 'Salin tautan',
    disalin: 'Tautan disalin',
    disalinToast: 'Tautan disalin.',
    gagal: 'Tautan gagal disalin. Salin dari alamatnya.',
    bagikanLewat: 'Bagikan lewat…',
  },

  tautan: {
    ubah: 'Ubah',
    ubahNama: 'Ubah nama pendek',
    ubahTujuan: 'Ubah tujuan',
    tujuanBaru: 'Tujuan baru',
    simpan: 'Simpan',
    menyimpan: 'Menyimpan…',
    batal: 'Batal',
    fakta: {
      tujuan: 'Tujuan',
      membuka: 'Membuka',
      dibuka: 'Dibuka',
      dibuat: 'Dibuat',
      diubah: 'Diubah',
      namaLama: 'Nama lama',
      pemilik: 'Pemilik',
    },
    kali: '{jumlah} kali',
    membukaForm: 'Form “{judul}”',
    bukaForm: 'Buka formnya',
    tetapBisa: 's.hmif.dev/{nama} tetap bisa dibuka.',
    tujuanDiubah: 'Tujuan diubah.',
    namaDiubah: 'Nama diubah. Alamat lama tetap bisa dibuka.',
    gagalUbah: 'Perubahan gagal disimpan. Coba lagi.',
    hapus: 'Hapus tautan',
    hapusJudul: 'Hapus s.hmif.dev/{nama}?',
    hapusBerhenti: 'Alamat ini berhenti bekerja,',
    hapusTermasuk: 'termasuk yang sudah dibagikan atau dicetak.',
    hapusDibuka: 'Sudah dibuka {jumlah} kali.',
    hapusAkhir: 'Tidak bisa dibatalkan, dan namanya tidak bisa dipakai lagi.',
    hapusDiberiTahu: '{nama}, pemiliknya, akan diberi tahu lewat notifikasi.',
    dihapus: 'Tautan dihapus.',
    gagalHapus: 'Tautan gagal dihapus. Coba lagi.',
    memuat: 'Memuat tautan…',
    gagal: 'Tautan gagal dimuat.',
    tidakAda: 'Tautan tidak ditemukan',
    lihatTautanku: 'Lihat tautanku',
    dipindahkan: 'Tautan ini sudah dipindahkan',
    dipindahkanIsi:
      's.hmif.dev/{nama} sekarang milik {pemilik}. Alamatnya tetap bisa dibuka.',
    sudahDihapus: 'Tautan ini sudah dihapus',
    sudahDihapusIsi: 's.hmif.dev/{nama} tidak bisa dibuka lagi.',
  },

  ambil: {
    judul: 'Ambil tautan lama',
    untuk:
      'Untuk akun s.hmif.dev selain email mahasiswa. Bisa sampai {tanggal}.',
    pengguna: 'Nama pengguna atau email',
    sandi: 'Kata sandi s.hmif.dev',
    isiKeduanya: 'Isi nama pengguna dan kata sandinya',
    tidakCocok: 'Nama pengguna atau kata sandi tidak cocok.',
    sisa: 'Sisa {jumlah} percobaan.',
    terkunci: 'Terlalu banyak percobaan. Coba lagi pukul {waktu}.',
    sibuk: 'Sedang sibuk. Coba lagi sebentar lagi.',
    tidakDisimpan: 'Kata sandi ini tidak disimpan.',
    cari: 'Cari tautanku',
    mencari: 'Mencari…',
    lupa: 'Lupa kata sandinya? Minta admin HMIF memindahkan tautanmu.',
    ditemukan: '{jumlah} tautan ini akan jadi milikmu',
    dariAkun: 'Dari akun lama',
    jadikanMilikku: 'Jadikan milikku',
    memindahkan: 'Memindahkan…',
    bukanAkunku: 'Bukan akunku',
    selesai: '{jumlah} tautan sekarang milikmu',
    lihatTautanku: 'Lihat tautanku',
    diambil: 'Tautan akun ini sudah diambil',
    diambilIsi:
      'Diambil anggota lain {hari} pukul {waktu}. Kalau bukan kamu, hubungi admin HMIF.',
    kosong: 'Akun ini tidak punya tautan',
    milikmu: 'Tautan akun ini sudah ada di daftarmu',
    duaLangkah:
      'Akun ini memakai verifikasi dua langkah. Minta admin HMIF memindahkan tautanmu.',
    cobaAkunLain: 'Coba akun lain',
    berakhir: 'Pengambilan tautan lama sudah berakhir.',
    kedaluwarsa: 'Waktunya habis. Cari tautanmu lagi.',
    keduluan: 'Tautan akun ini baru saja diambil anggota lain.',
    gagal: 'Pencarian gagal. Coba lagi.',
  },

  kelola: {
    cari: 'Cari tautan',
    cariPlaceholder: 'Cari nama, tujuan, atau pemilik',
    tampilan: 'Tautan yang ditampilkan',
    semua: 'Semua',
    belumDiambil: 'Belum diambil',
    jumlah: '{jumlah} tautan',
    dariAkun: '{jumlah} tautan dari {akun} akun lama',
    tidakAda: 'Tidak ada tautan dengan “{q}”.',
    akunLama: 'Akun lama {akun}',
    berikan: 'Berikan ke anggota',
    pindahkan: 'Pindahkan',
    memuat: 'Memuat tautan…',
    gagal: 'Daftar tautan gagal dimuat.',
  },

  beri: {
    judulBerikan: 'Berikan s.hmif.dev/{nama}',
    judulPindahkan: 'Pindahkan s.hmif.dev/{nama}',
    cari: 'Cari anggota: nama atau NIM',
    tidakAda: 'Tidak ada anggota dengan nama atau NIM “{q}”.',
    mencari: 'Mencari…',
    gagalCari: 'Pencarian gagal. Coba lagi.',
    dipilih: 'Dipilih',
    diberiTahu:
      '{nama}, pemiliknya sekarang, akan diberi tahu lewat notifikasi.',
    jugaLainnya: 'Juga {jumlah} tautan lain dari akun lama {akun}',
    berikan: 'Berikan',
    pindahkan: 'Pindahkan',
    satu: 's.hmif.dev/{nama} sekarang milik {pemilik}.',
    banyak: '{jumlah} tautan sekarang milik {pemilik}.',
    gagal: 'Tautan gagal dipindahkan. Coba lagi.',
  },

  /** s.hmif.dev/<a name no link has>: a page of its own, with no app around it. */
  tidakDitemukan: {
    judul: 'Tautan tidak ditemukan',
    ejaan: 'Periksa lagi ejaannya.',
    bukaPips: 'Buka PIPS!',
  },

  /** Global search's two actions. */
  cariAksi: {
    buat: {
      label: 'Buat tautan pendek',
      kata: 's.hmif.dev link shortener singkat',
    },
    ambil: {
      label: 'Ambil tautan lama s.hmif.dev',
      kata: 'klaim akun lama shortener',
    },
  },
} as const;
