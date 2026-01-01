import { google, sheets_v4 } from 'googleapis';
import CryptoJS from 'crypto-js';
import type { Product, WorkCenter, WeeklySchedule, TimeRange } from '@/types';
import { DEFAULT_WEEKLY_SCHEDULE } from '@/types/workCenter';
import { getServiceAccountCredentials, getGoogleSheetsConfig } from './firestoreService';

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
        const credentials = JSON.parse(this.serviceAccountCredentials);
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        auth = new google.auth.GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }

      this.sheets = google.sheets({ version: 'v4', auth });
      return this.sheets;
    } catch (error) {
      throw new Error(`Failed to connect to Google Sheets: ${error}`);
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

  async testConnection(): Promise<boolean> {
    try {
      const sheets = await this.getClient();
      await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title',
      });
      return true;
    } catch {
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
    const sheets = await this.getClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });

    const title = response.data.properties?.title || 'Unknown';
    const sheetNames = response.data.sheets?.map(s => s.properties?.title || '') || [];

    return { title, sheets: sheetNames };
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
