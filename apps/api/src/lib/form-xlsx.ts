import writeXlsxFile, { type Row } from 'write-excel-file/node';
import type { ExportCell } from './form-summary';

/**
 * The export table as an Excel workbook: one sheet, the header in bold and kept in view, times as real dates in WIB
 * (Excel has no time zones, so the clock is shifted to WIB before writing). Every text is written as text, never as a
 * formula, whatever a member typed.
 */
export async function toXlsx(
  table: { header: string[]; rows: ExportCell[][] },
  sheet = 'Jawaban',
): Promise<Buffer> {
  const wib = (d: Date) => new Date(d.getTime() + 7 * 3600_000);
  const data: Row[] = [
    table.header.map((value) => ({ value, type: String, fontWeight: 'bold' })),
    ...table.rows.map((row) =>
      row.map((v) =>
        v === null
          ? null
          : v instanceof Date
            ? { value: wib(v), type: Date, format: 'yyyy-mm-dd hh:mm' }
            : typeof v === 'number'
              ? { value: v, type: Number }
              : { value: v, type: String },
      ),
    ),
  ];
  return await writeXlsxFile(data, {
    sheet,
    stickyRowsCount: 1,
    columns: table.header.map((h, i) => ({
      width: i < 2 ? 18 : Math.min(Math.max(h.length, 12), 48),
    })),
  }).toBuffer();
}
