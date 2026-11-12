// Fails when a tracked file holds a real person's details: an email address, a student number, a home folder path,
// or a table that looks like a member list. The repository is public, so the messages show at most the first six
// characters of what matched.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lists = JSON.parse(
  readFileSync(join(root, 'scripts/sample-nims.json'), 'utf8'),
);
const sampleNims = new Set(lists.sampleNims.nims);
const behaviourHashes = new Set(lists.behaviourNims.sha256);
const behaviourFiles = new Set(lists.behaviourNims.files);
const sampleTables = new Set(lists.sampleTables.files);

// Skipped entirely: a lockfile holds hashes, and AGENTS.md is rewritten by its own task.
const SKIPPED_FILES = new Set(['pnpm-lock.yaml']);
const HOME_PATH_FILES = new Set(['AGENTS.md']);

// An ITB student number: three digits of faculty and programme, two of the entry year, three of sequence. The
// year keeps ordinary numbers (13500000, a timestamp) from matching.
const NIM = /(?<![0-9])1[0-9]{2}(?:1[5-9]|2[0-9])[0-9]{3}(?![0-9])/g;
const EMAIL =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// The user part of an address (`https://user@host/`, `postgres://user:pass@host/`) is not an email address.
const URL_USER = /\/\/[^\s/@]*@/g;
const IMAGE_SUFFIX = /^(png|jpe?g|gif|webp|avif|svg|ico)$/i;
const EXAMPLE_DOMAIN =
  /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;
const STUDENT_DOMAIN = /^[0-9]{8}@std\.stei\.itb\.ac\.id$/i;
const MADE_UP_LOCAL = /^(example|nim|placeholder|noreply|no-reply)$/i;
const HOME_PATH =
  /\/Users\/[A-Za-z0-9._-]+\/|\/home\/pabs\b|\/home\/(?!web\/|app\/|node\/|api\/)[A-Za-z][A-Za-z0-9_-]*\/(?:coding|Documents|Downloads|Desktop|\.[A-Za-z])/;

// No programme takes 900 students in a year, so a sequence from 900 up is never a real member's number. New sample
// numbers come from this range.
const isMadeUpNim = (nim) => Number(nim.slice(5)) >= 900;

const mask = (value) => `${value.slice(0, 6)}…`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/** The problems in one file's text: `[{ line, kind, shown }]`. */
export function problemsIn(file, text, hashes = behaviourHashes) {
  const found = [];
  const lines = text.split('\n');
  lines.forEach((raw, index) => {
    const line = raw.replace(URL_USER, '//');
    const at = index + 1;

    for (const nim of line.match(NIM) ?? []) {
      if (isMadeUpNim(nim) || sampleNims.has(nim)) continue;
      if (behaviourFiles.has(file) && hashes.has(sha256(nim))) continue;
      found.push({ line: at, kind: 'student number', shown: mask(nim) });
    }

    for (const email of line.match(EMAIL) ?? []) {
      const [local, domain] = email.split('@');
      if (IMAGE_SUFFIX.test(domain.split('.').pop())) continue;
      if (MADE_UP_LOCAL.test(local) || EXAMPLE_DOMAIN.test(domain)) continue;
      if (
        /^github\.com$|^users\.noreply\.github\.com$/i.test(domain) &&
        /noreply/i.test(email)
      )
        continue;
      if (email.toLowerCase() === 'noreply@anthropic.com') continue;
      if (
        STUDENT_DOMAIN.test(email) &&
        (isMadeUpNim(local) || sampleNims.has(local))
      )
        continue;
      found.push({ line: at, kind: 'email address', shown: mask(email) });
    }

    if (!HOME_PATH_FILES.has(file)) {
      const path = HOME_PATH.exec(line);
      if (path)
        found.push({
          line: at,
          kind: 'home folder path',
          shown: mask(path[0]),
        });
    }
  });
  return found;
}

