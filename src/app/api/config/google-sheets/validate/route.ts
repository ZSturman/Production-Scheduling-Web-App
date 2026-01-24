import { NextResponse } from 'next/server';
import { 
  withOrg,
  validateServiceAccountJson,
  createTestGoogleSheetsClient,
} from '@/lib/server';
import { SHEET_NAMES, PRODUCT_COLUMNS, WORK_CENTER_COLUMNS } from '@/lib/server/googleSheets';

// Expected column headers for each sheet
const EXPECTED_HEADERS = {
  [SHEET_NAMES.PRODUCTS]: {
    required: [
      { index: PRODUCT_COLUMNS.JOB_NUMBER, name: 'Job Number' },
      { index: PRODUCT_COLUMNS.WORK_CENTER, name: 'Work Center' },
    ],
    optional: [
      { index: PRODUCT_COLUMNS.CUSTOMER, name: 'Customer' },
      { index: PRODUCT_COLUMNS.PRODUCT_TEXT, name: 'Product Text' },
      { index: PRODUCT_COLUMNS.QUANTITY, name: 'Quantity' },
      { index: PRODUCT_COLUMNS.REQUESTED_SHIP_DATE, name: 'Requested Ship Date' },
      { index: PRODUCT_COLUMNS.PRIORITY, name: 'Priority' },
      { index: PRODUCT_COLUMNS.UPH, name: 'UPH' },
      { index: PRODUCT_COLUMNS.SETUP_MINUTES, name: 'Setup Time' },
      { index: PRODUCT_COLUMNS.BALANCE_QUANTITY, name: 'Balance Quantity' },
      { index: PRODUCT_COLUMNS.SCHEDULED_START, name: 'Scheduled Start' },
      { index: PRODUCT_COLUMNS.SCHEDULED_END, name: 'Scheduled End' },
      { index: PRODUCT_COLUMNS.SCHEDULE_STATUS, name: 'Schedule Status' },
      { index: PRODUCT_COLUMNS.NOTES, name: 'Notes' },
    ],
  },
  [SHEET_NAMES.WORK_CENTERS]: {
    required: [
      { index: WORK_CENTER_COLUMNS.ID, name: 'ID' },
      { index: WORK_CENTER_COLUMNS.NAME, name: 'Name' },
    ],
    optional: [
      { index: WORK_CENTER_COLUMNS.TYPE, name: 'Type' },
      { index: WORK_CENTER_COLUMNS.ACTIVE, name: 'Active' },
      { index: WORK_CENTER_COLUMNS.EFFICIENCY_FACTOR, name: 'Efficiency Factor' },
      { index: WORK_CENTER_COLUMNS.MON_START, name: 'Mon Start' },
      { index: WORK_CENTER_COLUMNS.MON_END, name: 'Mon End' },
    ],
  },
  [SHEET_NAMES.HOLIDAYS]: {
    required: [
      { index: 0, name: 'Date' },
      { index: 1, name: 'Name' },
    ],
    optional: [
      { index: 2, name: 'Affected Work Centers' },
    ],
  },
  [SHEET_NAMES.SETTINGS]: {
    required: [
      { index: 0, name: 'Setting' },
      { index: 1, name: 'Value' },
    ],
    optional: [],
  },
};

