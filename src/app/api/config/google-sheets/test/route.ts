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
      console.log('Testing connection with spreadsheet ID:', body.spreadsheetId);
      
      const connected = await testClient.testConnection();
      console.log('Connection test result:', connected);
      
      if (!connected) {
        throw new Error('Connection test failed');
      }

      console.log('Fetching spreadsheet info...');
      const info = await testClient.getSpreadsheetInfo();
      console.log('Spreadsheet info:', info);

      const response: TestGoogleSheetsResponse = {
        success: true,
        spreadsheetName: info.title,
        sheetNames: info.sheets,
      };

      return NextResponse.json({ success: true, data: response });
    } catch (connectionError) {
      console.error('Connection error details:', connectionError);
      
      // Extract detailed error information
      let errorMessage = 'Connection failed';
      let troubleshooting: string[] = [];
      
      if (connectionError instanceof Error) {
        const errorStr = connectionError.message.toLowerCase();
        
        // Check for API not enabled error (most common issue)
        if (errorStr.includes('api has not been used') || errorStr.includes('api is disabled')) {
          errorMessage = 'Google Sheets API is not enabled for this project.';
          troubleshooting = [
            '⚠️ You must enable the Google Sheets API in Google Cloud Console',
            'Go to: APIs & Services > Library',
            'Search for "Google Sheets API" and click Enable',
            'Wait 1-2 minutes for the API to activate, then try again',
            'Direct link: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview',
          ];
        } else if (errorStr.includes('permission') || errorStr.includes('forbidden') || errorStr.includes('403')) {
          errorMessage = 'Permission denied: The service account does not have access to this spreadsheet.';
          troubleshooting = [
            'Make sure you have shared the spreadsheet with the service account email',
            'Grant "Editor" permissions to the service account',
            'Verify the service account email matches the one in your JSON key file',
            'If you just enabled the Sheets API, wait 1-2 minutes and try again',
          ];
        } else if (errorStr.includes('not found') || errorStr.includes('404')) {
          errorMessage = 'Spreadsheet not found: The spreadsheet ID may be invalid or the spreadsheet was deleted.';
          troubleshooting = [
            'Check that the spreadsheet ID is correct',
            'Verify the spreadsheet exists and has not been deleted',
            'Make sure you copied the entire spreadsheet ID from the URL',
          ];
        } else if (errorStr.includes('auth') || errorStr.includes('credential') || errorStr.includes('401')) {
          errorMessage = 'Authentication failed: The service account credentials are invalid.';
          troubleshooting = [
            'Verify the service account JSON key file is valid and not corrupted',
            'Make sure the service account has not been deleted from Google Cloud Console',
            'Check that the JSON key file is in the correct format',
          ];
        } else if (errorStr.includes('rate') || errorStr.includes('quota') || errorStr.includes('429')) {
          errorMessage = 'Rate limit exceeded: Too many requests to Google Sheets API.';
          troubleshooting = [
            'Wait a few minutes and try again',
            'Check your Google Cloud project quota limits',
          ];
        } else {
          errorMessage = `Connection failed: ${connectionError.message}`;
          troubleshooting = [
            'Verify the spreadsheet ID is correct',
            'Ensure the service account JSON file is valid',
            'Make sure the spreadsheet is shared with the service account email',
            'Check that the spreadsheet has not been deleted',
          ];
        }
      }

      const errorResponse: TestGoogleSheetsResponse = {
        success: false,
        error: errorMessage,
        troubleshooting,
      };

      return NextResponse.json({ success: true, data: errorResponse });
    }
  } catch (error) {
    console.error('Failed to test Google Sheets connection:', error);
    
    const errorResponse: TestGoogleSheetsResponse = {
      success: false,
      error: 'Failed to test connection',
    };
    
    return NextResponse.json({ success: true, data: errorResponse });
  }
});
