import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { WorkCenter, CreateWorkCenterInput, ApiResponse } from '@/types';
import { DEFAULT_WEEKLY_SCHEDULE } from '@/types/workCenter';

// GET /api/work-centers - List all work centers
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    let workCenters = await sheetsClient.getAllWorkCenters();

    if (!includeInactive) {
      workCenters = workCenters.filter(wc => wc.active);
    }

    // Get job counts per work center
    const products = await sheetsClient.getAllProducts();
    const workCentersWithCounts = workCenters.map(wc => {
      const wcProducts = products.filter(p => p.workCenter === wc.id || p.workCenter === wc.name);
      return {
        ...wc,
        jobCount: wcProducts.length,
        lockedJobCount: wcProducts.filter(p => p.scheduleLocked).length,
      };
    });

    const response: ApiResponse<{ workCenters: typeof workCentersWithCounts }> = {
      success: true,
      data: { workCenters: workCentersWithCounts },
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get work centers:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_WORK_CENTERS_FAILED',
        message: 'Failed to get work centers',
      },
    }, { status: 500 });
  }
});

// POST /api/work-centers - Create a new work center
export const POST = withConfiguredOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can create work centers',
        },
      }, { status: 403 });
    }

    const input = await request.json() as CreateWorkCenterInput;

    if (!input.id || !input.name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'ID and name are required',
        },
      }, { status: 400 });
    }

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const existingWCs = await sheetsClient.getAllWorkCenters();

    if (existingWCs.some(wc => wc.id === input.id)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'DUPLICATE_ID',
          message: `Work center ID ${input.id} already exists`,
        },
      }, { status: 400 });
    }

    const workCenter: WorkCenter = {
      id: input.id,
      name: input.name,
      type: input.type || 'Other',
      active: input.active !== false,
      efficiencyFactor: input.efficiencyFactor || 1.0,
      schedule: input.schedule || DEFAULT_WEEKLY_SCHEDULE,
      rowIndex: -1,
    };

    const row = sheetsClient.workCenterToRow(workCenter);
    const rowIndex = await sheetsClient.appendRow(SHEET_NAMES.WORK_CENTERS, row);
    workCenter.rowIndex = rowIndex;

    return NextResponse.json({
      success: true,
      data: workCenter,
      meta: { timestamp: new Date().toISOString() },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create work center:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_WORK_CENTER_FAILED',
        message: 'Failed to create work center',
      },
    }, { status: 500 });
  }
});
