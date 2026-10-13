/**
 * P3-B: what a failed management write says (adding, changing or deleting events, competitions and
 * testimonials). New copy, cause then fix (SPEC "Copy and language"); never the API's own text. A 401 or 403
 * from these writes is "no access", never "signed out" (only the session check signs a member out).
 */
export const kelolaTulis = {
  tanpaAkses:
    'Akunmu tidak punya akses untuk ini. Hubungi pengurus HMIF kalau ini keliru.',
  gagal: 'Perubahan belum tersimpan. Periksa koneksimu, lalu coba lagi.',
} as const;
