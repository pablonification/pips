/**
 * Sign-in (`/login`): Garis v5's Masuk screen (garis/screens-masuk.js, locked 2026-11-02). The greeting, the slides
 * and their screen-reader labels are the prototype's; the button, the hint, the loading text and the errors are
 * P1-C's, which the prototype took over unchanged. Errors say what happened, then the fix.
 */
export const masuk = {
  // The document title ("Masuk · PIPS!"); the page's own heading is the greeting.
  judul: 'Masuk',
  halo: 'Halo, Pips!',
  isi: 'Pakai akun Google email mahasiswamu (NIM@std.stei.itb.ac.id).',
  google: 'Masuk dengan Google',
  memproses: 'Masuk…',
  // 401: either cause, since the API can't tell them apart.
  bukanAnggota:
    'Akun ini belum bisa masuk. Pakai email mahasiswa (NIM@std.stei.itb.ac.id); kalau sudah, akunmu mungkin belum ada di daftar anggota HMIF.',
  gagal: 'PIPS! belum bisa memproses masuk. Periksa koneksimu, lalu coba lagi.',
  popupDiblokir:
    'Jendela masuk Google diblokir browser. Izinkan pop-up untuk PIPS!, lalu coba lagi.',
  // The four slides, each the feature's own name and one plain line (owner, 2026-11-02).
  slides: [
    {
      judul: 'Pengumuman',
      isi: 'Info dari HMIF untuk angkatan dan grupmu.',
    },
    { judul: 'Kalender', isi: 'Kuis, ujian, dan acara HMIF.' },
    {
      judul: 'Layanan',
      isi: 'Ding Dong, Testi Matkul, NIM Finder, dan lainnya.',
    },
    {
      judul: 'Curhat Yuk!',
      isi: 'Cerita ke Welfare HMIF. Namamu tidak ditampilkan.',
    },
  ],
  // Screen-reader labels of the slides.
  kenalan: 'Kenalan dengan PIPS!',
  geser: 'Geser untuk slide berikutnya',
  sebelumnya: 'Slide sebelumnya',
  berikutnya: 'Slide berikutnya',
  dariJumlah: '{nomor} dari {jumlah}',
  // The staging test login (never in production builds).
  uji: {
    judul: 'Akun uji',
    email: 'Email',
    sandi: 'Kata sandi',
    tombol: 'Masuk dengan akun uji',
    salah: 'Email atau kata sandi salah.',
    tidakTersedia: 'Akun uji tidak tersedia di server ini.',
  },
} as const;
