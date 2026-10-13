/*
 * Kelola's two CSV files (P3-A), the same files today's admin screens make (`-exportResponses.ts`,
 * `-exportSubmissions.ts`): headers, column order, cell values, file names and the UTF-8 BOM, so admins'
 * spreadsheets keep reading them. Two changes: times are WIB whatever the device's zone (today they were the
 * device's), and a `\r` in a cell is quoted (src/lib/csv.ts). Pure: the screens download what these return.
 */
import type {
  AdminFormResponseItem,
  FormSection,
  InternshipDivision,
  InternshipSubmission,
} from '~/api/generated';
import { rowsToCsv } from '~/lib/csv';
import { wib } from '~/lib/dates';
import { PRIORITIES, type DivisionInfo } from './rules';

export interface CsvFile {
  filename: string;
  content: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "08-10-2026 13:31": a response's time in WIB (today's `DD-MM-YYYY HH:mm`). */
export function csvTime(at: string | number | Date): string {
  const w = wib(at);
  return `${pad(w.day)}-${pad(w.month + 1)}-${w.year} ${pad(w.hours)}:${pad(w.minutes)}`;
}

/** "2026-10-08-133500": the responses file's stamp in WIB (today's `YYYY-MM-DD-HHmmss`). */
function fileStamp(now: number | Date): string {
  const w = wib(now);
  const s = new Date(now).getUTCSeconds();
  return `${w.year}-${pad(w.month + 1)}-${pad(w.day)}-${pad(w.hours)}${pad(w.minutes)}${pad(s)}`;
}

/** `{title}-responses-{timestamp}.csv`: one row per response, its answers by question, the time in WIB. */
export function responsesCsv(
  formTitle: string,
  sections: readonly FormSection[],
  responses: readonly AdminFormResponseItem[],
  now: number | Date = Date.now(),
): CsvFile {
  const questions = sections.flatMap((s) => s.questions);
  const headers = [
    'No',
    'NIM',
    'Nama',
    'Jurusan',
    'Angkatan',
    ...questions.map((q) => q.label),
    'Waktu Submit',
  ];
  const rows = responses.map((r, idx) => [
    idx + 1,
    r.nim,
    r.fullName,
    r.major,
    r.angkatan,
    ...questions.map((q) => {
      const answer = r.answers.find((a) => a.questionId === q.id)?.answer;
      if (answer === undefined) return '';
      return Array.isArray(answer) ? answer.join('; ') : answer;
    }),
    csvTime(r.submittedAt),
  ]);
  const safeTitle = formTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    filename: `${safeTitle}-responses-${fileStamp(now)}.csv`,
    content: rowsToCsv(headers, rows),
  };
}

/** `internship-submissions-{timestamp}.csv`: one row per submission, each priority's division and answers. */
export function submissionsCsv(
  submissions: readonly InternshipSubmission[],
  divisions: readonly DivisionInfo[],
  divisionsById: ReadonlyMap<string, InternshipDivision>,
  now: number | Date = Date.now(),
): CsvFile {
  const infoById = new Map(divisions.map((d) => [d.id, d]));
  const headers = [
    'Nama',
    'NIM',
    'Jurusan',
    'Kelas',
    'ID Line',
    'Status',
    'Pengalaman Organisasi',
    'Kesibukan',
    ...PRIORITIES.flatMap((p) => [
      `Divisi Pilihan ${p}`,
      `Jawaban Pilihan ${p}`,
    ]),
  ];
  const rows = submissions.map((sub) => [
    sub.fullName,
    sub.nim,
    sub.jurusan,
    sub.kelas,
    sub.idLine,
    sub.isLocked ? 'Terkunci' : 'Draft',
    sub.pengalamanOrganisasi ?? '',
    (sub.kesibukan ?? [])
      .map((k) => `${k.jabatan} - ${k.organisasi} (${k.periode})`)
      .join('; '),
    ...PRIORITIES.flatMap((p) => {
      const choice = sub.choices?.find((c) => c.priorityOrder === p);
      if (!choice) return ['', ''];
      const info = infoById.get(choice.divisionId);
      const division = divisionsById.get(choice.divisionId);
      const label = info ? `${info.departmentName} - ${info.name}` : '-';
      const answers = division
        ? (division.questions ?? [])
            .map((q) => {
              const a = choice.answers.find((x) => x.questionId === q.id);
              return `${q.label}: ${a?.answer || '-'}`;
            })
            .join(' | ')
        : '';
      return [label, answers];
    }),
  ]);
  // Today's stamp: the ISO time (UTC) with ":" and "T" as "-".
  const stamp = new Date(now).toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return {
    filename: `internship-submissions-${stamp}.csv`,
    content: rowsToCsv(headers, rows),
  };
}
