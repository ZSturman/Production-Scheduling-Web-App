import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  getGoogleSheetsConfig,
} from '@/lib/server';
import type { GoogleSheetsConfigResponse } from '@/types';

// GET /api/config/google-sheets - Get Google Sheets config
export const GET = withOrg(async (request, context) => {
  try {
    const config = await getGoogleSheetsConfig(context.org!.orgId);

    const response: GoogleSheetsConfigResponse = {
      config: config ? { ...config } : null,
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
