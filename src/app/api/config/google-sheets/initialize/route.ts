import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  validateServiceAccountJson,
  createTestGoogleSheetsClient,
} from '@/lib/server';

export interface InitializeSheetsRequest {
  spreadsheetId: string;
  serviceAccountJson: string;
}

export interface InitializeSheetsResponse {
  success: boolean;
  created?: string[];
  errors?: string[];
  message?: string;
}

// POST /api/config/google-sheets/initialize - Initialize required sheets with headers and default data
export const POST = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can initialize sheets',
        },
      }, { status: 403 });
    }

    const body = await request.json() as InitializeSheetsRequest;

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
      // First verify connection
      const connected = await testClient.testConnection();
      if (!connected) {
        throw new Error('Connection test failed. Please verify spreadsheet ID and permissions.');
      }

      // Initialize all sheets
      const result = await testClient.initializeAllSheets();

      const response: InitializeSheetsResponse = {
        success: result.errors.length === 0,
        created: result.created,
        errors: result.errors,
        message: result.errors.length === 0 
          ? `Successfully initialized ${result.created.length} sheet(s) with headers and default data`
          : `Initialized with some errors. Created: ${result.created.length}, Errors: ${result.errors.length}`,
      };

      return NextResponse.json({ success: true, data: response });
    } catch (initError) {
      let errorMessage = 'Failed to initialize sheets';
      let troubleshooting: string[] = [];
      
      if (initError instanceof Error) {
        const errorStr = initError.message.toLowerCase();
        
        if (errorStr.includes('permission') || errorStr.includes('forbidden') || errorStr.includes('403')) {
          errorMessage = 'Permission denied: The service account needs Editor access to create and modify sheets.';
          troubleshooting = [
            'Make sure the service account has "Editor" permissions (not just "Viewer")',
            'Verify you shared the spreadsheet with the correct service account email',
          ];
        } else {
          errorMessage = `Failed to initialize sheets: ${initError.message}`;
          troubleshooting = [
            'Ensure the service account has Editor permissions',
            'Check that the spreadsheet is not restricted or locked',
            'Verify your Google Cloud project has the Sheets API enabled',
          ];
        }
      }

      return NextResponse.json({
        success: false,
        error: {
          code: 'INITIALIZATION_FAILED',
          message: errorMessage,
          troubleshooting,
        },
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to initialize sheets:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INITIALIZATION_FAILED',
        message: 'Failed to initialize sheets',
      },
    }, { status: 500 });
  }
});
