/**
 * Kalender, the event detail and the day rows Beranda shares with it (P1-A). Words are the prototype's
 * (`garis/screens-core.js` `scrKalender`, `phoneMonth`, `agendaRow`, `dayList`, `legend`, `monthNav`, `addEvBtn`,
 * `evInfo`, `agendaCard`; `garis/screens-more.js` `OV.event`; `garis/ui.js` `whenDay`). Loading, error and offline
 * lines aren't in the prototype: they are new copy, listed in the P1-A report.
 */
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
    batasWaktu: 'Batas waktu',
    aturMataKuliah: 'Atur mata kuliah',
  },
  // A deadline's row says "Batas" under its time; an ended event is "(selesai)" for screen readers.
  batas: 'Batas',
  selesai: '(selesai)',
  acaraHimpunan: 'Acara Himpunan',
  // Desktop: the side column's name and its line before an event is chosen; a full cell's "+1 lagi".
  acaraHariTerpilih: 'Acara hari terpilih',
  pilihAcara: 'Pilih acara untuk melihat detailnya.',
  lagi: '+{jumlah} lagi',
  // Accessible names (SPEC story 33): a day says its date, today or tomorrow, and how many events it has.
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
  // The event detail (`evInfo`, `OV.event`).
  detail: {
    judul: 'Detail acara',
    akademik: 'Akademik',
    himpunan: 'Himpunan',
    sudahLewat: 'Sudah lewat',
    palingLambat: 'Paling lambat {jam}',
    wib: '{waktu} WIB',
    pengingat: 'Pengingat H-1',
    notifikasiMati: 'Notifikasi belum menyala di perangkat ini',
    sudahDikirim: 'Sudah dikirim {hari}, {jam}',
    dikirim: 'Dikirim {hari}, {jam}',
    googleCalendar: 'Google Calendar',
    dingDong: 'Ding Dong',
    testiMatkul: 'Testi Matkul',
    tabBaru: '(tab baru)',
  },
  // A day relative to today (`whenDay`); the first letter is raised where it starts a line ("Besok, 23.59").
  kapan: {
    hariIni: 'hari ini',
    besok: 'besok',
    kemarin: 'kemarin',
  },
  // New copy: loading names the action; errors say what happened, then the fix.
  memuatAcara: 'Memuat acara…',
  gagal: 'Acara gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  belumTersimpan: 'Acara bulan ini belum tersimpan di perangkat ini.',
  sambungkan: 'Sambungkan ke internet, lalu coba lagi.',
} as const;
