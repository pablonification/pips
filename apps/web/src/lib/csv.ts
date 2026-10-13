/**
 * One cell: quoted when it holds a quote, a comma or a line break. P3-A: `\r` too, so a pasted Windows line break
 * (`\r\n`, or a lone `\r`) no longer splits the row in a spreadsheet.
 */
export function escapeCsvValue(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvValue).join(','),
  );
  return lines.join('\n');
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
