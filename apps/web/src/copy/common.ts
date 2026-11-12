/**
 * Strings the shell and every screen share. Each feature keeps its own module next to this one
 * (`beranda.ts`, `pengumuman.ts`, …); `glossary.ts` lists the house terms, and `tests/copy.test.ts` checks every
 * module against it. Placeholders in braces are filled with `fill()` from `./fill`.
 */
export const common = {
  app: {
    name: 'PIPS!',
    org: 'HMIF ITB',
    description: 'Aplikasi resmi Himpunan Mahasiswa Informatika ITB',
  },
  nav: {
    beranda: 'Beranda',
    pengumuman: 'Pengumuman',
    kalender: 'Kalender',
    layanan: 'Layanan',
    kelola: 'Kelola',
    profil: 'Profil',
  },
  shell: {
    navigasiUtama: 'Navigasi utama',
    jejakHalaman: 'Jejak halaman',
    cari: 'Cari',
    cariDiPips: 'Cari di PIPS!',
    pencarianGlobal: 'Pencarian global',
    cariPlaceholder: 'Cari layanan, pengumuman, acara, orang…',
    kembaliKe: 'Kembali ke {judul}',
    profilDari: 'Profil, {nama}',
    belumDibaca: '{jumlah} belum dibaca',
    situsLuar: '(situs luar, tab baru)',
    // The skip link.
    langsungKeIsi: 'Langsung ke isi halaman',
    halo: 'Halo, {nama}',
    // Page titles; service names come from the registry.
    buatPengumuman: 'Buat pengumuman',
    mataKuliahku: 'Mata kuliahku',
    tambahMataKuliah: 'Tambah mata kuliah',
    notifikasi: 'Notifikasi',
    kredit: 'Kredit',
    ruang: 'Ruang',
    // Kelola's Live Counting pages ("Kelola › Live Counting"); the page's own heading is
    // the service's full name.
    liveCounting: 'Live Counting',
    judulDokumen: '{judul} · PIPS!',
  },
  // Global search.
  palette: {
    tindakan: 'Tindakan',
    layanan: 'Layanan',
    pintasan: 'Pintasan',
    // The results list's name for screen readers.
    hasil: 'Hasil pencarian',
    situsLuar: 'Situs luar',
    tampilan: 'Tampilan',
    keTerang: 'Ganti ke tampilan terang',
    keGelap: 'Ganti ke tampilan gelap',
    tidakAda: 'Tidak ada hasil untuk “{kata}”.',
    coba: 'Coba “kas”, “UTS”, “IF2110”, nama teman, atau sebuah NIM.',
    pilih: '↑↓ pilih',
    buka: 'Enter buka',
    tutup: 'Esc tutup',
  },
  actions: {
    tutup: 'Tutup',
    batal: 'Batal',
    bagikan: 'Bagikan',
    cobaLagi: 'Coba lagi',
    muatUlang: 'Muat ulang',
    keBeranda: 'Ke Beranda',
    masuk: 'Masuk',
    keluar: 'Keluar',
  },
  // Errors say what happened, then the fix. No exclamation marks.
  errors: {
    halaman: 'Halaman ini gagal dimuat.',
    bagian: 'Bagian ini gagal dimuat.',
    sesi: 'PIPS! belum bisa terhubung. Periksa koneksimu, lalu coba lagi.',
    // An address no page answers.
    tidakDitemukan: 'Halaman tidak ditemukan',
    tidakDitemukanIsi: 'Tautannya mungkin salah atau sudah tidak berlaku.',
  },
  // A file the API won't take (lib/upload-policy.ts): said before anything is sent, or when the API refuses it.
  unggah: {
    jenis: 'Jenis file tidak didukung.',
    ukuran: 'File terlalu besar (maks. 25 MB).',
    jenisFile: 'Jenis file {nama} tidak didukung.',
    ukuranFile: 'File {nama} terlalu besar (maks. 25 MB).',
  },
  offline: {
    banner: 'Offline · diperbarui {waktu}',
    // Nothing on the page has come from the server yet, so there is no time to give.
    bannerTanpaWaktu: 'Offline',
  },
  // The words the Garis components say themselves.
  komponen: {
    urungkan: 'Urungkan',
    memuat: 'Memuat…',
    drafTersimpan: 'Draf tersimpan',
    statusIsi: 'Isi sekarang',
    statusBelumDibuka: 'Belum dibuka',
    statusSudahDiisi: 'Sudah diisi',
    // A closed form.
    statusDitutup: 'Ditutup',
    // Under a course's credits.
    sks: 'SKS',
  },
} as const;
