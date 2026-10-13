// P3-A: Kelola's CSV files (src/features/kelola/csv.ts) against today's export code, byte for byte, plus the two
// fixes: times in WIB whatever the device's zone, and `\r` quoted. C1 deleted today's exporters
// (`kelola/live/$formId/-exportResponses.ts`, `kelola/sparta/-exportSubmissions.ts`); the files they wrote for these
// same fixtures are kept in tests/fixtures/kelola-csv/ (name in `.name`, bytes with the BOM in `.csv`).
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildDb } from '../e2e/fixtures/api';
import type {
  AdminFormResponseItem,
  InternshipDivision,
  InternshipSubmission,
} from '../src/api/generated';
import { responsesCsv, submissionsCsv } from '../src/features/kelola/csv';
import { divisionsOf } from '../src/features/kelola/rules';
import { escapeCsvValue, rowsToCsv } from '../src/lib/csv';

const db = buildDb('pengurus');
const form = db.formDetails.pixel;
const NOW = Date.parse('2026-10-08T06:35:12.000Z');

/** The file today's exporter downloaded for these fixtures (name and bytes, BOM included), saved before C1. */
function today(name: string): { filename: string; bytes: string } {
  const at = (ext: string) =>
    readFileSync(
      new URL(`./fixtures/kelola-csv/${name}.${ext}`, import.meta.url),
      'utf8',
    );
  return { filename: at('name'), bytes: at('csv') };
}

/** What the new module's file downloads as: the BOM, then the content (src/lib/csv.ts `downloadCsv`). */
const bytesOf = (content: string) => '﻿' + content;

/** Sample answers in every shape: a checkbox list, text with commas, quotes and line breaks, and a missing one. */
function responses(): AdminFormResponseItem[] {
  const questions = (form.sections ?? []).flatMap((s) => s.questions);
  const base = db.adminResponses.pixel.slice(0, 6);
  return base.map((r, i) => ({
    ...r,
    answers: questions.slice(0, 4 + i).map((q, j) => ({
      questionId: q.id,
      answer:
        j % 3 === 0
          ? ['Satu', 'Dua, tiga']
          : j % 3 === 1
            ? `Kata "kutip" ${i}\nbaris dua`
            : `Biasa ${i}`,
    })),
  }));
}

function withTz<T>(tz: string, fn: () => T): T {
  const before = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    process.env.TZ = before;
  }
}

test('responses CSV: byte for byte today\'s file under WIB (headers, cells, "; ", BOM, name)', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const list = responses();
  const old = today('responses-wib');
  const next = responsesCsv(form.title, form.sections ?? [], list, NOW);
  assert.equal(next.filename, old.filename);
  assert.equal(
    next.filename,
    'form-analisis-kondisi-pixel-responses-2026-10-08-133512.csv',
  );
  assert.equal(bytesOf(next.content), old.bytes);
  assert.ok(old.bytes.startsWith('﻿No,NIM,Nama,Jurusan,Angkatan,'));
  assert.match(next.content, /"Satu; Dua, tiga"/);
  assert.match(next.content, /,08-10-2026 13:31$/m);
});

test("responses CSV: WIB times under another zone (today wrote the device's time)", async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const list = responses();
  const wib = responsesCsv(form.title, form.sections ?? [], list, NOW);
  const elsewhere = withTz('America/Los_Angeles', () =>
    responsesCsv(form.title, form.sections ?? [], list, NOW),
  );
  assert.equal(elsewhere.content, wib.content);
  assert.equal(elsewhere.filename, wib.filename);
  // Regression: today's exporter writes Los Angeles times.
  const old = today('responses-los-angeles');
  assert.notEqual(old.bytes, bytesOf(wib.content));
  assert.match(old.bytes, /,07-10-2026 23:31$/m);
});

function spartaWorld() {
  const divisions = divisionsOf(db.internshipDepartments);
  const byId = new Map<string, InternshipDivision>(
    db.internshipDepartments.flatMap((d) =>
      (d.divisions ?? []).map((div) => [div.id, div] as const),
    ),
  );
  const subs: InternshipSubmission[] = [
    ...db.internshipSubmissions,
    {
      ...db.internshipSubmissions[0],
      id: 'sub-extra',
      fullName: 'Dewi, "Dee"',
      kelas: '',
      idLine: '',
      pengalamanOrganisasi: 'Himpunan\nPanitia',
      kesibukan: [
        { jabatan: 'Staf', organisasi: 'Unit Robotika', periode: '2025/2026' },
        { jabatan: 'Ketua', organisasi: 'Klub Catur', periode: '2026' },
      ],
      choices: [
        {
          id: 'x1',
          submissionId: 'sub-extra',
          divisionId: 'gone',
          priorityOrder: 2,
          answers: [],
        },
      ],
    },
  ];
  return { divisions, byId, subs };
}

test("SPARTA CSV: byte for byte today's file, partial drafts and a missing division included", async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const { divisions, byId, subs } = spartaWorld();
  const old = today('sparta');
  const next = submissionsCsv(subs, divisions, byId, NOW);
  assert.equal(next.filename, old.filename);
  assert.equal(next.filename, 'internship-submissions-2026-10-08-06-35-12.csv');
  assert.equal(bytesOf(next.content), old.bytes);
  const lines = next.content.split('\n');
  assert.equal(
    lines[0],
    'Nama,NIM,Jurusan,Kelas,ID Line,Status,Pengalaman Organisasi,Kesibukan,Divisi Pilihan 1,Jawaban Pilihan 1,Divisi Pilihan 2,Jawaban Pilihan 2,Divisi Pilihan 3,Jawaban Pilihan 3,Divisi Pilihan 4,Jawaban Pilihan 4',
  );
  // Nadia's partial draft: three choices, the fourth empty, "Draft".
  const nadia = lines.find((l) => l.startsWith('Nadia'))!;
  assert.match(nadia, /,Draft,/);
  assert.match(nadia, /,,$/);
  assert.match(
    next.content,
    /Career Development - Career Development,Acara karier apa yang ingin kamu buat\?: Webinar/,
  );
});

test('escapeCsvValue quotes ", comma and line breaks; regression: \\r too', () => {
  assert.equal(escapeCsvValue('biasa'), 'biasa');
  assert.equal(escapeCsvValue('a,b'), '"a,b"');
  assert.equal(escapeCsvValue('kata "kutip"'), '"kata ""kutip"""');
  assert.equal(escapeCsvValue('a\nb'), '"a\nb"');
  // A pasted Windows line break split the row: \r went out unquoted.
  assert.equal(escapeCsvValue('a\r\nb'), '"a\r\nb"');
  assert.equal(escapeCsvValue('a\rb'), '"a\rb"');
  assert.equal(escapeCsvValue(null), '');
  assert.equal(escapeCsvValue(undefined), '');
  assert.equal(escapeCsvValue(7), '7');
  assert.equal(rowsToCsv(['h'], [['x\ry']]), 'h\n"x\ry"');
});
