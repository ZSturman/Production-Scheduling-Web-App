import { NextRequest, NextResponse } from 'next/server';
import { 
  withOrg,
  getGoogleSheetsConfig,
  getFirestore,
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
      
      configHistory = historySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          timestamp: data.changedAt || data.configuredAt,
          reason: data.reason,
        };
      });
    } catch (error) {
      // Ignore errors fetching additional config
      console.error('Error fetching sheet config:', error);
    }

    const response: GoogleSheetsConfigResponse = {
      config: config ? { 
        ...config,
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
