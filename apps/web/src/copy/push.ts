/**
 * Push notifications on this device (P1-C): the prompt, the Notifikasi card, the Profil row's state and the toasts.
 * Words are the prototype's (`garis/screens-more.js` `OV.push`, `scrNotif`, `scrProfil`; `garis/app.js` `push-allow`,
 * `push-deny`). The states the prototype doesn't draw (diblokir, perlu pasang, tidak didukung), the errors and the
 * test notification are new copy (OPEN-QUESTIONS D5), listed in the P1-C report.
 */
export const push = {
  prompt: {
    judul: 'Nyalakan notifikasi?',
    isi: 'Pengumuman baru, pengingat H-1, dan balasan Curhat akan sampai ke perangkat ini.',
    iphone: 'Di iPhone, pasang PIPS! ke layar utama dulu.',
    nanti: 'Nanti saja',
    nyalakan: 'Nyalakan',
    // New: while permission, subscription and registration run.
    menyalakan: 'Menyalakan…',
  },
  toast: {
    menyala: 'Notifikasi menyala di perangkat ini.',
    tetapMati: 'Notifikasi tetap mati. Nyalakan kapan saja di Profil.',
    ujiTerkirim: 'Notifikasi uji terkirim ke perangkat ini.',
    // New: errors say what happened, then the fix.
    gagal: 'Notifikasi belum menyala. Periksa koneksimu, lalu coba lagi.',
    diblokir:
      'Notifikasi diblokir di browser ini. Caranya membuka lagi ada di Profil › Notifikasi.',
    ujiGagal: 'Notifikasi uji gagal ditampilkan. Coba lagi sebentar lagi.',
  },
  // The Notifikasi card, one per state.
  kartu: {
    aktif: 'Notifikasi menyala di perangkat ini',
    kirimUji: 'Kirim notifikasi uji',
    belum: 'Notifikasi belum menyala di perangkat ini',
    belumIsi:
      'Tanpa ini, pengumuman baru, pengingat H-1, dan balasan Curhat tidak akan sampai.',
    nyalakan: 'Nyalakan notifikasi',
    diblokir: 'Notifikasi diblokir di perangkat ini',
    diblokirIsi:
      'Izin notifikasi untuk PIPS! pernah ditolak. Izinkan lagi lewat ikon di samping alamat situs, atau lewat info aplikasi kalau PIPS! terpasang, lalu buka lagi.',
    perluPasang: 'Pasang PIPS! dulu untuk menyalakan notifikasi',
    perluPasangIsi:
      'Di iPhone, notifikasi hanya sampai lewat PIPS! yang terpasang di layar utama. Pasang dulu, lalu buka PIPS! dari sana.',
    pasang: 'Pasang PIPS!',
    tidakDidukung: 'Browser ini tidak mendukung notifikasi',
    tidakDidukungIsi:
      'Buka PIPS! di Chrome, Edge, Firefox, atau Safari versi terbaru untuk menerima notifikasi.',
  },
  // The Profil row's state, after a square in the state's colour.
  baris: {
    aktif: 'Menyala di perangkat ini',
    belum: 'Belum menyala di perangkat ini',
    diblokir: 'Diblokir di perangkat ini',
    perluPasang: 'Perlu dipasang ke layar utama',
    tidakDidukung: 'Tidak didukung di browser ini',
  },
  // The notification Kirim notifikasi uji shows.
  uji: {
    judul: 'Notifikasi uji',
    isi: 'Pengumuman baru, pengingat H-1, dan balasan Curhat akan muncul seperti ini.',
  },
} as const;
