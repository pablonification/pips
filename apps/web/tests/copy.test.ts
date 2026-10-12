import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fill } from '../src/copy/fill';
import {
  ACRONYMS,
  BANNED_TERMS,
  HOUSE_TERMS,
  PROPER_NOUNS,
} from '../src/copy/glossary';
import { SERVICES } from '../src/lib/services';

/*
 * The glossary check (SPEC story 155). Reads every module in src/copy/ and fails on a banned word, a service name
 * spelled differently from the registry, or capitals the app adds itself.
 */

const COPY_DIR = path.resolve(import.meta.dirname, '../src/copy');
const NOT_CATALOGS = new Set(['glossary.ts', 'fill.ts']);
const SERVICE_NAMES = SERVICES.map((s) => s.label);

type Entry = { where: string; text: string };

function collect(value: unknown, where: string, out: Entry[]) {
  if (typeof value === 'string') out.push({ where, text: value });
  else if (Array.isArray(value))
    value.forEach((v, i) => collect(v, `${where}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value))
      collect(v, `${where}.${k}`, out);
  }
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const letters = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

/** Problems in one string; empty when it follows the glossary. */
export function glossaryProblems(text: string): string[] {
  const problems: string[] = [];
  const plain = text.replace(/\{\w+\}/g, ' '); // placeholders aren't words

  for (const [banned, use] of BANNED_TERMS) {
    const re = new RegExp(
      `(^|[^\\p{L}])${escape(banned).replace(/ /g, '\\s+')}(?=$|[^\\p{L}])`,
      'iu',
    );
    if (re.test(plain)) problems.push(`"${banned}": use ${use}`);
  }

  // A branded name (capitals inside, punctuation or several words) must be spelled exactly as the registry has it.
  const branded = [...SERVICE_NAMES, 'PIPS!'].filter(
    (n) => /[A-Z].*[A-Z]|[!&]|\s/.test(n.slice(1)) || n === 'PIPS!',
  );
  for (const name of branded) {
    const core = letters(name);
    const re = new RegExp(
      core.split('').map(escape).join('[^\\p{L}\\p{N}]{0,2}') + '!?',
      'giu',
    );
    for (const m of plain.matchAll(re)) {
      const found = m[0];
      const exact = name.endsWith('!')
        ? found === name
        : found.replace(/!$/, '') === name;
      // "Curhat" alone is the glossary's word in running text; only the full name must be exact.
      if (!exact) problems.push(`"${found}": spell it "${name}"`);
    }
  }

  // Capitals the app adds itself.
  const allowedWords = new Set(
    [...PROPER_NOUNS, ...HOUSE_TERMS, ...SERVICE_NAMES]
      .flatMap((t) => t.split(/[\s/&·]+/))
      .map((w) => w.replace(/[!?.,:;]+$/, '')),
  );
  const sentences = plain.split(/(?<=[.!?:…])\s+|\s+·\s+|\n+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    words.forEach((raw, i) => {
      // Indonesian clitics (-mu, -ku, -nya) attach to names: "Curhat-mu".
      const word = raw
        .replace(/^[("'“‘]+|[)"'”’.,:;!?…]+$/g, '')
        .replace(/-(mu|ku|nya)$/, '');
      if (!word || !/\p{L}/u.test(word)) return;
      if (
        /^\p{Lu}{2,}$/u.test(word.replace(/[^\p{L}]/gu, '')) &&
        word.replace(/[^\p{L}]/gu, '').length >= 2
      ) {
        if (
          !(ACRONYMS as readonly string[]).includes(
            word.replace(/[^\p{L}]/gu, ''),
          ) &&
          !allowedWords.has(word)
        ) {
          problems.push(
            `"${word}": capitals the app added (not a listed acronym)`,
          );
        }
        return;
      }
      if (i > 0 && /^\p{Lu}/u.test(word) && !allowedWords.has(word)) {
        problems.push(
          `"${word}": a capital mid-sentence that isn't a listed name`,
        );
      }
    });
  }
  return problems;
}

async function catalogs() {
  const files = fs
    .readdirSync(COPY_DIR)
    .filter((f) => f.endsWith('.ts') && !NOT_CATALOGS.has(f));
  const out: Array<{ file: string; entries: Entry[] }> = [];
  for (const file of files) {
    const mod = await import(path.join(COPY_DIR, file));
    out.push({ file, entries: collect(mod, file.replace(/\.ts$/, ''), []) });
  }
  return out;
}

test('every catalog in src/copy/ follows the glossary', async () => {
  const found = await catalogs();
  assert.ok(
    found.some((c) => c.file === 'common.ts'),
    'common.ts exists',
  );
  const problems = found.flatMap(({ entries }) =>
    entries.flatMap(({ where, text }) =>
      glossaryProblems(text).map((p) => `${where}: ${p}`),
    ),
  );
  assert.deepEqual(problems, []);
});

test('catalogs hold plain strings only, so this check can read all of them', async () => {
  for (const { file } of await catalogs()) {
    const mod = await import(path.join(COPY_DIR, file));
    const walk = (v: unknown, where: string): void => {
      if (typeof v === 'function')
        assert.fail(`${where} is a function; use a {placeholder} and fill()`);
      if (v && typeof v === 'object')
        Object.entries(v).forEach(([k, x]) => walk(x, `${where}.${k}`));
    };
    walk(mod, file);
  }
});

test('the check catches what it is for', () => {
  const caught = (text: string) => glossaryProblems(text).length > 0;
  // Banned words.
  assert.ok(caught('Buka Timeline'));
  assert.ok(caught('Log out dari HMIF App'));
  assert.ok(caught('Simpan di HP ini'));
  assert.ok(caught('Apakah Anda yakin?'));
  // Service names spelled differently from the registry.
  assert.ok(caught('Buka DingDong'));
  assert.ok(caught('Buka Dingdong'));
  assert.ok(caught('Buka ding dong'));
  assert.ok(caught('Curhat Yuk sekarang'));
  assert.ok(caught('Cari di Pips'));
  assert.ok(caught('Lowonginaja!'));
  assert.ok(caught('Buka Nim Finder'));
  // Capitals the app adds itself.
  assert.ok(caught('Mata Kuliahku Semester Ini'));
  assert.ok(caught('KIRIM JAWABAN'));
  assert.ok(caught('Simpan Draf'));
});

test('…and lets good copy through', () => {
  for (const text of [
    'Cari di PIPS!',
    'Ding Dong, Testi Matkul dan NIM Finder',
    'Ngobrol anonim dengan tim Welfare HMIF',
    'Curhat Yuk! menyimpan maksimal 3 ruang',
    'Ruang Curhat-mu tersimpan',
    'Kembali ke {judul}',
    'Offline · diperbarui {waktu}',
    'Hapus pengumuman ini? Ini tidak bisa diurungkan.',
    'Form untuk angkatan PIXEL, 13 SKS, 15.00 WIB',
    'Ke Beranda',
    'Live Counting & Rekap Form',
    'Data SPARTA Magang',
  ]) {
    assert.deepEqual(glossaryProblems(text), [], text);
  }
});

test('fill() puts values into placeholders', () => {
  assert.equal(
    fill('Kembali ke {judul}', { judul: 'Beranda' }),
    'Kembali ke Beranda',
  );
  assert.equal(fill('{jumlah} belum dibaca', { jumlah: 3 }), '3 belum dibaca');
  assert.equal(fill('Tanpa isian', {} as Record<never, string>), 'Tanpa isian');
});
