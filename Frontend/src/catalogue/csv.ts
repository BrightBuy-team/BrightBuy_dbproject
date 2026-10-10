// Report export (UI-12). Plain functions so they can be tested without a browser.

/** One CSV cell: quoted when needed, and never left as a spreadsheet formula. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let text = String(value)
  // A spreadsheet runs text that starts with one of these as a formula.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function downloadCsv(fileName: string, csv: string): void {
  // The byte-order mark makes Excel read the file as UTF-8.
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}
