/**
 * The words dates are said with (`src/lib/dates.ts`), as the prototype's garis/ui.js says them. Day and month
 * names are proper nouns in Indonesian, so they keep their capitals.
 */
export const tanggal = {
  hari: ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'],
  hariPendek: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
  bulan: [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ],
  bulanPendek: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ],
  baruSaja: 'baru saja',
  menitLalu: '{jumlah} menit lalu',
  jamLalu: '{jumlah} jam lalu',
  kemarin: 'kemarin',
} as const;
