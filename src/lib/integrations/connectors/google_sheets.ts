import { BaseIntegration, AuthType, AuthType as AT, TokenData } from '../base';
import { IntegrationCategory, IntegrationMetadata } from '../registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GoogleSheetsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  refreshToken?: string;
  accessToken?: string;
  scopes?: string[];
}

export interface SheetProperties {
  sheetId: number;
  title: string;
  index: number;
  sheetType: string;
  gridProperties?: { rowCount: number; columnCount: number };
  hidden?: boolean;
  tabColorStyle?: { redColor?: number; greenColor?: number; blueColor?: number };
}

export interface SpreadsheetProperties {
  title: string;
  locale?: string;
  autoRecalc?: string;
  timeZone?: string;
}

export interface Spreadsheet {
  spreadsheetId: string;
  properties: SpreadsheetProperties;
  sheets: { properties: SheetProperties }[];
  spreadsheetUrl: string;
}

export interface CellData {
  userEnteredValue: { stringValue?: string; numberValue?: number; formulaValue?: string; boolValue?: boolean };
  userEnteredFormat?: Record<string, unknown>;
  effectiveValue?: { stringValue?: string; numberValue?: number; formulaValue?: string; boolValue?: boolean };
  formattedValue?: string;
}

export interface RowData {
  values: CellData[];
}

export interface GridData {
  startRow: number;
  startColumn: number;
  rowData: RowData[];
}

export interface SheetData {
  range: string;
  majorDimension: string;
  values: (string | number | boolean)[][];
}

export interface BatchGetResponse {
  spreadsheetId: string;
  valueRanges: SheetData[];
}

export interface BatchUpdateResponse {
  spreadsheetId: string;
  updatedCells: number;
  updatedRows: number;
  updatedColumns: number;
  updatedRange: string;
}

export interface ClearResponse {
  spreadsheetId: string;
  clearedRange: string;
}

// ---------------------------------------------------------------------------
// Google Sheets Integration
// ---------------------------------------------------------------------------

export class GoogleSheetsIntegration extends BaseIntegration {
  private config: GoogleSheetsConfig;
  private accessToken: string;

  constructor(config: GoogleSheetsConfig) {
    super('https://sheets.googleapis.com/v4/spreadsheets', config);
    this.config = config;
    this.accessToken = config.accessToken || '';
    this.rateLimitConfig = { maxRequests: 60, windowMs: 100000 };
  }

  protected determineAuthType(): AuthType {
    return this.config.accessToken ? AT.Bearer : AT.OAuth2;
  }

  protected async getAuthHeaders(): Promise<Record<string, string>> {
    const token = this.tokenData?.accessToken || this.accessToken;
    return { Authorization: `Bearer ${token}` };
  }

  getCapabilities(): string[] {
    return [
      'sheets.read',
      'sheets.write',
      'sheets.update',
      'sheets.create',
      'sheets.delete',
      'cells.read',
      'cells.write',
      'cells.batch_read',
      'cells.batch_write',
      'cells.clear',
      'cells.format',
      'formulas.support',
      'rows.insert',
      'rows.delete',
      'columns.insert',
      'columns.delete',
    ];
  }

  // -- OAuth ---------------------------------------------------------------

