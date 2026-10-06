export type Cell = string | number | null | undefined;

// Spreadsheets run text that starts with these as a formula, which can be abused
// ("=HYPERLINK(...)"). A leading apostrophe keeps it as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "number") return String(cell);
  const text = FORMULA_START.test(cell) ? `'${cell}` : cell;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// A CSV that opens correctly in Excel, including Urdu names (the BOM tells it the file is UTF-8).
export function toCsv(headers: string[], rows: Cell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