/** A table with a name column beside a student-number or email column, that isn't a known sample table. */
export function tableProblem(file, text) {
  if (sampleTables.has(file)) return null;
  if (/\.(xlsx|xls|ods)$/i.test(file))
    return 'spreadsheet that cannot be checked';
  if (!/\.(csv|tsv)$/i.test(file)) return null;
  const header = text.replace(/^﻿/, '').split('\n', 1)[0].toLowerCase();
  const columns = header
    .split(/[,;\t]/)
    .map((c) => c.replace(/^["'\s]+|["'\s\r]+$/g, ''));
  const hasName = columns.some((c) =>
    /^(nama|nama lengkap|name|full ?name|full_name)$/.test(c),
  );
  const hasId = columns.some((c) => /^(nim|e-?mail|email)$/.test(c));
  return hasName && hasId
    ? 'table with names beside student numbers or emails'
    : null;
}

const trackedFiles = () =>
  execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\0')
    .filter(Boolean);

test('no tracked file holds a real person’s details', () => {
  const failures = [];
  for (const file of trackedFiles()) {
    if (SKIPPED_FILES.has(file)) continue;
    let buffer;
    try {
      buffer = readFileSync(join(root, file));
    } catch {
      continue; // deleted in the working tree
    }
    if (/\.(xlsx|xls|ods)$/i.test(file)) {
      const problem = tableProblem(file, '');
      if (problem) failures.push(`${file}: ${problem}`);
      continue;
    }
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    const problem = tableProblem(file, text);
    if (problem) failures.push(`${file}:1: ${problem}`);
    for (const p of problemsIn(file, text))
      failures.push(`${file}:${p.line}: ${p.kind} (${p.shown})`);
  }
  assert.deepEqual(
    failures,
    [],
    `Real people's details must not be committed. Use made-up values (scripts/sample-nims.json lists the sample numbers):\n${failures.join('\n')}`,
  );
});

// The rules themselves, on made-up strings built from pieces so this file holds none of them.
const madeUpNim = (prefix, rest) => prefix + rest;
const at = '@';

test('a student number that is not on the sample list is refused', () => {
  const unknown = madeUpNim('135', '29777');
  assert.ok(!sampleNims.has(unknown));
  const found = problemsIn('apps/x.ts', `const nim = '${unknown}';`);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'student number');
  assert.equal(found[0].line, 1);
});

test('a student number of another programme, or glued to letters, is refused', () => {
  for (const line of [
    `const nim = '${madeUpNim('165', '29899')}';`,
    `const nim = '${madeUpNim('196', '29899')}';`,
    `id=nim${madeUpNim('135', '29899')}x`,
  ])
    assert.equal(problemsIn('apps/x.ts', line).length, 1, line.slice(0, 12));
});

test('a sample number from the made-up range passes without being listed', () => {
  const madeUp = madeUpNim('135', '25951');
  assert.ok(!sampleNims.has(madeUp));
  assert.deepEqual(problemsIn('apps/x.ts', `const nim = '${madeUp}';`), []);
  assert.deepEqual(
    problemsIn(
      'apps/x.ts',
      `const email = '${madeUp}${at}std.stei.itb.ac.id';`,
    ),
    [],
  );
});

test('the user part of an address is not an email address', () => {
  assert.deepEqual(
    problemsIn(
      'apps/x.ts',
      `const a = 'https://user${at}fcm.googleapis.com/x';`,
    ),
    [],
  );
});

test('a number on the sample list passes', () => {
  const [known] = lists.sampleNims.nims;
  assert.deepEqual(problemsIn('apps/x.ts', `const nim = '${known}';`), []);
});

test('numbers that are not student numbers pass', () => {
  assert.deepEqual(
    problemsIn(
      'apps/x.ts',
      'const day = 20261008; const id = "0f3c9a12-1234";',
    ),
    [],
  );
  assert.deepEqual(
    problemsIn('apps/x.ts', 'const a = 1234567890; const b = 2135999999;'),
    [],
  );
  assert.deepEqual(
    problemsIn('apps/x.ts', 'const limit = 13500000; const ms = 18000000;'),
    [],
  );
});

test('the failure message shows at most six characters of the value', () => {
  const unknown = madeUpNim('182', '29899');
  const [found] = problemsIn('apps/x.ts', unknown);
  assert.equal(found.shown, `${unknown.slice(0, 6)}…`);
  assert.ok(!found.shown.includes(unknown));
});

test('the SPARTA and early-access numbers are allowed only in their own files', () => {
  assert.equal(behaviourHashes.size, 5);
  const stand = madeUpNim('135', '29765');
  const hashes = new Set([sha256(stand)]);
  const [listed] = behaviourFiles;
  assert.deepEqual(problemsIn(listed, stand, hashes), []);
  assert.equal(problemsIn('apps/web/src/other.ts', stand, hashes).length, 1);
  assert.equal(problemsIn(listed, madeUpNim('135', '29764'), hashes).length, 1);
});

test('an email address that is not clearly made up is refused', () => {
  const real = `someone${at}campus-mail.invalid-ish.org`;
  const found = problemsIn('docs/x.md', `Write to ${real} today`);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, 'email address');
  assert.equal(found[0].shown, `${real.slice(0, 6)}…`);
});

test('a student address with an unknown number is refused, a sample one passes', () => {
  const unknown = madeUpNim('135', '29898');
  assert.equal(
    problemsIn('x.md', `${unknown}${at}std.stei.itb.ac.id`).length,
    2,
  );
  const [known] = lists.sampleNims.nims;
  assert.deepEqual(problemsIn('x.md', `${known}${at}std.stei.itb.ac.id`), []);
});

test('placeholders, example domains and file names pass', () => {
  for (const text of [
    `NIM${at}std.stei.itb.ac.id`,
    `example${at}std.stei.itb.ac.id`,
    `dev${at}example.test`,
    `a${at}b.example.com`,
    `someone${at}host.example`,
    `noreply${at}anthropic.com`,
    `12345+name${at}users.noreply.github.com`,
    `logo${at}2x.png`,
    `https://user:secret${at}files.example.org/a.pdf`,
    `react${at}18.3.1 and pnpm${at}9.15.0`,
  ]) {
    assert.deepEqual(problemsIn('x.md', text), [], text);
  }
});

test('a home folder path is refused, except in AGENTS.md', () => {
  const mac = `/Users/${'someone'}/project/file.ts`;
  const server = `/home/${'someone'}/coding/app`;
  assert.equal(problemsIn('x.ts', mac)[0].kind, 'home folder path');
  assert.equal(problemsIn('x.ts', server)[0].kind, 'home folder path');
  assert.deepEqual(problemsIn('AGENTS.md', mac), []);
  for (const route of [
    '/home/curhat',
    '/home/testimoni/teknik-informatika/3',
    'adduser -h /home/web /home/web/.config',
  ]) {
    assert.deepEqual(problemsIn('x.ts', route), [], route);
  }
});

test('a table with names beside student numbers or emails is refused unless it is a sample table', () => {
  const header = 'Angkatan,NIM,Nama Lengkap,Email\n';
  assert.match(
    tableProblem('apps/api/src/db/seed/people.csv', header),
    /names beside/,
  );
  assert.match(
    tableProblem('x/members.csv', '﻿Nama;NIM;Kelas\n'),
    /names beside/,
  );
  assert.match(tableProblem('x/members.tsv', 'name\temail\n'), /names beside/);
  assert.equal(tableProblem('x/courses.csv', 'code,name,sks\n'), null);
  assert.equal(tableProblem('x/notes.md', header), null);
  assert.equal(tableProblem([...sampleTables][0], header), null);
});

test('a spreadsheet that is not a sample table is refused, because it cannot be read', () => {
  assert.match(
    tableProblem('apps/api/src/db/seed/roles.xlsx', ''),
    /cannot be checked/,
  );
});
