import { google, sheets_v4 } from 'googleapis';
import CryptoJS from 'crypto-js';
import type { Product, WorkCenter, WeeklySchedule, TimeRange } from '@/types';
import { DEFAULT_WEEKLY_SCHEDULE } from '@/types/workCenter';
import { getServiceAccountCredentials, getGoogleSheetsConfig } from './firestoreService';
import type { SheetIssue, SheetIssueCode, SheetsHealth, SheetsHealthStatus } from '@/types/settings';
import { PRODUCTION_SCHEDULING_TEMPLATE, DEFAULT_WORK_CENTERS, DEFAULT_HOLIDAYS } from '@/lib/sheetsTemplates';

// Sheet names
export const SHEET_NAMES = {
  PRODUCTS: 'Products',
  WORK_CENTERS: 'Work Centers',
  HOLIDAYS: 'Holidays',
  SETTINGS: 'Settings',
  AUDIT_LOG: '_AuditLog',
  SYNC_METADATA: '_SyncMetadata',
};

// Column mappings for Products sheet
export const PRODUCT_COLUMNS = {
  JOB_NUMBER: 0,
  CUSTOMER: 1,
  PRODUCT_TEXT: 2,
  QUANTITY: 3,
  LENGTH: 4,
  REQUESTED_SHIP_DATE: 5,
  SETUP_MINUTES: 6,
  UPH: 7,
  CUT: 8,
  EXTRUSION: 9,
  GROUND: 10,
  DRAWING: 11,
  ENDS: 12,
  WORK_CENTER: 13,
  BALANCE_QUANTITY: 14,
  PRIORITY: 15,
  PRIORITY_UPDATED_AT: 16,
  SCHEDULED_START: 17,
  SCHEDULED_END: 18,
  SCHEDULE_STATUS: 19,
  SCHEDULE_LOCKED: 20,
  LOCK_REASON: 21,
  ROW_HASH: 22,
  NOTES: 23,
  CUSTOMER_PO: 24,
  MATERIAL_STATUS: 25,
  LOT_NUMBER: 26,
};

