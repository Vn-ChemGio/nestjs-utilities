import { Workbook } from 'exceljs';
import type { Worksheet, Row, Cell } from 'exceljs';
import { writeFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';

export interface ExcelColumn {
  key: string;
  header?: string;
  width?: number;
  formatter?: (value: unknown, row: Record<string, unknown>) => unknown;
}

export interface ExcelExportOptions {
  sheetName?: string;
  columns?: (string | ExcelColumn)[];
  useAutoFilter?: boolean;
  headerFont?: { name?: string; size?: number; bold?: boolean };
  headerBg?: string;
  borderColor?: string;
  formatters?: Record<
    string,
    (value: unknown, row: Record<string, unknown>) => unknown
  >;
}

const DEFAULTS = {
  sheetName: 'Sheet1',
  useAutoFilter: true,
  headerFont: { name: 'Calibri' as const, size: 11, bold: true },
  headerBg: '4472C4',
  borderColor: 'B0B0B0',
};

function resolveCols(
  data: Record<string, unknown>[],
  columns?: (string | ExcelColumn)[],
): ExcelColumn[] {
  if (!columns || columns.length === 0) {
    if (data.length === 0) return [];
    return Object.keys(data[0]).map((key) => ({
      key,
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
    }));
  }
  return columns.map((c) => {
    if (typeof c === 'string') return { key: c, header: c };
    return { ...c, header: c.header ?? c.key };
  });
}

function pick<T extends Record<string, unknown>>(
  obj: T,
  cols: ExcelColumn[],
): Record<string, unknown> {
  if (cols.length === 0) return obj;
  const result: Record<string, unknown> = {};
  for (const col of cols) {
    if (col.key in obj) result[col.key] = obj[col.key];
  }
  return result;
}

function applyFormatters(
  row: Record<string, unknown>,
  cols: ExcelColumn[],
  globalFormatters?: Record<
    string,
    (value: unknown, row: Record<string, unknown>) => unknown
  >,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const col of cols) {
    const value = row[col.key];
    const fn = col.formatter ?? globalFormatters?.[col.key];
    result[col.key] = fn ? fn(value, row) : value;
  }
  return result;
}

function styleHeader(
  ws: Worksheet,
  colCount: number,
  font: NonNullable<ExcelExportOptions['headerFont']>,
  bg: string,
  borderColor: string,
) {
  const row: Row = ws.getRow(1);
  row.font = font;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  for (let c = 1; c <= colCount; c++) {
    const cell: Cell = row.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    cell.font = { ...font, color: { argb: 'FFFFFFFF' } };
    cell.border = {
      top: { style: 'thin', color: { argb: borderColor } },
      left: { style: 'thin', color: { argb: borderColor } },
      bottom: { style: 'thin', color: { argb: borderColor } },
      right: { style: 'thin', color: { argb: borderColor } },
    };
  }
}

function styleRows(
  ws: Worksheet,
  rowCount: number,
  colCount: number,
  borderColor: string,
) {
  for (let r = 2; r <= rowCount + 1; r++) {
    const row: Row = ws.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      const cell: Cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        top: { style: 'thin', color: { argb: borderColor } },
        left: { style: 'thin', color: { argb: borderColor } },
        bottom: { style: 'thin', color: { argb: borderColor } },
        right: { style: 'thin', color: { argb: borderColor } },
      };
    }
  }
}

export async function exportToBuffer(
  data: Record<string, unknown>[],
  options?: ExcelExportOptions,
): Promise<Buffer> {
  const workbook = new Workbook();
  const ws: Worksheet = workbook.addWorksheet(
    options?.sheetName ?? DEFAULTS.sheetName,
  );

  const cols = resolveCols(data, options?.columns);
  if (cols.length === 0) {
    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  ws.columns = cols.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width ?? 18,
  }));

  const rows = data.map((item) => {
    const picked = pick(item, cols);
    return applyFormatters(picked, cols, options?.formatters);
  });
  ws.addRows(rows);

  const headerFont = options?.headerFont ?? DEFAULTS.headerFont;
  const headerBg = options?.headerBg ?? DEFAULTS.headerBg;
  const borderColor = options?.borderColor ?? DEFAULTS.borderColor;

  styleHeader(ws, cols.length, headerFont, headerBg, borderColor);
  styleRows(ws, rows.length, cols.length, borderColor);

  if (options?.useAutoFilter ?? DEFAULTS.useAutoFilter) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: cols.length },
    };
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportToFile(
  data: Record<string, unknown>[],
  filePath: string,
  options?: ExcelExportOptions,
): Promise<void> {
  const buffer = await exportToBuffer(data, options);
  await writeFile(filePath, buffer);
}

export async function exportToResponse(
  data: Record<string, unknown>[],
  res: ServerResponse,
  filename?: string,
  options?: ExcelExportOptions,
): Promise<void> {
  const buffer = await exportToBuffer(data, options);
  const name = filename ?? 'export.xlsx';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
