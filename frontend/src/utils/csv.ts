// RFC 4180 CSV writer.
//  - fields containing a comma, quote, CR or LF are quoted, and embedded quotes are doubled;
//  - rows end with CRLF;
//  - text that a spreadsheet would run as a formula (starts with = + - @ or a tab/CR) is prefixed with an
//    apostrophe, so an imported bank-statement line cannot become a formula when the export is opened in Excel.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'number' ? String(value) : String(value);
  // Numbers (including negatives) are data, not formulas; only guard text.
  if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** Downloads text as a UTF-8 CSV file (with a BOM so Excel reads rupee signs and accents correctly). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
