import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SchedulingEngine,
} from '@/lib/server';

// POST /api/sync/trigger - Trigger a sync
export const POST = withConfiguredOrg(async (request, context) => {
  try {
    if (!['planner', 'admin'].includes(context.user.role)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const recalculate = searchParams.get('recalculate') === 'true';

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    
    let recalculateResult = null;
    if (recalculate) {
      const schedulingEngine = new SchedulingEngine(sheetsClient);
      recalculateResult = await schedulingEngine.calculateSchedules();
    }

    return NextResponse.json({
      success: true,
      data: {
        synced: true,
        timestamp: new Date().toISOString(),
        recalculated: recalculate,
        recalculateResult: recalculateResult ? {
          success: recalculateResult.success,
          jobsScheduled: recalculateResult.scheduledJobs,
        } : null,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to trigger sync:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'SYNC_FAILED',
        message: 'Failed to trigger sync',
      },
    }, { status: 500 });
  }
});
