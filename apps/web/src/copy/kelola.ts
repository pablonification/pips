/**
 * Kelola: the hub, Live Counting and Rekap Form. The hub's rows come from the service
 * registry.
 */
export const kelola = {
  // The forms entry (/kelola/live) with two or more active forms; one forwards, none shows the empty line.
  formulir: {
    belumAda: 'Belum ada form',
    dibuka: 'Dibuka {waktu}',
    ditutup: 'Ditutup {waktu}',
    memuat: 'Memuat form…',
    gagal: 'Daftar form gagal dimuat.',
  },
  live: {
    // The plaque; "terakhir {hari}, {waktu} WIB" when the newest response isn't from today.
    orangMengisi: 'orang sudah mengisi',
    terakhir: 'terakhir {waktu} WIB',
    terakhirHari: 'terakhir {hari}, {waktu} WIB',
    pengisiTerbaru: 'Pengisi terbaru',
    semua: 'Semua',
    analitik: 'Analitik jawaban',
    belumAdaPengisi: 'Belum ada yang mengisi form ini.',
    memuat: 'Memuat Live Counting…',
    gagalJumlah: 'Jumlah pengisi gagal dimuat.',
    gagalPengisi: 'Pengisi terbaru gagal dimuat.',
    gagalAnalitik: 'Analitik jawaban gagal dimuat.',
    gagalForm: 'Form gagal dimuat.',
    tidakDitemukan: 'Form tidak ditemukan',
    tidakDitemukanIsi: 'Mungkin form ini sudah dihapus.',
    keKelola: 'Ke Kelola',
  },
  ekspor: {
    tombol: 'Export CSV',
    mengekspor: 'Mengekspor…',
    jawaban: 'Rekap {jumlah} jawaban diunduh sebagai CSV.',
    gagal: 'CSV gagal diunduh.',
  },
  rekap: {
    judul: 'Rekap Form',
    // NIM Finder's search, and the start of its result line.
    cari: 'Cari nama atau NIM',
    cariPlaceholder: 'Ketik nama atau NIM',
    hasil: '{jumlah} hasil.',
    tidakCocok: 'Tidak ada respon yang cocok.',
    memuat: 'Memuat rekap…',
    gagal: 'Rekap gagal dimuat.',
    // Testi Matkul's pager.
    sebelumnya: 'Sebelumnya',
    berikutnya: 'Berikutnya',
    halamanSebelumnya: 'Halaman sebelumnya',
    halamanBerikutnya: 'Halaman berikutnya',
    halaman: '{nomor} / {jumlah}',
  },
} as const;