  getAuthUrl(state?: string): string {
    const scopes = this.config.scopes || [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ];
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state || '',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<TokenData> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri || 'http://localhost:3000/callback',
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!response.ok) throw new Error(`Sheets token exchange failed: ${response.status}`);
    const data = await response.json() as Record<string, unknown>;
    this.tokenData = this.parseTokenResponse(data);
    this.accessToken = this.tokenData.accessToken;
    if (data.refresh_token) this.tokenData.refreshToken = data.refresh_token as string;
    return this.tokenData;
  }

  // -- Spreadsheet CRUD ----------------------------------------------------

  async createSpreadsheet(title: string, sheetNames?: string[]): Promise<Spreadsheet> {
    const sheets = (sheetNames || ['Sheet1']).map((name, i) => ({
      properties: { title: name, index: i },
    }));
    return this.post('', { properties: { title }, sheets });
  }

  async getSpreadsheet(spreadsheetId: string, ranges?: string[]): Promise<Spreadsheet> {
    const params: Record<string, string> = {};
    if (ranges?.length) params.ranges = ranges.join('&');
    return this.get(`/${spreadsheetId}`, params);
  }

  async batchGet(spreadsheetId: string, ranges: string[], valueRenderOption?: string): Promise<BatchGetResponse> {
    const params: Record<string, string> = { ranges: ranges.join('&') };
    if (valueRenderOption) params.valueRenderOption = valueRenderOption;
    return this.get(`/${spreadsheetId}/values:batchGet`, params);
  }

  // -- Read Operations -----------------------------------------------------

  async getValues(spreadsheetId: string, range: string, valueRenderOption: string = 'FORMATTED_VALUE'): Promise<SheetData> {
    return this.get(`/${spreadsheetId}/values/${encodeURIComponent(range)}`, { valueRenderOption });
  }

  async getCell(spreadsheetId: string, range: string): Promise<(string | number | boolean)[][]> {
    const data = await this.getValues(spreadsheetId, range);
    return data.values || [];
  }

  async getColumn(spreadsheetId: string, sheetId: number, column: number, startRow?: number, endRow?: number): Promise<(string | number | boolean)[]> {
    const colLetter = this.columnToLetter(column);
    const start = startRow || 1;
    const end = endRow || 1000;
    const range = `'Sheet${sheetId}'!${colLetter}${start}:${colLetter}${end}`;
    const data = await this.getValues(spreadsheetId, range);
    return (data.values || []).map(row => row[0]);
  }

  async getRow(spreadsheetId: string, sheetId: number, row: number): Promise<(string | number | boolean)[]> {
    const range = `'Sheet${sheetId}'!A${row}:ZZ${row}`;
    const data = await this.getValues(spreadsheetId, range);
    return data.values?.[0] || [];
  }

  async getLastRow(spreadsheetId: string, sheetId: number): Promise<number> {
    try {
      const data = await this.getValues(spreadsheetId, `'Sheet${sheetId}'!A:A`);
      return data.values?.length || 0;
    } catch {
      return 0;
    }
  }

  async findValues(spreadsheetId: string, range: string, searchText: string, options?: { matchCase?: boolean; useRegex?: boolean }): Promise<{ row: number; value: (string | number | boolean)[] }[]> {
    const data = await this.getValues(spreadsheetId, range);
    const results: { row: number; value: (string | number | boolean)[] }[] = [];
    const values = data.values || [];
    for (let i = 0; i < values.length; i++) {
      for (const cell of values[i]) {
        const cellStr = String(cell);
        let matches = false;
        if (options?.useRegex) {
          matches = new RegExp(searchText, options.matchCase ? '' : 'i').test(cellStr);
        } else if (options?.matchCase) {
          matches = cellStr.includes(searchText);
        } else {
          matches = cellStr.toLowerCase().includes(searchText.toLowerCase());
        }
        if (matches) {
          results.push({ row: i + 1, value: values[i] });
          break;
        }
      }
    }
    return results;
  }

  // -- Write Operations ----------------------------------------------------

  async updateValues(spreadsheetId: string, range: string, values: (string | number | boolean)[][]): Promise<BatchUpdateResponse> {
    return this.put(`/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
      values,
      majorDimension: 'ROWS',
    });
  }

  async setCell(spreadsheetId: string, range: string, value: string | number | boolean): Promise<BatchUpdateResponse> {
    return this.updateValues(spreadsheetId, range, [[value]]);
  }

  async appendRows(spreadsheetId: string, range: string, values: (string | number | boolean)[][]): Promise<BatchUpdateResponse> {
    return this.post(`/${spreadsheetId}/values/${encodeURIComponent(range)}:append`, {
      values,
      majorDimension: 'ROWS',
      valueInputOption: 'USER_ENTERED',
    });
  }

  async clear(spreadsheetId: string, range: string): Promise<ClearResponse> {
    return this.post(`/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`, {});
  }

  async batchUpdate(spreadsheetId: string, data: { range: string; values: (string | number | boolean)[][] }[]): Promise<BatchUpdateResponse> {
    const body = {
      valueInputOption: 'USER_ENTERED',
      data,
    };
    return this.post(`/${spreadsheetId}/values:batchUpdate`, body);
  }

  async batchClear(spreadsheetId: string, ranges: string[]): Promise<{ spreadsheetId: string; clearedRanges: string[] }> {
    return this.post(`/${spreadsheetId}/values:batchClear`, { ranges });
  }

  // -- Row/Column Operations -----------------------------------------------

  async insertRows(spreadsheetId: string, sheetId: number, startIndex: number, endIndex: number): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        insertDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex, endIndex },
          inheritFromBefore: false,
        },
      }],
    });
  }

  async deleteRows(spreadsheetId: string, sheetId: number, startIndex: number, endIndex: number): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex, endIndex },
        },
      }],
    });
  }

  async insertColumns(spreadsheetId: string, sheetId: number, startIndex: number, endIndex: number): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        insertDimension: {
          range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex },
          inheritFromBefore: false,
        },
      }],
    });
  }

  async deleteColumns(spreadsheetId: string, sheetId: number, startIndex: number, endIndex: number): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex },
        },
      }],
    });
  }

  // -- Sheet Management ----------------------------------------------------

  async addSheet(spreadsheetId: string, title: string): Promise<{ properties: SheetProperties }> {
    const response = await this.post<{ replies: { addSheet: { properties: SheetProperties } }[] }>(
      `/${spreadsheetId}:batchUpdate`,
      {
        requests: [{ addSheet: { properties: { title } } }],
      },
    );
    return response.replies[0].addSheet;
  }

  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{ deleteSheet: { sheetId } }],
    });
  }

  async updateSheetProperties(spreadsheetId: string, sheetId: number, properties: { title?: string; hidden?: boolean; tabColorStyle?: Record<string, unknown> }): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId, ...properties },
          fields: Object.keys(properties).join(','),
        },
      }],
    });
  }

  async renameSheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<void> {
    return this.updateSheetProperties(spreadsheetId, sheetId, { title: newTitle });
  }

  async copySheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<{ properties: SheetProperties }> {
    const response = await this.post<{ replies: { copySheet: { properties: SheetProperties } }[] }>(
      `/${spreadsheetId}:batchUpdate`,
      {
        requests: [{
          copySheet: {
            source: { sheetId },
            destination: { properties: { title: newTitle } },
          },
        }],
      },
    );
    return response.replies[0].copySheet;
  }

  // -- Formatting ----------------------------------------------------------

  async formatCells(
    spreadsheetId: string,
    range: string,
    format: {
      backgroundColor?: { red?: number; green?: number; blue?: number };
      textFormat?: { bold?: boolean; italic?: boolean; fontSize?: number; foregroundColor?: { red?: number; green?: number; blue?: number } };
      horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT';
      verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
      numberFormat?: { type: string; pattern?: string };
      borders?: { style: string };
      wrapStrategy?: 'OVERFLOW_CELL' | 'CLIP' | 'WRAP';
    },
  ): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        repeatCell: {
          range: { a1Notation: range },
          cell: { userEnteredFormat: format },
          fields: `userEnteredFormat(${Object.keys(format).join(',')})`,
        },
      }],
    });
  }

  async mergeCells(spreadsheetId: string, sheetId: number, startRow: number, startColumn: number, endRow: number, endColumn: number, mergeType: 'MERGE_ALL' | 'MERGE_ROWS' | 'MERGE_COLUMNS' = 'MERGE_ALL'): Promise<void> {
    await this.post(`/${spreadsheetId}:batchUpdate`, {
      requests: [{
        mergeCells: {
          range: { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startColumn, endColumnIndex: endColumn },
          mergeType,
        },
      }],
    });
  }

  // -- Helpers -------------------------------------------------------------

  private columnToLetter(column: number): string {
    let result = '';
    let c = column;
    while (c > 0) {
      c--;
      result = String.fromCharCode(65 + (c % 26)) + result;
      c = Math.floor(c / 26);
    }
    return result;
  }

  static range(sheetName: string, startCol: string, startRow: number, endCol?: string, endRow?: number): string {
    const end = endCol ? `${startCol}${startRow}:${endCol}${endRow}` : `${startCol}${startRow}`;
    return `'${sheetName}'!${end}`;
  }

  static A1Notation(sheetId: number, startRow: number, startCol: number, endRow?: number, endCol?: number): Record<string, unknown> {
    const range: Record<string, unknown> = { sheetId, startRowIndex: startRow, startColumnIndex: startCol };
    if (endRow !== undefined) range.endRowIndex = endRow;
    if (endCol !== undefined) range.endColumnIndex = endCol;
    return range;
  }
}
