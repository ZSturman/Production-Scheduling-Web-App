import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  PriorityService,
} from '@/lib/server';

// POST /api/products/reorder - Batch reorder products
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

    const body = await request.json();
    const { workCenter, orderedJobNumbers } = body;

    if (!workCenter || !orderedJobNumbers || !Array.isArray(orderedJobNumbers)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'workCenter and orderedJobNumbers are required',
        },
      }, { status: 400 });
    }

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const priorityService = new PriorityService(sheetsClient);
    const updates = await priorityService.batchReorderPriorities(workCenter, orderedJobNumbers);

    return NextResponse.json({
      success: true,
      data: {
        updatedJobs: updates,
        triggerRecalculation: updates.length > 0,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to reorder products:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'REORDER_FAILED',
        message: 'Failed to reorder products',
      },
    }, { status: 500 });
  }
});
