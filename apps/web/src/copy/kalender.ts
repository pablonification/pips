/** Kalender, the event detail and the day rows Beranda shares with it. */
export const kalender = {
  judul: 'Kalender',
  tambahAcara: 'Tambah acara',
  bulanSebelumnya: 'Bulan sebelumnya',
  bulanBerikutnya: 'Bulan berikutnya',
  hariIni: 'Hari ini',
  // The day heading: "Kamis, 8 Oktober · hari ini".
  hariIniKecil: 'hari ini',
  tidakAdaAcara: 'Tidak ada acara.',
  legenda: {
    akademik: 'Akademik',
    himpunan: 'Himpunan',
    aturMataKuliah: 'Atur mata kuliah',
  },
  // An ended event is "(selesai)" for screen readers.
  selesai: '(selesai)',
  acaraHimpunan: 'Acara Himpunan',
  // Desktop: the side column's name and its line before an event is chosen; a full cell's "+1 lagi".
  acaraHariTerpilih: 'Acara hari terpilih',
  pilihAcara: 'Pilih acara untuk melihat detailnya.',
  lagi: '+{jumlah} lagi',
  // Accessible names: a day says its date, today or tomorrow, and how many events it has.
  nama: {
    hariIni: '{hari}, hari ini',
    besok: '{hari}, besok',
    jumlahAcara: '{jumlah} acara',
    tidakAdaAcara: 'tidak ada acara',
    daftarAcara: '{jumlah} acara: {daftar}',
  },
  // Beranda's agenda card.
  delapanHari: '8 hari ke depan',
  pilihHari: 'Pilih hari',
  detail: {
    judul: 'Detail acara',
    akademik: 'Akademik',
    himpunan: 'Himpunan',
    sudahLewat: 'Sudah lewat',
    palingLambat: 'Paling lambat {jam}',
    wib: '{waktu} WIB',
    pengingat: 'Pengingat H-1',
    notifikasiMati: 'Notifikasi belum menyala di perangkat ini',
    // Once its time has passed, only the time: the app can't know whether a reminder reached this member.
    waktuPengingat: '{hari}, {jam}',
    dikirim: 'Dikirim {hari}, {jam}',
    googleCalendar: 'Google Calendar',
    dingDong: 'Ding Dong',
    testiMatkul: 'Testi Matkul',
    tabBaru: '(tab baru)',
  },
  // A day relative to today; the first letter is raised where it starts a line ("Besok, 23.59").
  kapan: {
    hariIni: 'hari ini',
    besok: 'besok',
    kemarin: 'kemarin',
  },
  // Loading names the action; errors say what happened, then the fix.
  memuatAcara: 'Memuat acara…',
  gagal: 'Acara gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  belumTersimpan: 'Acara bulan ini belum tersimpan di perangkat ini.',
  sambungkan: 'Sambungkan ke internet, lalu coba lagi.',
} as const;
