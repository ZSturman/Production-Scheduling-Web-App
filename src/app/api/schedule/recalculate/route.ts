import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SchedulingEngine,
} from '@/lib/server';
import type { RecalculateResponse, ApiResponse } from '@/types';

// POST /api/schedule/recalculate - Trigger schedule recalculation
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

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const schedulingEngine = new SchedulingEngine(sheetsClient);
    const result = await schedulingEngine.calculateSchedules();

    const response: ApiResponse<RecalculateResponse> = {
      success: true,
      data: {
        success: result.success,
        timestamp: result.timestamp,
        jobsScheduled: result.scheduledJobs,
        lockedJobsAffected: result.lockedJobsAffected,
        onTimeCount: result.onTimeCount,
        atRiskCount: result.atRiskCount,
        lateCount: result.lateCount,
        errors: result.errors.map(e => e.message),
      },
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to recalculate schedule:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'RECALCULATE_FAILED',
        message: 'Failed to recalculate schedule',
      },
    }, { status: 500 });
  }
});
