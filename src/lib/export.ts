// Data export utilities for CSV, JSON, Excel, and PDF

import { Readable } from 'stream';

// ─── Types ───────────────────────────────────────────────
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeaders?: boolean;
  delimiter?: string;
  dateFormat?: string;
  sheetName?: string;
  columns?: ExportColumn[];
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface ExportColumn {
  key: string;
  header: string;
  width?: number;
  format?: (value: unknown) => string;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
  size: number;
  rowCount: number;
}

// ─── CSV Export ──────────────────────────────────────────
export function exportCSV(data: Record<string, unknown>[], options: ExportOptions = { format: 'csv' }): ExportResult {
  const { includeHeaders = true, delimiter = ',', columns } = options;
  const lines: string[] = [];

  const headers = columns?.map((c) => c.header) || (data.length > 0 ? Object.keys(data[0]) : []);
  const keys = columns?.map((c) => c.key) || headers;

  if (includeHeaders) {
    lines.push(headers.map((h) => escapeCSV(h, delimiter)).join(delimiter));
  }

  for (const row of data) {
    const values = keys.map((key) => {
      const value = row[key];
      const column = columns?.find((c) => c.key === key);
      const formatted = column?.format ? column.format(value) : formatCSVValue(value);
      return escapeCSV(formatted, delimiter);
    });
    lines.push(values.join(delimiter));
  }

  const content = lines.join('\n');
  const buffer = Buffer.from(content, 'utf-8');
  const filename = options.filename || `export-${Date.now()}.csv`;

  return { buffer, filename, contentType: 'text/csv', size: buffer.length, rowCount: data.length };
}

function escapeCSV(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ─── JSON Export ─────────────────────────────────────────
export function exportJSON(data: Record<string, unknown>[], options: ExportOptions = { format: 'json' }): ExportResult {
  const formatted = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(formatted, 'utf-8');
  const filename = options.filename || `export-${Date.now()}.json`;

  return { buffer, filename, contentType: 'application/json', size: buffer.length, rowCount: data.length };
}

// ─── Excel Export (XLSX) ─────────────────────────────────
export function exportExcel(data: Record<string, unknown>[], options: ExportOptions = { format: 'xlsx' }): ExportResult {
  const { sheetName = 'Sheet1', columns } = options;
  const headers = columns?.map((c) => c.header) || (data.length > 0 ? Object.keys(data[0]) : []);
  const keys = columns?.map((c) => c.key) || headers;

  // Simple XML-based XLSX generation (for production, use exceljs or xlsx library)
  const rows: string[] = [];

  // Header row
  rows.push('<row>');
  for (const header of headers) {
    rows.push(`<c t="inlineStr"><is><t>${escapeXML(header)}</t></is></c>`);
  }
  rows.push('</row>');

  // Data rows
  for (const row of data) {
    rows.push('<row>');
    for (const key of keys) {
      const value = row[key];
      const column = columns?.find((c) => c.key === key);
      const formatted = column?.format ? column.format(value) : value;

      if (typeof formatted === 'number') {
        rows.push(`<c><v>${formatted}</v></c>`);
      } else {
        rows.push(`<c t="inlineStr"><is><t>${escapeXML(String(formatted ?? ''))}</t></is></c>`);
      }
    }
    rows.push('</row>');
  }

  const worksheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join('')}</sheetData></worksheet>`;
  const buffer = Buffer.from(worksheet, 'utf-8');
  const filename = options.filename || `export-${Date.now()}.xlsx`;

  return { buffer, filename, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: buffer.length, rowCount: data.length };
}

function escapeXML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── PDF Export ──────────────────────────────────────────
export function exportPDF(data: Record<string, unknown>[], options: ExportOptions = { format: 'pdf' }): ExportResult {
  const { columns } = options;
  const headers = columns?.map((c) => c.header) || (data.length > 0 ? Object.keys(data[0]) : []);
  const keys = columns?.map((c) => c.key) || headers;

  // Simple HTML-to-PDF generation (for production, use puppeteer or pdfkit)
  const tableRows = data.map((row) => {
    const cells = keys.map((key) => `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeXML(String(row[key] ?? ''))}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const headerCells = headers.map((h) => `<th style="padding: 8px; border-bottom: 2px solid #374151; text-align: left; background: #f9fafb;">${escapeXML(h)}</th>`).join('');

  const html = `<!DOCTYPE html><html><head><style>
    body { font-family: -apple-system, sans-serif; padding: 20px; }
    table { width: 100%; border-collapse: collapse; }
  </style></head><body>
    <h1>${escapeXML(options.filename?.replace(/\.\w+$/, '') || 'Export')}</h1>
    <table><thead><tr>${headerCells}</tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`;

  const buffer = Buffer.from(html, 'utf-8');
  const filename = options.filename || `export-${Date.now()}.pdf`;

  return { buffer, filename, contentType: 'text/html', size: buffer.length, rowCount: data.length };
}

// ─── Streaming Export ────────────────────────────────────
export function createExportStream(
  dataGenerator: AsyncGenerator<Record<string, unknown>, void, unknown>,
  options: ExportOptions
): Readable {
  return new Readable({
    async read() {
      try {
        const { value, done } = await dataGenerator.next();
        if (done) {
          this.push(null);
          return;
        }

        const line = JSON.stringify(value) + '\n';
        this.push(line);
      } catch (error) {
        this.destroy(error as Error);
      }
    },
  });
}

// ─── Export Dispatcher ───────────────────────────────────
export function exportData(data: Record<string, unknown>[], options: ExportOptions): ExportResult {
  switch (options.format) {
    case 'csv': return exportCSV(data, options);
    case 'json': return exportJSON(data, options);
    case 'xlsx': return exportExcel(data, options);
    case 'pdf': return exportPDF(data, options);
    default: throw new Error(`Unsupported export format: ${options.format}`);
  }
}
