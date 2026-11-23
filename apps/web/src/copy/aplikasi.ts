/**
 * Profil › Aplikasi terhubung (`/profil/aplikasi`): the apps a member connected through MCP. Its title, and the name
 * of an app with none, are in `common.shell`.
 */
export const aplikasi = {
  // What a connected app may do, as the consent page's choice names it (copy/hubungkan.ts).
  baca: 'Read',
  ubah: 'Write',
  // A connected app's line: when it was connected, and when it was last used.
  sejak: 'Terhubung {tanggal}',
  dipakai: 'Terakhir dipakai {tanggal}',
  belumDipakai: 'Belum dipakai',
  putuskan: 'Putuskan',
  putuskanLabel: 'Putuskan {nama}',
  putuskanJudul: 'Putuskan {nama}?',
  putuskanIsi:
    '{nama} tidak bisa lagi memakai PIPS! atas namamu. Untuk memakainya lagi, hubungkan ulang dari aplikasinya.',
  batal: 'Batal',
  // While the revoke runs.
  memutuskan: 'Memutuskan…',
  diputus: '{nama} diputus dari PIPS!.',
  putusGagal: '{nama} gagal diputus. Periksa koneksimu, lalu coba lagi.',
  kosong: 'Belum ada aplikasi terhubung',
  // How to connect one: the MCP address of this PIPS!.
  kosongIsi:
    'Aplikasi yang mendukung MCP bisa memakai PIPS! atas namamu. Tambahkan alamat ini di aplikasinya:',
  gagalMuatDaftar: 'Aplikasi terhubung gagal dimuat.',
} as const;