// Work Center column mappings
export const WORK_CENTER_COLUMNS = {
  ID: 0,
  NAME: 1,
  TYPE: 2,
  ACTIVE: 3,
  EFFICIENCY_FACTOR: 4,
  MON_START: 5,
  MON_END: 6,
  TUE_START: 7,
  TUE_END: 8,
  WED_START: 9,
  WED_END: 10,
  THU_START: 11,
  THU_END: 12,
  FRI_START: 13,
  FRI_END: 14,
  SAT_START: 15,
  SAT_END: 16,
  SUN_START: 17,
  SUN_END: 18,
};

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private spreadsheetId: string;
  private serviceAccountCredentials: string | null = null;
  private retryDelays = [1000, 2000, 4000, 8000, 16000];

  constructor(spreadsheetId: string, serviceAccountJson?: string) {
    this.spreadsheetId = spreadsheetId;
    this.serviceAccountCredentials = serviceAccountJson || null;
  }

  private async getClient(): Promise<sheets_v4.Sheets> {
    if (this.sheets) {
      return this.sheets;
    }

    try {
      let auth;
      
      if (this.serviceAccountCredentials) {
        console.log('Parsing service account credentials...');
        let credentials;
        try {
          credentials = JSON.parse(this.serviceAccountCredentials);
          console.log('Service account email:', credentials.client_email);
        } catch (parseError) {
          console.error('Failed to parse service account JSON:', parseError);
          throw new Error('Invalid service account JSON format');
        }
        
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        console.log('Using default Google Auth (no credentials provided)');
        auth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }

      this.sheets = google.sheets({ version: 'v4', auth });
      console.log('Google Sheets client created successfully');
      return this.sheets;
    } catch (error) {
      console.error('Failed to create Google Sheets client:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to connect to Google Sheets: ${errorMessage}`);
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        const isRateLimited = 
          error instanceof Error && 
          (error.message.includes('429') || error.message.includes('Quota exceeded'));

        if (!isRateLimited || attempt >= this.retryDelays.length) {
          throw error;
        }

        const delay = this.retryDelays[attempt] + Math.random() * 1000;
        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${operationName} failed after retries`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Error Parsing & Sheet Issue Creation
  // ============================================================================

  parseGoogleApiError(error: unknown, context?: { sheetName?: string; operation?: string }): SheetIssue {
    const errorObj = error as { code?: number; message?: string; errors?: Array<{ reason?: string; message?: string }> };
    const code = errorObj.code;
    const message = errorObj.message || String(error);
    const errorReason = errorObj.errors?.[0]?.reason;

    // Parse specific error types
    if (message.includes('Unable to parse range') || message.includes('range not found')) {
      return {
        code: 'SHEET_NOT_FOUND',
        severity: 'error',
        sheetName: context?.sheetName,
        message: `Sheet "${context?.sheetName || 'Unknown'}" does not exist in the spreadsheet.`,
        userAction: 'The sheet may have been deleted or renamed. An administrator can recreate the missing sheet.',
        adminRequired: true,
      };
    }

    if (code === 403 || errorReason === 'forbidden') {
      return {
        code: 'PERMISSION_DENIED',
        severity: 'error',
        message: 'Access denied to the spreadsheet.',
        userAction: 'Make sure the service account email has been granted Editor access to the spreadsheet.',
        adminRequired: true,
      };
    }

    if (code === 404 || message.includes('Requested entity was not found')) {
      return {
        code: 'SPREADSHEET_NOT_FOUND',
        severity: 'error',
        message: 'The spreadsheet could not be found.',
        userAction: 'Verify the spreadsheet ID is correct and the spreadsheet has not been deleted.',
        adminRequired: true,
      };
    }

    if (code === 429 || message.includes('Quota exceeded') || message.includes('Rate Limit')) {
      return {
        code: 'RATE_LIMITED',
        severity: 'warning',
        message: 'Google Sheets API rate limit reached.',
        userAction: 'Please wait a moment and try again. The system will automatically retry.',
        adminRequired: false,
      };
    }

    if (message.includes('API has not been used') || message.includes('API disabled') || message.includes('sheets.googleapis.com')) {
      return {
        code: 'API_DISABLED',
        severity: 'error',
        message: 'The Google Sheets API is not enabled for this project.',
        userAction: 'Enable the Google Sheets API in the Google Cloud Console for your project.',
        adminRequired: true,
      };
    }

    if (message.includes('invalid_grant') || message.includes('Invalid JWT') || message.includes('credentials')) {
      return {
        code: 'INVALID_CREDENTIALS',
        severity: 'error',
        message: 'The service account credentials are invalid or expired.',
        userAction: 'Re-upload valid service account credentials.',
        adminRequired: true,
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      severity: 'error',
      sheetName: context?.sheetName,
      message: `An error occurred: ${message}`,
      userAction: 'Please try again. If the problem persists, contact support.',
      adminRequired: false,
      details: { originalError: message, operation: context?.operation },
    };
  }

  // ============================================================================
  // Safe Sheet Operations (return issues instead of throwing)
  // ============================================================================

  async safeGetSheetData(sheetName: string): Promise<{ data: string[][] | null; issue: SheetIssue | null }> {
    try {
      const data = await this.getSheetData(sheetName);
      return { data, issue: null };
    } catch (error) {
      return { data: null, issue: this.parseGoogleApiError(error, { sheetName, operation: 'getSheetData' }) };
    }
  }

  async validateSheetHealth(): Promise<SheetsHealth> {
    const issues: SheetIssue[] = [];
    const sheetStatuses: SheetsHealth['sheets'] = [];
    
    try {
      // First, check if we can connect and get spreadsheet info
      const info = await this.getSpreadsheetInfo();
      const existingSheets = new Set(info.sheets);

      // Check each expected sheet from the template
      for (const sheetConfig of PRODUCTION_SCHEDULING_TEMPLATE.sheets) {
        const sheetName = sheetConfig.name;
        const exists = existingSheets.has(sheetName);
        const requiredHeaders = sheetConfig.columns.filter(c => c.required).map(c => c.label);
        
        if (!exists) {
          issues.push({
            code: 'SHEET_NOT_FOUND',
            severity: 'error',
            sheetName,
            message: `Required sheet "${sheetName}" is missing from the spreadsheet.`,
            userAction: 'Create the missing sheet or use the "Fix Issues" button to automatically create it.',
            adminRequired: true,
          });
          
          sheetStatuses.push({
            name: sheetName,
            exists: false,
            hasRequiredHeaders: false,
            missingHeaders: requiredHeaders,
            extraHeaders: [],
          });
          continue;
        }

        // Sheet exists, check headers
        const { data, issue } = await this.safeGetSheetData(sheetName);
        
        if (issue) {
          issues.push(issue);
          sheetStatuses.push({
            name: sheetName,
            exists: true,
            hasRequiredHeaders: false,
            missingHeaders: requiredHeaders,
            extraHeaders: [],
          });
          continue;
        }

        const headers = data?.[0] || [];
        const expectedHeaders = sheetConfig.columns.map(c => c.label);
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        const extraHeaders = headers.filter(h => !expectedHeaders.includes(h) && h.trim() !== '');

        if (missingHeaders.length > 0) {
          issues.push({
            code: 'MISSING_REQUIRED_HEADER',
            severity: 'error',
            sheetName,
            message: `Sheet "${sheetName}" is missing required columns: ${missingHeaders.join(', ')}`,
            userAction: 'Add the missing columns or use the "Fix Issues" button to automatically add them.',
            adminRequired: true,
            details: { missingHeaders },
          });
        }

        sheetStatuses.push({
          name: sheetName,
          exists: true,
          hasRequiredHeaders: missingHeaders.length === 0,
          missingHeaders,
          extraHeaders,
        });
      }

      // Determine overall status
      let status: SheetsHealthStatus = 'healthy';
      if (issues.some(i => i.severity === 'error')) {
        status = 'error';
      } else if (issues.some(i => i.severity === 'warning')) {
        status = 'degraded';
      }

      return {
        status,
        issues,
        lastChecked: new Date().toISOString(),
        sheets: sheetStatuses,
      };
    } catch (error) {
      // Connection-level failure
      const issue = this.parseGoogleApiError(error, { operation: 'validateSheetHealth' });
      return {
        status: 'error',
        issues: [issue],
        lastChecked: new Date().toISOString(),
        sheets: [],
      };
    }
  }

  // ============================================================================
  // Sheet Rename Operations
  // ============================================================================

  async renameSheet(oldName: string, newName: string): Promise<{ success: boolean; issue?: SheetIssue }> {
    try {
      const sheets = await this.getClient();
      
      // First get the sheet ID by name
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties',
      });

      const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === oldName);
      if (!sheet?.properties?.sheetId) {
        return {
          success: false,
          issue: {
            code: 'SHEET_NOT_FOUND',
            severity: 'error',
            sheetName: oldName,
            message: `Sheet "${oldName}" not found`,
            userAction: 'The sheet may have already been renamed or deleted.',
            adminRequired: true,
          },
        };
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: sheet.properties.sheetId,
                title: newName,
              },
              fields: 'title',
            },
          }],
        },
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        issue: this.parseGoogleApiError(error, { sheetName: oldName, operation: 'renameSheet' }),
      };
    }
  }

  async updateSheetHeaders(sheetName: string, newHeaders: string[]): Promise<{ success: boolean; issue?: SheetIssue }> {
    try {
      await this.updateSheetData(`${sheetName}!A1:${this.columnToLetter(newHeaders.length)}1`, [newHeaders]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        issue: this.parseGoogleApiError(error, { sheetName, operation: 'updateSheetHeaders' }),
      };
    }
  }

  private columnToLetter(column: number): string {
    let result = '';
    let temp = column;
    while (temp > 0) {
      temp--;
      result = String.fromCharCode(65 + (temp % 26)) + result;
      temp = Math.floor(temp / 26);
    }
    return result;
  }

  // ============================================================================
  // Auto-fix Operations
  // ============================================================================

  async fixMissingSheets(): Promise<{ fixed: string[]; errors: SheetIssue[] }> {
    const fixed: string[] = [];
    const errors: SheetIssue[] = [];

    try {
      const info = await this.getSpreadsheetInfo();
      const existingSheets = new Set(info.sheets);

      for (const sheetConfig of PRODUCTION_SCHEDULING_TEMPLATE.sheets) {
        const sheetName = sheetConfig.name;
        
        if (!existingSheets.has(sheetName)) {
          try {
            await this.createSheet(sheetName);
            
            // Set up headers and default data
            const headers = sheetConfig.columns.map(c => c.label);
            await this.updateSheetData(`${sheetName}!A1:${this.columnToLetter(headers.length)}1`, [headers]);
            
            // Add default data for specific sheets
            if (sheetName === SHEET_NAMES.WORK_CENTERS) {
              await this.updateSheetData(
                `${sheetName}!A2:S${DEFAULT_WORK_CENTERS.length + 1}`,
                DEFAULT_WORK_CENTERS as (string | number | boolean | null)[][]
              );
            } else if (sheetName === SHEET_NAMES.HOLIDAYS) {
              await this.updateSheetData(
                `${sheetName}!A2:C${DEFAULT_HOLIDAYS.length + 1}`,
                DEFAULT_HOLIDAYS as (string | number | boolean | null)[][]
              );
            } else if (sheetName === SHEET_NAMES.SETTINGS) {
              const defaultSettings = [
                ['atRiskBufferDays', '2'],
                ['syncIntervalSeconds', '60'],
                ['defaultPriorityPosition', 'end'],
              ];
              await this.updateSheetData(`${sheetName}!A2:B4`, defaultSettings);
            }
            
            fixed.push(sheetName);
          } catch (error) {
            errors.push(this.parseGoogleApiError(error, { sheetName, operation: 'createSheet' }));
          }
        }
      }

      return { fixed, errors };
    } catch (error) {
      errors.push(this.parseGoogleApiError(error, { operation: 'fixMissingSheets' }));
      return { fixed, errors };
    }
  }

  async fixMissingHeaders(sheetName: string): Promise<{ success: boolean; issue?: SheetIssue }> {
    try {
      const sheetConfig = PRODUCTION_SCHEDULING_TEMPLATE.sheets.find(s => s.name === sheetName);
      if (!sheetConfig) {
        return {
          success: false,
          issue: {
            code: 'UNKNOWN_ERROR',
            severity: 'error',
            sheetName,
            message: `No template configuration found for sheet "${sheetName}"`,
            userAction: 'Contact support.',
            adminRequired: true,
          },
        };
      }

      const { data, issue } = await this.safeGetSheetData(sheetName);
      if (issue) {
        return { success: false, issue };
      }

      const existingHeaders = data?.[0] || [];
      const expectedHeaders = sheetConfig.columns.map(c => c.label);
      
      // Merge: keep existing headers in place, add missing ones at the end
      const newHeaders = [...existingHeaders];
      for (const header of expectedHeaders) {
        if (!existingHeaders.includes(header)) {
          newHeaders.push(header);
        }
      }

      return await this.updateSheetHeaders(sheetName, newHeaders);
    } catch (error) {
      return {
        success: false,
        issue: this.parseGoogleApiError(error, { sheetName, operation: 'fixMissingHeaders' }),
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('Testing connection to Google Sheets with ID:', this.spreadsheetId);

      const sheets = await this.getClient();
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title',
      });
      console.log('Successfully connected to spreadsheet:', response.data.properties?.title);
      return true;
    } catch (error) {
      console.error('Test connection failed:', error);
      return false;
    }
  }

  async getSheetData(sheetName: string): Promise<string[][]> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
      });
      return (response.data.values as string[][]) || [];
    }, `getSheetData(${sheetName})`);
  }

  async updateSheetData(
    range: string,
    values: (string | number | boolean | null)[][]
  ): Promise<void> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });
    }, `updateSheetData(${range})`);
  }

  async batchUpdateSheetData(
    updates: { range: string; values: (string | number | boolean | null)[][] }[]
  ): Promise<void> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates.map((u) => ({
            range: u.range,
            values: u.values,
          })),
        },
      });
    }, 'batchUpdateSheetData');
  }

  async appendRow(
    sheetName: string,
    values: (string | number | boolean | null)[]
  ): Promise<number> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [values] },
      });
      
      const updatedRange = response.data.updates?.updatedRange || '';
      const match = updatedRange.match(/:?(\d+)$/);
      return match ? parseInt(match[1], 10) : -1;
    }, `appendRow(${sheetName})`);
  }

  calculateRowHash(rowData: (string | number | boolean | null)[]): string {
    const dataString = JSON.stringify(rowData);
    return CryptoJS.MD5(dataString).toString();
  }

  parseProductRow(row: string[], rowIndex: number): Product {
    const getValue = (index: number): string => row[index] || '';
    const getNumber = (index: number): number => parseFloat(row[index]) || 0;
    const getBool = (index: number): boolean => 
      row[index]?.toLowerCase() === 'true' || row[index] === '1';

    const dataForHash = row.slice(0, PRODUCT_COLUMNS.ROW_HASH);
    const rowHash = this.calculateRowHash(dataForHash);

    return {
      jobNumber: getValue(PRODUCT_COLUMNS.JOB_NUMBER),
      customer: getValue(PRODUCT_COLUMNS.CUSTOMER),
      productText: getValue(PRODUCT_COLUMNS.PRODUCT_TEXT),
      quantity: getNumber(PRODUCT_COLUMNS.QUANTITY),
      length: getNumber(PRODUCT_COLUMNS.LENGTH),
      requestedShipDate: getValue(PRODUCT_COLUMNS.REQUESTED_SHIP_DATE),
      setupMinutes: getNumber(PRODUCT_COLUMNS.SETUP_MINUTES),
      uph: getNumber(PRODUCT_COLUMNS.UPH),
      cut: getBool(PRODUCT_COLUMNS.CUT),
      extrusion: getBool(PRODUCT_COLUMNS.EXTRUSION),
      ground: getBool(PRODUCT_COLUMNS.GROUND),
      drawing: getValue(PRODUCT_COLUMNS.DRAWING),
      ends: (getValue(PRODUCT_COLUMNS.ENDS) || '_') as Product['ends'],
      workCenter: getValue(PRODUCT_COLUMNS.WORK_CENTER),
      balanceQuantity: getNumber(PRODUCT_COLUMNS.BALANCE_QUANTITY),
      priority: getNumber(PRODUCT_COLUMNS.PRIORITY) || 999,
      priorityUpdatedAt: getValue(PRODUCT_COLUMNS.PRIORITY_UPDATED_AT) || new Date().toISOString(),
      scheduledStart: getValue(PRODUCT_COLUMNS.SCHEDULED_START) || null,
      scheduledEnd: getValue(PRODUCT_COLUMNS.SCHEDULED_END) || null,
      scheduleStatus: (getValue(PRODUCT_COLUMNS.SCHEDULE_STATUS) || 'Unscheduled') as Product['scheduleStatus'],
      scheduleLocked: getBool(PRODUCT_COLUMNS.SCHEDULE_LOCKED),
      lockReason: getValue(PRODUCT_COLUMNS.LOCK_REASON) || null,
      rowIndex: rowIndex + 1,
      rowHash,
      notes: getValue(PRODUCT_COLUMNS.NOTES) || undefined,
      customerPO: getValue(PRODUCT_COLUMNS.CUSTOMER_PO) || undefined,
      materialStatus: getValue(PRODUCT_COLUMNS.MATERIAL_STATUS) || undefined,
      lotNumber: getValue(PRODUCT_COLUMNS.LOT_NUMBER) || undefined,
    };
  }

  productToRow(product: Partial<Product>): (string | number | boolean | null)[] {
    const row: (string | number | boolean | null)[] = new Array(27).fill(null);
    
    if (product.jobNumber !== undefined) row[PRODUCT_COLUMNS.JOB_NUMBER] = product.jobNumber;
    if (product.customer !== undefined) row[PRODUCT_COLUMNS.CUSTOMER] = product.customer;
    if (product.productText !== undefined) row[PRODUCT_COLUMNS.PRODUCT_TEXT] = product.productText;
    if (product.quantity !== undefined) row[PRODUCT_COLUMNS.QUANTITY] = product.quantity;
    if (product.length !== undefined) row[PRODUCT_COLUMNS.LENGTH] = product.length;
    if (product.requestedShipDate !== undefined) row[PRODUCT_COLUMNS.REQUESTED_SHIP_DATE] = product.requestedShipDate;
    if (product.setupMinutes !== undefined) row[PRODUCT_COLUMNS.SETUP_MINUTES] = product.setupMinutes;
    if (product.uph !== undefined) row[PRODUCT_COLUMNS.UPH] = product.uph;
    if (product.cut !== undefined) row[PRODUCT_COLUMNS.CUT] = product.cut;
    if (product.extrusion !== undefined) row[PRODUCT_COLUMNS.EXTRUSION] = product.extrusion;
    if (product.ground !== undefined) row[PRODUCT_COLUMNS.GROUND] = product.ground;
    if (product.drawing !== undefined) row[PRODUCT_COLUMNS.DRAWING] = product.drawing;
    if (product.ends !== undefined) row[PRODUCT_COLUMNS.ENDS] = product.ends;
    if (product.workCenter !== undefined) row[PRODUCT_COLUMNS.WORK_CENTER] = product.workCenter;
    if (product.balanceQuantity !== undefined) row[PRODUCT_COLUMNS.BALANCE_QUANTITY] = product.balanceQuantity;
    if (product.priority !== undefined) row[PRODUCT_COLUMNS.PRIORITY] = product.priority;
    if (product.priorityUpdatedAt !== undefined) row[PRODUCT_COLUMNS.PRIORITY_UPDATED_AT] = product.priorityUpdatedAt;
    if (product.scheduledStart !== undefined) row[PRODUCT_COLUMNS.SCHEDULED_START] = product.scheduledStart;
    if (product.scheduledEnd !== undefined) row[PRODUCT_COLUMNS.SCHEDULED_END] = product.scheduledEnd;
    if (product.scheduleStatus !== undefined) row[PRODUCT_COLUMNS.SCHEDULE_STATUS] = product.scheduleStatus;
    if (product.scheduleLocked !== undefined) row[PRODUCT_COLUMNS.SCHEDULE_LOCKED] = product.scheduleLocked;
    if (product.lockReason !== undefined) row[PRODUCT_COLUMNS.LOCK_REASON] = product.lockReason;
    if (product.notes !== undefined) row[PRODUCT_COLUMNS.NOTES] = product.notes;
    if (product.customerPO !== undefined) row[PRODUCT_COLUMNS.CUSTOMER_PO] = product.customerPO;
    if (product.materialStatus !== undefined) row[PRODUCT_COLUMNS.MATERIAL_STATUS] = product.materialStatus;
    if (product.lotNumber !== undefined) row[PRODUCT_COLUMNS.LOT_NUMBER] = product.lotNumber;
    
    return row;
  }

  private parseTimeRange(start: string, end: string): TimeRange | null {
    if (!start || !end || start === '-' || end === '-') {
      return null;
    }
    return { start, end };
  }

  parseWorkCenterRow(row: string[], rowIndex: number): WorkCenter {
    const getValue = (index: number): string => row[index] || '';
    const getNumber = (index: number): number => parseFloat(row[index]) || 1.0;
    const getBool = (index: number): boolean => 
      row[index]?.toLowerCase() !== 'false' && row[index] !== '0';

    const schedule: WeeklySchedule = {
      monday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.MON_START),
        getValue(WORK_CENTER_COLUMNS.MON_END)
      ),
      tuesday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.TUE_START),
        getValue(WORK_CENTER_COLUMNS.TUE_END)
      ),
      wednesday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.WED_START),
        getValue(WORK_CENTER_COLUMNS.WED_END)
      ),
      thursday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.THU_START),
        getValue(WORK_CENTER_COLUMNS.THU_END)
      ),
      friday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.FRI_START),
        getValue(WORK_CENTER_COLUMNS.FRI_END)
      ),
      saturday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.SAT_START),
        getValue(WORK_CENTER_COLUMNS.SAT_END)
      ),
      sunday: this.parseTimeRange(
        getValue(WORK_CENTER_COLUMNS.SUN_START),
        getValue(WORK_CENTER_COLUMNS.SUN_END)
      ),
    };

    return {
      id: getValue(WORK_CENTER_COLUMNS.ID),
      name: getValue(WORK_CENTER_COLUMNS.NAME),
      type: (getValue(WORK_CENTER_COLUMNS.TYPE) || 'Other') as WorkCenter['type'],
      active: getBool(WORK_CENTER_COLUMNS.ACTIVE),
      efficiencyFactor: getNumber(WORK_CENTER_COLUMNS.EFFICIENCY_FACTOR),
      schedule,
      rowIndex: rowIndex + 1,
    };
  }

  workCenterToRow(wc: WorkCenter): (string | number | boolean | null)[] {
    const timeToCell = (tr: TimeRange | null): string => tr?.start || '-';
    const timeEndToCell = (tr: TimeRange | null): string => tr?.end || '-';
    const schedule = wc.schedule || DEFAULT_WEEKLY_SCHEDULE;

    return [
      wc.id,
      wc.name,
      wc.type,
      wc.active,
      wc.efficiencyFactor,
      timeToCell(schedule.monday),
      timeEndToCell(schedule.monday),
      timeToCell(schedule.tuesday),
      timeEndToCell(schedule.tuesday),
      timeToCell(schedule.wednesday),
      timeEndToCell(schedule.wednesday),
      timeToCell(schedule.thursday),
      timeEndToCell(schedule.thursday),
      timeToCell(schedule.friday),
      timeEndToCell(schedule.friday),
      timeToCell(schedule.saturday),
      timeEndToCell(schedule.saturday),
      timeToCell(schedule.sunday),
      timeEndToCell(schedule.sunday),
    ];
  }

  async getAllProducts(): Promise<Product[]> {
    const data = await this.getSheetData(SHEET_NAMES.PRODUCTS);
    return data.slice(1).map((row, index) => this.parseProductRow(row, index + 1));
  }

  async getAllWorkCenters(): Promise<WorkCenter[]> {
    const data = await this.getSheetData(SHEET_NAMES.WORK_CENTERS);
    return data.slice(1).map((row, index) => this.parseWorkCenterRow(row, index + 1));
  }

  async updateProduct(product: Product): Promise<void> {
    const row = this.productToRow(product);
    const range = `${SHEET_NAMES.PRODUCTS}!A${product.rowIndex}:AA${product.rowIndex}`;
    await this.updateSheetData(range, [row]);
  }

  async batchUpdateProducts(products: Product[]): Promise<void> {
    const updates = products.map((product) => ({
      range: `${SHEET_NAMES.PRODUCTS}!A${product.rowIndex}:AA${product.rowIndex}`,
      values: [this.productToRow(product)],
    }));
    
    await this.batchUpdateSheetData(updates);
  }

  async batchUpdateSchedules(
    updates: {
      rowIndex: number;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      scheduleStatus: string;
    }[]
  ): Promise<void> {
    const batchUpdates = updates.map((u) => ({
      range: `${SHEET_NAMES.PRODUCTS}!R${u.rowIndex}:T${u.rowIndex}`,
      values: [[u.scheduledStart, u.scheduledEnd, u.scheduleStatus]],
    }));
    
    await this.batchUpdateSheetData(batchUpdates);
  }

  async batchUpdatePriorities(
    updates: { rowIndex: number; priority: number; priorityUpdatedAt: string }[]
  ): Promise<void> {
    const batchUpdates = updates.map((u) => ({
      range: `${SHEET_NAMES.PRODUCTS}!P${u.rowIndex}:Q${u.rowIndex}`,
      values: [[u.priority, u.priorityUpdatedAt]],
    }));
    
    await this.batchUpdateSheetData(batchUpdates);
  }

  async getSpreadsheetInfo(): Promise<{ title: string; sheets: string[] }> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title,sheets.properties.title',
      });

      const title = response.data.properties?.title || 'Unknown';
      const sheetNames = response.data.sheets?.map(s => s.properties?.title || '') || [];

      return { title, sheets: sheetNames };
    }, 'getSpreadsheetInfo');
  }

  async createSheet(sheetName: string): Promise<void> {
    return this.withRetry(async () => {
      const sheets = await this.getClient();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          }],
        },
      });
    }, `createSheet(${sheetName})`);
  }

  async setupProductsSheet(): Promise<void> {
    const sheetConfig = PRODUCTION_SCHEDULING_TEMPLATE.sheets.find(s => s.key === 'products');
    const headers = sheetConfig?.columns.map(c => c.label) || [
      'Job Number', 'Customer', 'Product Text', 'Balance Quantity', 
      'Requested Ship Date', 'Work Center', 'Priority', 'UPH', 
      'Setup Time (hrs)', 'Ends Type', 'Scheduled Start', 'Scheduled End', 
      'Schedule Status', 'Schedule Locked', 'Lock Reason', 'Priority Updated At', 'Notes'
    ];
    await this.updateSheetData(`${SHEET_NAMES.PRODUCTS}!A1:${this.columnToLetter(headers.length)}1`, [headers]);
  }

  async setupWorkCentersSheet(): Promise<void> {
    const sheetConfig = PRODUCTION_SCHEDULING_TEMPLATE.sheets.find(s => s.key === 'workCenters');
    const headers = sheetConfig?.columns.map(c => c.label) || [
      'ID', 'Name', 'Type', 'Active', 'Default UPH',
      'Mon Start', 'Mon End', 'Tue Start', 'Tue End',
      'Wed Start', 'Wed End', 'Thu Start', 'Thu End',
      'Fri Start', 'Fri End', 'Sat Start', 'Sat End',
      'Sun Start', 'Sun End'
    ];
    await this.updateSheetData(`${SHEET_NAMES.WORK_CENTERS}!A1:S${DEFAULT_WORK_CENTERS.length + 1}`, [headers, ...DEFAULT_WORK_CENTERS] as (string | number | boolean | null)[][]);
  }

  async setupHolidaysSheet(): Promise<void> {
    const sheetConfig = PRODUCTION_SCHEDULING_TEMPLATE.sheets.find(s => s.key === 'holidays');
    const headers = sheetConfig?.columns.map(c => c.label) || ['Date', 'Name', 'Affected Work Centers'];
    await this.updateSheetData(`${SHEET_NAMES.HOLIDAYS}!A1:C${DEFAULT_HOLIDAYS.length + 1}`, [headers, ...DEFAULT_HOLIDAYS] as (string | number | boolean | null)[][]);
  }

  async setupSettingsSheet(): Promise<void> {
    const sheetConfig = PRODUCTION_SCHEDULING_TEMPLATE.sheets.find(s => s.key === 'settings');
    const headers = sheetConfig?.columns.map(c => c.label) || ['Setting', 'Value'];
    const defaultSettings = [
      ['atRiskBufferDays', '2'],
      ['syncIntervalSeconds', '60'],
      ['defaultPriorityPosition', 'end'],
    ];
    await this.updateSheetData(`${SHEET_NAMES.SETTINGS}!A1:B4`, [headers, ...defaultSettings]);
  }

  async initializeAllSheets(): Promise<{ created: string[]; errors: string[] }> {
    const created: string[] = [];
    const errors: string[] = [];

    // Get existing sheets
    const info = await this.getSpreadsheetInfo();
    const existingSheets = new Set(info.sheets);

    // Define sheets to create with their setup functions
    const sheetsToSetup = [
      { name: SHEET_NAMES.PRODUCTS, setup: () => this.setupProductsSheet() },
      { name: SHEET_NAMES.WORK_CENTERS, setup: () => this.setupWorkCentersSheet() },
      { name: SHEET_NAMES.HOLIDAYS, setup: () => this.setupHolidaysSheet() },
      { name: SHEET_NAMES.SETTINGS, setup: () => this.setupSettingsSheet() },
    ];

    for (const { name, setup } of sheetsToSetup) {
      try {
        if (!existingSheets.has(name)) {
          await this.createSheet(name);
          created.push(name);
        }
        await setup();
      } catch (error) {
        errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { created, errors };
  }
}

// ============================================================================
// Factory functions
// ============================================================================

const serviceCache = new Map<string, { service: GoogleSheetsService; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function createGoogleSheetsClient(orgId: string): Promise<GoogleSheetsService> {
  const cached = serviceCache.get(orgId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.service;
  }

  const gsConfig = await getGoogleSheetsConfig(orgId);
  if (!gsConfig || !gsConfig.configured) {
    throw new Error(`Organization ${orgId} has not configured Google Sheets`);
  }

  const serviceAccountJson = await getServiceAccountCredentials(orgId);
  if (!serviceAccountJson) {
    throw new Error(`Service account credentials not found for organization ${orgId}`);
  }

  const service = new GoogleSheetsService(gsConfig.spreadsheetId, serviceAccountJson);
  serviceCache.set(orgId, { service, timestamp: Date.now() });

  return service;
}

export function createTestGoogleSheetsClient(
  spreadsheetId: string,
  serviceAccountJson: string
): GoogleSheetsService {
  return new GoogleSheetsService(spreadsheetId, serviceAccountJson);
}

export function clearOrgServiceCache(orgId: string): void {
  serviceCache.delete(orgId);
}
