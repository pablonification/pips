/**
 * Curhat Yuk!'s inbox for HMIF Welfare, at /kelola/curhat. Words the member side already has come from
 * `curhat.ts`. No exclamation marks in Curhat.
 */
export const kelolaCurhat = {
  daftar: {
    cari: 'Cari ruang atau pesan',
    cariLabel: 'Cari ruang curhat',
    belumDibaca: 'Belum dibaca',
    saring: 'Saring ruang curhat',
    disematkan: 'Disematkan',
    ruangLain: 'Ruang lain',
    // The last message's prefix: yours, a teammate's, or the member's.
    anggota: 'Anggota',
    kosongJudul: 'Belum ada ruang',
    kosongIsi: 'Ruang baru dari anggota muncul di sini.',
    tidakCocok: 'Tidak ada ruang yang cocok',
    tidakCocokIsi: 'Coba kata lain.',
    semuaDibaca: 'Semua sudah dibaca.',
  },
  sematan: {
    opsi: 'Opsi untuk {nama}',
    sematkan: 'Sematkan ruang',
    lepas: 'Lepas sematan',
    disematkan: 'Ruang disematkan.',
    dilepas: 'Sematan dilepas.',
    // A 401 or 403: no access (the role was taken away), never "signed out".
    ditolak: 'Kamu tidak punya akses untuk menyematkan ruang ini.',
    gagal: 'Sematan gagal disimpan. Coba lagi.',
  },
  ruang: {
    // The member's time line and screen-reader prefix: the room's name.
    waktuAnggota: '{nama} · {jam}',
    anggotaSr: '{nama}: ',
    tulis: 'Tulis balasan…',
    tulisLabel: 'Tulis balasan untuk {nama}',
    gagal: 'Balasan belum terkirim. Coba kirim lagi.',
  },
} as const;
