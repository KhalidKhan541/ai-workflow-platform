// Data import utilities for CSV, JSON, and Excel parsing

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export type ImportFormat = 'csv' | 'json' | 'xlsx';

export interface ImportOptions {
  format: ImportFormat;
  hasHeaders?: boolean;
  delimiter?: string;
  skipEmptyLines?: boolean;
  trimValues?: boolean;
  maxRows?: number;
  columnMapping?: Record<string, string>;
  requiredColumns?: string[];
  validators?: Record<string, (value: unknown) => boolean>;
}

export interface ImportResult<T = Record<string, unknown>> {
  success: boolean;
  data: T[];
  errors: ImportError[];
  stats: ImportStats;
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

export interface ImportStats {
  totalRows: number;
  validRows: number;
  errorRows: number;
  skippedRows: number;
  duration: number;
}

export interface ParsedRow {
  [key: string]: string;
}

// ─── CSV Parsing ─────────────────────────────────────────
export function parseCSV(content: string, options: ImportOptions = { format: 'csv' }): ParsedRow[] {
  const { hasHeaders = true, delimiter = ',', skipEmptyLines = true, trimValues = true, maxRows } = options;
  const lines = content.split(/\r?\n/);

  const headers = hasHeaders ? lines[0].split(delimiter).map((h) => trimValues ? h.trim() : h) : [];
  const dataLines = hasHeaders ? lines.slice(1) : lines;
  const rows: ParsedRow[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    if (maxRows && rows.length >= maxRows) break;

    const line = dataLines[i];
    if (skipEmptyLines && !line.trim()) continue;

    const values = parseCSVLine(line, delimiter);
    const row: ParsedRow = {};

    if (hasHeaders) {
      headers.forEach((header, idx) => {
        row[header] = trimValues ? (values[idx] || '').trim() : values[idx] || '';
      });
    } else {
      values.forEach((value, idx) => {
        row[`col_${idx}`] = trimValues ? value.trim() : value;
      });
    }

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}

// ─── JSON Import ─────────────────────────────────────────
export function parseJSON(content: string, options: ImportOptions = { format: 'json' }): ParsedRow[] {
  try {
    const parsed = JSON.parse(content);
    const data = Array.isArray(parsed) ? parsed : [parsed];
    return data.map((item) => flattenObject(item));
  } catch {
    throw new Error('Invalid JSON content');
  }
}

function flattenObject(obj: Record<string, unknown>, prefix = ''): ParsedRow {
  const result: ParsedRow = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      result[fullKey] = JSON.stringify(value);
    } else {
      result[fullKey] = String(value ?? '');
    }
  }

  return result;
}

// ─── Excel Import (Stub) ────────────────────────────────
export function parseExcel(buffer: Buffer, options: ImportOptions = { format: 'xlsx' }): ParsedRow[] {
  // In production, use xlsx or exceljs library
  // For now, return empty array
  return [];
}

// ─── Data Validation ─────────────────────────────────────
export function validateImportData(
  rows: ParsedRow[],
  options: ImportOptions
): { valid: ParsedRow[]; errors: ImportError[] } {
  const { requiredColumns, validators } = options;
  const valid: ParsedRow[] = [];
  const errors: ImportError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let hasError = false;

    // Check required columns
    if (requiredColumns) {
      for (const col of requiredColumns) {
        if (!row[col] || row[col].trim() === '') {
          errors.push({ row: i + 1, column: col, message: `Required column '${col}' is missing or empty`, value: row[col] });
          hasError = true;
        }
      }
    }

    // Run validators
    if (validators) {
      for (const [col, validator] of Object.entries(validators)) {
        if (row[col] !== undefined && !validator(row[col])) {
          errors.push({ row: i + 1, column: col, message: `Validation failed for column '${col}'`, value: row[col] });
          hasError = true;
        }
      }
    }

    if (!hasError) {
      valid.push(row);
    }
  }

  return { valid, errors };
}

// ─── Batch Processing ────────────────────────────────────
export async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[], batchIndex: number) => Promise<{ success: number; errors: number }>
): Promise<{ totalSuccess: number; totalErrors: number; batches: number }> {
  let totalSuccess = 0;
  let totalErrors = 0;
  const batches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);
    const result = await processor(batch, batchIndex);
    totalSuccess += result.success;
    totalErrors += result.errors;
  }

  return { totalSuccess, totalErrors, batches };
}

// ─── Import Dispatcher ───────────────────────────────────
export function importData(content: string | Buffer, options: ImportOptions): ParsedRow[] {
  switch (options.format) {
    case 'csv':
      return parseCSV(typeof content === 'string' ? content : content.toString(), options);
    case 'json':
      return parseJSON(typeof content === 'string' ? content : content.toString(), options);
    case 'xlsx':
      return parseExcel(content as Buffer, options);
    default:
      throw new Error(`Unsupported import format: ${options.format}`);
  }
}

// ─── Full Import Pipeline ────────────────────────────────
export function fullImport<T = Record<string, unknown>>(
  content: string | Buffer,
  options: ImportOptions,
  transformer?: (row: ParsedRow) => T
): ImportResult<T> {
  const startTime = Date.now();
  const rows = importData(content, options);
  const { valid, errors } = validateImportData(rows, options);

  const data = transformer
    ? valid.map((row) => transformer(row))
    : valid as unknown as T[];

  return {
    success: errors.length === 0,
    data,
    errors,
    stats: {
      totalRows: rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      skippedRows: 0,
      duration: Date.now() - startTime,
    },
  };
}
