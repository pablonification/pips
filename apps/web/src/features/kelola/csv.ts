/*
 * Kelola's CSV file: headers, column order, cell values, file name and the UTF-8 BOM are fixed, so admins'
 * spreadsheets keep reading it. Times are WIB whatever the device's zone, and a `\r` in a cell is quoted
 * (src/lib/csv.ts). Pure: the screens download what these return.
 */
import type { AdminFormResponseItem, FormSection } from '~/api/generated';
import { rowsToCsv } from '~/lib/csv';
import { wib } from '~/lib/dates';

export interface CsvFile {
  filename: string;
  content: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "08-10-2026 13:31": a response's time in WIB (`DD-MM-YYYY HH:mm`). */
function csvTime(at: string | number | Date): string {
  const w = wib(at);
  return `${pad(w.day)}-${pad(w.month + 1)}-${w.year} ${pad(w.hours)}:${pad(w.minutes)}`;
}

/** The responses file's stamp in WIB: `YYYY-MM-DD-HHmmss`. */
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
