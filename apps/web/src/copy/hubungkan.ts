/**
 * The consent page (`/hubungkan`): an app connecting through MCP asks to use PIPS! as the member. The app's name is
 * shown as the app gave it, as plain text. Its title, and the name of an app with none, are in `common.shell`.
 */
export const hubungkan = {
  // The heading; {nama} is the app's own name.
  judul: '{nama} ingin memakai PIPS! atas namamu',
  // Where the browser returns after Izinkan or Tolak.
  kembaliKe: 'Setelah ini kamu kembali ke {host}.',
  bolehLabel: 'Yang boleh dilakukan aplikasi ini',
  baca: 'Membaca yang bisa kamu lihat',
  bacaIsi:
    'Pengumuman, Kalender, Form, Info Lomba, Testi Matkul dan NIM Finder.',
  // When the app asks to change things too, the member chooses: both, or reading only. The same words name the
  // access in Aplikasi terhubung (copy/aplikasi.ts).
  bacaUbah: 'Baca dan ubah',
  bacaUbahIsi:
    'Juga mengirim, mengubah dan menghapus atas namamu, misalnya komentar atau jawaban Form.',
  hanyaBaca: 'Hanya baca',
  hanyaBacaIsi: 'Membaca yang bisa kamu lihat, tanpa mengubah apa pun.',
  // The privacy note: the app has only the member's own access, never Curhat.
  aksesmu:
    'Aplikasi ini hanya bisa melakukan yang boleh kamu lakukan di PIPS!. Curhat Yuk! tidak termasuk. Kamu bisa memutusnya kapan saja di Profil.',
  izinkan: 'Izinkan',
  tolak: 'Tolak',
  // After a choice, while the browser leaves for the app.
  mengalihkan: 'Mengalihkan…',
  // The request expired, was already answered, or the address is wrong.
  habis: 'Permintaan ini sudah tidak berlaku',
  habisIsi: 'Mulai lagi dari aplikasinya untuk menghubungkan PIPS!.',
  keBeranda: 'Ke Beranda',
  // The request couldn't load.
  gagalMuat: 'Permintaan gagal dimuat.',
  // Izinkan or Tolak failed; the member stays on the page.
  gagal: 'Pilihanmu gagal dikirim. Periksa koneksimu, lalu coba lagi.',
} as const;
