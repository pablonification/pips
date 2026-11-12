import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { extractUrls } from '../src/lib/url-parser';

/** What the link finder recognised in ordinary post and testimonial text, pinned so the pattern can't drift. */
const CASES: [string, string[]][] = [
  [
    'Daftar di https://docs.google.com/forms/d/e/abc/viewform sebelum Jumat.',
    ['https://docs.google.com/forms/d/e/abc/viewform'],
  ],
  [
    'Info lengkap: https://s.hmif.dev/BayarKasHMIF',
    ['https://s.hmif.dev/BayarKasHMIF'],
  ],
  ['Cek hmif.dev.', ['hmif.dev']],
  ['Kunjungi www.example.co.uk, ya!', ['www.example.co.uk']],
  [
    'Link (https://bit.ly/abc) dan [s.hmif.dev/LowonginAja!]',
    ['https://bit.ly/abc', 's.hmif.dev/LowonginAja'],
  ],
  [
    'Jadwal: https://docs.google.com/spreadsheets/d/jadwal-uts?usp=sharing#gid=0;',
    ['https://docs.google.com/spreadsheets/d/jadwal-uts?usp=sharing#gid=0'],
  ],
  ['Rapat jam 10:00 di Labtek V: bawa laptop: wajib', []],
  [
    'Kirim ke budi@std.stei.itb.ac.id atau 13525001@std.stei.itb.ac.id',
    ['budi@std.stei.itb.ac.id', '13525001@std.stei.itb.ac.id'],
  ],
  [
    'Baca https://medium.com/@hmif/tulisan-baru dan http://localhost:3000/x',
    ['https://medium.com/@hmif/tulisan-baru'],
  ],
  [
    'ftp://files.example.com/a/b.txt dan https://example.com:8080/path',
    ['ftp://files.example.com/a/b.txt', 'https://example.com:8080/path'],
  ],
  [
    'Dua kali https://a.example.com dan https://a.example.com lagi',
    ['https://a.example.com'],
  ],
  [
    '"https://quoted.example.org/x" serta \'www.single.id\'',
    ['https://quoted.example.org/x', 'www.single.id'],
  ],
  [
    'Tidak ada tautan di sini. Hanya teks biasa, dengan titik: dan koma.',
    [],
  ],
  [
    'Nilai 3.5 atau versi 1.2.3 dan file.pdf, HMIF.ITB',
    ['file.pdf', 'HMIF.ITB'],
  ],
  [
    'https://user:pass@example.com/secret dan https://x.com/a/b?c=d&e=f',
    ['https://user:pass@example.com/secret', 'https://x.com/a/b?c=d&e=f'],
  ],
  [
    'Baris satu\nhttps://line.example.com/a\nbaris tiga',
    ['https://line.example.com/a'],
  ],
  [
    'Emoji 🎉 https://emoji.example.id/🎉 selesai',
    ['https://emoji.example.id'],
  ],
  [
    'Akhir kalimat https://end.example.com/path/.',
    ['https://end.example.com/path'],
  ],
  [
    'Domain panjang https://a.b.c.d.example.ac.id/x',
    ['https://a.b.c.d.example.ac.id/x'],
  ],
  ['IP 192.168.1.1 dan http://10.0.0.1:80/a', []],
];

test('ordinary text gives the links it always gave', () => {
  for (const [text, urls] of CASES) {
    assert.deepEqual(extractUrls(text), urls, text);
  }
});

const within = (text: string, ms: number) => {
  const start = performance.now();
  extractUrls(text);
  const took = performance.now() - start;
  assert.ok(took < ms, `${text.length} chars took ${Math.round(took)} ms`);
};

test('text full of colons is read in linear time', () => {
  within('a:'.repeat(2500), 50);
  within('1:'.repeat(2500), 50);
  within(`${'a:'.repeat(2500)}@`, 50);
});

test('long runs of dotted words are read in linear time', () => {
  within('a.'.repeat(20000), 150);
  within(`${'a.'.repeat(20000)}@`, 150);
});
