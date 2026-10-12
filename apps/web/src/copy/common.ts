/**
 * Strings the shell and every screen share. Each feature keeps its own module next to this one
 * (`beranda.ts`, `pengumuman.ts`, …); `glossary.ts` lists the house terms, and `tests/copy.test.ts` checks every
 * module against it. Words are the prototype's (`garis/app.js`, `hmif-garis-prototype.html`) where it has them.
 * Placeholders in braces are filled with `fill()` from `./fill`.
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
  // Errors say what happened, then the fix (SPEC "Copy and language"). No exclamation marks.
  errors: {
    halaman: 'Halaman ini gagal dimuat.',
    bagian: 'Bagian ini gagal dimuat.',
    sesi: 'PIPS! belum bisa terhubung. Periksa koneksimu, lalu coba lagi.',
  },
  offline: {
    banner: 'Offline · diperbarui {waktu}',
  },
} as const;
