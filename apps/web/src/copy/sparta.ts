/**
 * Magang SPARTA for members (P2-A). The prototype has no member screen (the season is closed; the owner asked for it
 * to be built anyway, OPEN-QUESTIONS D4), so all of this is new copy, composed with the form's words where they mean the
 * same thing, listed in the P2-A report for the owner. The closing line is the prototype's ("Pendaftaran ditutup Min,
 * 23 Agu 2026 pukul 23.59", garis/app.js `A.svc`); the eligibility note is from `FEATURE_MAP` ("hanya untuk angkatan
 * 2025"); the step names are today's screen's, in sentence case, and so are its toasts.
 */
export const sparta = {
  memuat: 'Memuat Magang SPARTA…',
  gagal: 'Magang SPARTA gagal dimuat.',
  bukanUntukmu: {
    judul: 'Magang SPARTA hanya untuk angkatan 2025',
    isi: 'Pilihan divisi magang dibuka untuk angkatan 2025, juga beberapa anggota yang sudah disetujui HMIF.',
  },
  ditutup: 'Pendaftaran ditutup {waktu}',
  ditutupTanpaWaktu: 'Pendaftaran sudah ditutup',
  belumDibuka: 'Pendaftaran dibuka {waktu}',
  belumDibukaTanpaWaktu: 'Pendaftaran belum dibuka',
  tidakAdaKiriman: 'Kamu belum mengirim pilihan divisi.',
  statusTerkirim: 'Sudah dikirim',
  statusDraf: 'Belum dikirim',
  // The deadline and the four steps up front.
  tenggat: 'Batas waktu {waktu}',
  mulai: 'Mulai',
  lanjutkan: 'Lanjutkan',
  langkah: [
    'Info umum',
    'Penjelasan divisi',
    'Pilih divisi',
    'Pertanyaan divisi',
  ],
  langkahDari: 'Langkah {nomor} dari {jumlah} · {judul}',
  umum: {
    kelas: 'Kelas',
    idLine: 'ID LINE',
    pengalaman: 'Pengalaman organisasi',
    kesibukan: 'Kesibukan saat ini',
    kesibukanKe: 'Kesibukan {nomor}',
    jabatan: 'Jabatan',
    organisasi: 'Organisasi',
    periode: 'Periode',
    tambahKesibukan: 'Tambah kesibukan',
    hapusKesibukan: 'Hapus kesibukan {nomor}',
    hapus: 'Hapus',
  },
  pilih: {
    petunjuk:
      'Pilih tepat 4 divisi. Urutannya adalah prioritasmu, yang pertama paling diinginkan.',
    urutan: 'Urutan prioritas',
    kosong: 'Belum ada divisi yang dipilih.',
    kurang: 'Pilih tepat 4 divisi.',
    naik: 'Naikkan',
    turun: 'Turunkan',
    naikLabel: 'Naikkan {divisi} ke prioritas {nomor}',
    turunLabel: 'Turunkan {divisi} ke prioritas {nomor}',
    dipindah: '{divisi} sekarang prioritas {nomor}.',
  },
  pertanyaan: {
    pilihanKe: 'Pilihan {nomor}: {divisi}',
    pilihJawaban: 'Pilih jawaban',
    unggah: 'Unggah file',
    mengunggah: 'Mengunggah…',
    lihatFile: 'Lihat file yang terunggah',
    gagalUnggah: 'File gagal diunggah. Coba lagi.',
    pertanyaanAsli: 'Pertanyaan lengkap dari divisi',
  },
  draf: {
    gagal: 'Draf belum tersimpan.',
  },
  periksa: {
    judul: 'Periksa pilihanmu',
    kirim: 'Kirim pilihan',
    pilihan: 'Pilihan divisi',
    prioritas: 'Prioritas {nomor}',
  },
  kirim: {
    judul: 'Kirim pilihan divisi?',
    isi: 'Pilihan dan jawabanmu terkunci setelah dikirim dan tidak bisa diubah lagi.',
    periksaLagi: 'Periksa lagi',
    kirim: 'Kirim',
    mengirim: 'Mengirim…',
    berhasil: 'Pilihan magang berhasil dikirim!',
    gagal: 'Pilihanmu belum terkirim. Periksa koneksimu, lalu coba lagi.',
  },
  kembali: 'Kembali ke Layanan',
} as const;
