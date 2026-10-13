/**
 * Sign-in (`/login`, P1-C): no locked design (OPEN-QUESTIONS D3, "just make it good"). Every line is new copy,
 * listed in the P1-C report; the sign-out confirmation's wording ("email mahasiswa (NIM@std.stei.itb.ac.id)") is
 * the prototype's. Errors say what happened, then the fix.
 */
export const masuk = {
  judul: 'Masuk',
  isi: 'Pakai akun Google email mahasiswamu (NIM@std.stei.itb.ac.id).',
  google: 'Masuk dengan Google',
  memproses: 'Masuk…',
  // 401: either cause, since the API can't tell them apart.
  bukanAnggota:
    'Akun ini belum bisa masuk. Pakai email mahasiswa (NIM@std.stei.itb.ac.id); kalau sudah, akunmu mungkin belum ada di daftar anggota HMIF.',
  gagal: 'PIPS! belum bisa memproses masuk. Periksa koneksimu, lalu coba lagi.',
  popupDiblokir:
    'Jendela masuk Google diblokir browser. Izinkan pop-up untuk PIPS!, lalu coba lagi.',
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