export interface ValidationIssue {
  sheet: string;
  type: 'missing_sheet' | 'missing_required_column' | 'missing_optional_column' | 'empty_sheet';
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidateResponse {
  valid: boolean;
  canProceed: boolean; // true if only warnings (no errors)
  issues: ValidationIssue[];
  sheets: {
    name: string;
    found: boolean;
    hasHeaders: boolean;
    rowCount: number;
  }[];
}

// POST /api/config/google-sheets/validate - Validate spreadsheet structure
export const POST = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can validate configuration',
        },
      }, { status: 403 });
    }

    const body = await request.json();

    if (!body.spreadsheetId || !body.serviceAccountJson) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Spreadsheet ID and service account JSON are required',
        },
      }, { status: 400 });
    }

    const validation = validateServiceAccountJson(body.serviceAccountJson);
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: validation.error,
        },
      }, { status: 400 });
    }

    const client = createTestGoogleSheetsClient(body.spreadsheetId, body.serviceAccountJson);
    
    // Get spreadsheet info to see which sheets exist
    const info = await client.getSpreadsheetInfo();
    const existingSheets = new Set(info.sheets.map(s => s.toLowerCase()));
    
    const issues: ValidationIssue[] = [];
    const sheetResults: ValidateResponse['sheets'] = [];
    
    // Required sheets to check
    const requiredSheets = [
      SHEET_NAMES.PRODUCTS,
      SHEET_NAMES.WORK_CENTERS,
      SHEET_NAMES.HOLIDAYS,
      SHEET_NAMES.SETTINGS,
    ];

    for (const sheetName of requiredSheets) {
      const sheetExists = existingSheets.has(sheetName.toLowerCase());
      
      if (!sheetExists) {
        issues.push({
          sheet: sheetName,
          type: 'missing_sheet',
          message: `Required sheet "${sheetName}" not found`,
          severity: 'error',
        });
        sheetResults.push({
          name: sheetName,
          found: false,
          hasHeaders: false,
          rowCount: 0,
        });
        continue;
      }

      // Sheet exists, check its structure
      try {
        const data = await client.getSheetData(sheetName);
        const rowCount = data.length;
        const hasHeaders = rowCount > 0;
        const headerRow = data[0] || [];

        sheetResults.push({
          name: sheetName,
          found: true,
          hasHeaders,
          rowCount: Math.max(0, rowCount - 1), // Exclude header row
        });

        if (!hasHeaders) {
          issues.push({
            sheet: sheetName,
            type: 'empty_sheet',
            message: `Sheet "${sheetName}" is empty (no header row)`,
            severity: 'warning',
          });
          continue;
        }

        // Check for required and optional columns
        const expectedHeaders = EXPECTED_HEADERS[sheetName];
        if (expectedHeaders) {
          // Check required columns
          for (const col of expectedHeaders.required) {
            const headerValue = (headerRow[col.index] || '').toString().toLowerCase().trim();
            const expectedName = col.name.toLowerCase();
            
            // Flexible matching - check if the header contains the expected name or vice versa
            const matches = headerValue.includes(expectedName) || 
                           expectedName.includes(headerValue) ||
                           headerValue.replace(/[^a-z0-9]/g, '').includes(expectedName.replace(/[^a-z0-9]/g, ''));
            
            if (!headerValue) {
              issues.push({
                sheet: sheetName,
                type: 'missing_required_column',
                column: col.name,
                message: `Required column "${col.name}" not found in column ${String.fromCharCode(65 + col.index)}`,
                severity: 'error',
              });
            }
          }

          // Check optional columns (just warnings)
          for (const col of expectedHeaders.optional) {
            const headerValue = (headerRow[col.index] || '').toString().toLowerCase().trim();
            if (!headerValue) {
              issues.push({
                sheet: sheetName,
                type: 'missing_optional_column',
                column: col.name,
                message: `Optional column "${col.name}" not found - some features may be limited`,
                severity: 'warning',
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error reading sheet ${sheetName}:`, error);
        issues.push({
          sheet: sheetName,
          type: 'empty_sheet',
          message: `Could not read sheet "${sheetName}"`,
          severity: 'warning',
        });
        sheetResults.push({
          name: sheetName,
          found: true,
          hasHeaders: false,
          rowCount: 0,
        });
      }
    }

    // Determine if we can proceed (no errors, only warnings allowed)
    const hasErrors = issues.some(i => i.severity === 'error');
    
    const response: ValidateResponse = {
      valid: issues.length === 0,
      canProceed: !hasErrors,
      issues,
      sheets: sheetResults,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Failed to validate spreadsheet:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to validate spreadsheet',
      },
    }, { status: 500 });
  }
});
