/**
 * Ding Dong (P2-B), worded as the prototype words it (garis/screens-more.js `scrDingdong`, garis/app.js `drive`).
 * Lines the prototype has no words for (errors, offline) are new copy, listed in the P2-B report.
 */
export const dingdong = {
  deskripsi:
    'Folder Google Drive berisi materi, soal, dan catatan untuk mata kuliah yang kamu atur semester ini.',
  belumAdaFolder: 'Belum ada folder',
  // The toast for a course without a folder (also Testi Matkul's "Buka Ding Dong" then).
  folderBelumTersedia: 'Folder Ding Dong untuk {kode} belum tersedia.',
  aturMataKuliah: 'Atur mata kuliah',
  kosong: 'Belum ada mata kuliah',
  // New copy: the list failed, or there is nothing kept on the device while offline.
  gagal: 'Mata kuliahmu gagal dimuat.',
  periksaKoneksi: 'Periksa koneksimu, lalu coba lagi.',
  memuat: 'Memuat mata kuliahmu…',
} as const;
