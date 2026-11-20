import ExcelJS from 'exceljs'

export type SheetFormat = 'csv' | 'xlsx'

/** XLSX files are ZIP archives. */
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const BOM = '﻿'

/** Real format from the content, never from the file name (docs/backend/05 §3). */
export function detectSheetFormat(content: Buffer): SheetFormat | null {
  if (content.subarray(0, ZIP.length).equals(ZIP)) return 'xlsx'
  const text = content.toString('utf8')
  // A CSV is text: no NUL byte and valid UTF-8 (no replacement character).
  if (text.includes('\u0000') || text.includes('�')) return null
  return 'csv'
}

/** RFC 4180 CSV, `;` or `,` separated (chosen from the header line), quotes escaped by doubling. */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(BOM) ? text.slice(1) : text
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const separator =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === separator) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

/** Text of a cell whatever its type: dates as ISO days, formulas by their result. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
    if ('richText' in value) return value.richText.map((part) => part.text).join('')
    if ('text' in value) return String(value.text)
    if ('error' in value) return ''
  }
  return String(value)
}

export type SheetResult =
  | { ok: true; format: SheetFormat; rows: string[][] }
  | { ok: false; reason: 'format' | 'tooManyRows' }

/**
 * Text rows of a CSV or of the first worksheet of an XLSX file (header row
 * included). More than `maxRows` data rows is refused before reading the cells.
 */
export async function readSheet(content: Buffer, maxRows: number): Promise<SheetResult> {
  const format = detectSheetFormat(content)
  if (!format) return { ok: false, reason: 'format' }
  if (format === 'csv') {
    const rows = parseCsv(content.toString('utf8')).map((row) => row.map((cell) => cell.trim()))
    return rows.length > maxRows + 1
      ? { ok: false, reason: 'tooManyRows' }
      : { ok: true, format, rows }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(content as unknown as ExcelJS.Buffer)
  } catch {
    return { ok: false, reason: 'format' }
  }
  const sheet = workbook.worksheets[0]
  if (!sheet) return { ok: true, format, rows: [] }
  if (sheet.actualRowCount > maxRows + 1) return { ok: false, reason: 'tooManyRows' }
  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = []
    for (let column = 1; column <= sheet.actualColumnCount; column += 1) {
      cells.push(cellText(row.getCell(column).value).trim())
    }
    if (cells.some((value) => value !== '')) rows.push(cells)
  })
  return { ok: true, format, rows }
}

/** A cell starting with = + - @ would run as a formula in a spreadsheet (CSV injection). */
export const neutralize = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)

/** UTF-8 byte order mark written at the start of every CSV export. */
export const CSV_BOM = BOM

/** One CSV line without its line break: `;` separators, quoting, formulas neutralized. */
export function csvLine(row: string[]): string {
  const escape = (value: string) => {
    const safe = neutralize(value)
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  return row.map(escape).join(';')
}

export function writeCsv(rows: string[][]): Buffer {
  const text = rows.map(csvLine).join('\r\n')
  return Buffer.from(`${BOM}${text}\r\n`, 'utf8')
}

export async function writeXlsx(rows: string[][], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  for (const row of rows) sheet.addRow(row.map(neutralize))
  sheet.getRow(1).font = { bold: true }
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
