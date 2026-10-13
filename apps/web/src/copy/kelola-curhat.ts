/**
 * Curhat Yuk!'s inbox for HMIF Welfare (P3-C) at /kelola/curhat. The prototype has no inbox (OPEN-QUESTIONS D9), so
 * it is built from the member side's pieces (`scrCurhat`, `scrRoom`, `menuBtn`, the Pengumuman toolbar's chip,
 * `emptyState`). Words the member side already has come from `curhat.ts`; every string here is new copy, a proposal
 * listed in reports/P3-C-curhat-inbox.md for the owner. No exclamation marks in Curhat (SPEC "Copy and language").
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
