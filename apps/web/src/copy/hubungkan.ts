/**
 * The consent page (`/hubungkan`): an app connecting through MCP asks to use PIPS! as the member. The app's name is
 * shown as the app gave it, as plain text. Its title, and the name of an app with none, are in `common.shell`.
 */
export const hubungkan = {
  // The heading; {nama} is the app's own name.
  judul: '{nama} ingin memakai PIPS! atas namamu',
  // Under Izinkan and Tolak: where the browser returns after either.
  kembaliKe: 'Lalu kembali ke {host}.',
  bolehLabel: 'Yang boleh dilakukan aplikasi ini',
  // The access, in English as apps name it; the same words name it in Aplikasi terhubung (copy/aplikasi.ts). Read is
  // everything the member can see; Write adds changes, so it says so.
  baca: 'Read',
  bacaIsi:
    'Pengumuman, Kalender, Form, Info Lomba, Testi Matkul dan NIM Finder.',
  ubah: 'Write',
  ubahIsi: 'Juga mengirim, mengubah dan menghapus atas namamu.',
  // The privacy note: never Curhat, and the member can take it back.
  aksesmu:
    'Curhat Yuk! tidak termasuk. Kamu bisa memutusnya kapan saja di Profil.',
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
