import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
} from '@/lib/server';

// GET /api/sync/status - Get sync status
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    return NextResponse.json({
      success: true,
      data: {
        lastSyncTimestamp: new Date().toISOString(),
        syncInProgress: false,
        pendingChanges: 0,
        errors: [],
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to get sync status:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_SYNC_STATUS_FAILED',
        message: 'Failed to get sync status',
      },
    }, { status: 500 });
  }
});
