import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  validateServiceAccountJson,
  saveGoogleSheetsConfig,
  saveServiceAccountCredentials,
  clearOrgServiceCache,
  createTestGoogleSheetsClient,
} from '@/lib/server';
import type { SaveGoogleSheetsConfigRequest } from '@/types';

// POST /api/config/google-sheets/save - Save Google Sheets configuration
export const POST = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can save configuration',
        },
      }, { status: 403 });
    }

    const body = await request.json() as SaveGoogleSheetsConfigRequest;

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

    // Test connection first
    const testClient = createTestGoogleSheetsClient(body.spreadsheetId, body.serviceAccountJson);
    let spreadsheetName = '';
    
    try {
      const connected = await testClient.testConnection();
      if (!connected) {
        throw new Error('Connection test failed');
      }
      const info = await testClient.getSpreadsheetInfo();
      spreadsheetName = info.title;
    } catch (connectionError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONNECTION_FAILED',
          message: connectionError instanceof Error 
            ? connectionError.message 
            : 'Failed to connect to spreadsheet',
        },
      }, { status: 400 });
    }

    // Save encrypted credentials
    const { email } = await saveServiceAccountCredentials(
      context.org!.orgId,
      body.serviceAccountJson,
      context.user.uid
    );

    // Save config (without credentials)
    await saveGoogleSheetsConfig(context.org!.orgId, {
      spreadsheetId: body.spreadsheetId,
      spreadsheetName,
      serviceAccountEmail: email,
      lastValidated: new Date().toISOString(),
      lastValidationError: null,
    });

    // Clear cached service
    clearOrgServiceCache(context.org!.orgId);

    return NextResponse.json({
      success: true,
      data: {
        spreadsheetId: body.spreadsheetId,
        spreadsheetName,
        serviceAccountEmail: email,
      },
    });
  } catch (error) {
    console.error('Failed to save Google Sheets config:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: 'Failed to save configuration',
      },
    }, { status: 500 });
  }
});
