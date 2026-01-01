import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  validateServiceAccountJson,
  createTestGoogleSheetsClient,
} from '@/lib/server';
import type { TestGoogleSheetsRequest, TestGoogleSheetsResponse } from '@/types';

// POST /api/config/google-sheets/test - Test Google Sheets connection
export const POST = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can test configuration',
        },
      }, { status: 403 });
    }

    const body = await request.json() as TestGoogleSheetsRequest;

    if (!body.spreadsheetId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_SPREADSHEET_ID',
          message: 'Spreadsheet ID is required',
        },
      }, { status: 400 });
    }

    if (!body.serviceAccountJson) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Service account JSON is required',
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

    const testClient = createTestGoogleSheetsClient(body.spreadsheetId, body.serviceAccountJson);

    try {
      const connected = await testClient.testConnection();
      if (!connected) {
        throw new Error('Connection test failed');
      }

      const info = await testClient.getSpreadsheetInfo();

      const response: TestGoogleSheetsResponse = {
        success: true,
        spreadsheetName: info.title,
        sheetNames: info.sheets,
      };

      return NextResponse.json({ success: true, data: response });
    } catch (connectionError) {
      const response: TestGoogleSheetsResponse = {
        success: false,
        error: connectionError instanceof Error 
          ? connectionError.message 
          : 'Connection failed. Check your spreadsheet ID and service account permissions.',
      };

      return NextResponse.json({ success: true, data: response });
    }
  } catch (error) {
    console.error('Failed to test Google Sheets connection:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'TEST_FAILED',
        message: 'Failed to test connection',
      },
    }, { status: 500 });
  }
});
