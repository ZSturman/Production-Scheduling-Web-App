import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  getGoogleSheetsConfig,
  getFirestore,
  getServiceAccountCredentials,
  saveGoogleSheetsConfig,
  clearOrgServiceCache,
  createTestGoogleSheetsClient,
} from '@/lib/server';
import type { GoogleSheetsConfigResponse } from '@/types';

// GET /api/config/google-sheets - Get Google Sheets config
export const GET = withOrg(async (request, context) => {
  try {
    const orgId = context.org!.orgId;
    const config = await getGoogleSheetsConfig(orgId);
    
    // Also fetch current sheet configuration and history
    let sheetConfig = null;
    let configHistory: { timestamp: string; reason?: string }[] = [];
    
    try {
      const db = getFirestore();
      
      // Get current sheet config
      const currentConfigDoc = await db
        .collection('organizations')
        .doc(orgId)
        .collection('sheetsConfig')
        .doc('current')
        .get();
      
      if (currentConfigDoc.exists) {
        const data = currentConfigDoc.data();
        sheetConfig = {
          templateId: data?.templateId,
          sheetNames: data?.sheets?.reduce((acc: Record<string, string>, s: { key: string; name: string }) => {
            acc[s.key] = s.name;
            return acc;
          }, {}),
          lastUpdated: data?.configuredAt,
        };
      }
      
      // Get configuration history
      const historySnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('sheetsConfigHistory')
        .orderBy('changedAt', 'desc')
        .limit(10)
        .get();
      
      interface HistoryDocData {
        changedAt?: string;
        configuredAt?: string;
        reason?: string;
      }
      
      const historyItems: { timestamp: string; reason?: string }[] = [];
      historySnapshot.docs.forEach((doc: { data: () => HistoryDocData }) => {
        const data = doc.data();
        const timestamp = data.changedAt || data.configuredAt;
        if (timestamp) {
          historyItems.push({ timestamp, reason: data.reason });
        }
      });
      configHistory = historyItems;
    } catch (error) {
      // Ignore errors fetching additional config
      console.error('Error fetching sheet config:', error);
    }

    const response: GoogleSheetsConfigResponse = {
      config: config ? { 
        ...config,
        templateId: sheetConfig?.templateId,
        sheetNames: sheetConfig?.sheetNames,
        lastUpdated: sheetConfig?.lastUpdated,
        configHistory,
      } : null,
      requiresSetup: !config || !config.configured,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Failed to get Google Sheets config:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_CONFIG_FAILED',
        message: 'Failed to get configuration',
      },
    }, { status: 500 });
  }
});

// PATCH /api/config/google-sheets - Update spreadsheet ID (uses existing credentials)
export const PATCH = withOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can update configuration',
        },
      }, { status: 403 });
    }

    const orgId = context.org!.orgId;
    const body = await request.json();
    const { spreadsheetId } = body;

    if (!spreadsheetId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'MISSING_SPREADSHEET_ID',
          message: 'Spreadsheet ID is required',
        },
      }, { status: 400 });
    }

    // Validate spreadsheet ID format
    if (typeof spreadsheetId !== 'string' || spreadsheetId.length < 10) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_SPREADSHEET_ID',
          message: 'Invalid spreadsheet ID format',
        },
      }, { status: 400 });
    }

    // Get existing service account credentials
    const serviceAccountJson = await getServiceAccountCredentials(orgId);
    if (!serviceAccountJson) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_CREDENTIALS',
          message: 'No service account credentials found. Please reconfigure Google Sheets.',
        },
      }, { status: 400 });
    }

    // Get existing config
    const existingConfig = await getGoogleSheetsConfig(orgId);
    if (!existingConfig) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NO_CONFIG',
          message: 'No existing configuration found. Please set up Google Sheets first.',
        },
      }, { status: 400 });
    }

    // Test connection with new spreadsheet ID
    const testClient = createTestGoogleSheetsClient(spreadsheetId, serviceAccountJson);
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
            : 'Failed to connect to the new spreadsheet. Make sure the service account has access.',
        },
      }, { status: 400 });
    }

    // Save updated config
    await saveGoogleSheetsConfig(orgId, {
      spreadsheetId,
      spreadsheetName,
      serviceAccountEmail: existingConfig.serviceAccountEmail,
      lastValidated: new Date().toISOString(),
      lastValidationError: null,
    });

    // Clear cached service so it reconnects with new spreadsheet
    clearOrgServiceCache(orgId);

    return NextResponse.json({
      success: true,
      data: {
        spreadsheetId,
        spreadsheetName,
        message: 'Spreadsheet ID updated successfully',
      },
    });
  } catch (error) {
    console.error('Failed to update spreadsheet ID:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_FAILED',
        message: 'Failed to update spreadsheet ID',
      },
    }, { status: 500 });
  }
});
