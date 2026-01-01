import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { WorkCenter, UpdateWorkCenterInput, ApiResponse } from '@/types';

// GET /api/work-centers/[id] - Get a single work center
export const GET = withConfiguredOrg(async (
  request: NextRequest,
  context,
  params?: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await (params?.params || Promise.resolve({ id: '' }));

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const workCenters = await sheetsClient.getAllWorkCenters();
    const workCenter = workCenters.find(wc => wc.id === id);

    if (!workCenter) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Work center ${id} not found`,
        },
      }, { status: 404 });
    }

    // Get job counts
    const products = await sheetsClient.getAllProducts();
    const wcProducts = products.filter(p => p.workCenter === workCenter.id || p.workCenter === workCenter.name);

    const response: ApiResponse<WorkCenter & { jobCount: number; lockedJobCount: number }> = {
      success: true,
      data: {
        ...workCenter,
        jobCount: wcProducts.length,
        lockedJobCount: wcProducts.filter(p => p.scheduleLocked).length,
      },
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get work center:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_WORK_CENTER_FAILED',
        message: 'Failed to get work center',
      },
    }, { status: 500 });
  }
});

// PATCH /api/work-centers/[id] - Update a work center
export const PATCH = withConfiguredOrg(async (
  request: NextRequest,
  context,
  params?: { params: Promise<{ id: string }> }
) => {
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

    const { id } = await (params?.params || Promise.resolve({ id: '' }));
    const input = await request.json() as UpdateWorkCenterInput;

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const workCenters = await sheetsClient.getAllWorkCenters();
    const workCenter = workCenters.find(wc => wc.id === id);

    if (!workCenter) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Work center ${id} not found`,
        },
      }, { status: 404 });
    }

    // Merge updates
    const updatedWC: WorkCenter = {
      ...workCenter,
      name: input.name ?? workCenter.name,
      type: input.type ?? workCenter.type,
      active: input.active ?? workCenter.active,
      efficiencyFactor: input.efficiencyFactor ?? workCenter.efficiencyFactor,
      schedule: input.schedule ? { ...workCenter.schedule, ...input.schedule } : workCenter.schedule,
    };

    // Convert back to row format and update
    const row = sheetsClient.workCenterToRow(updatedWC);
    await sheetsClient.updateSheetData(
      `${SHEET_NAMES.WORK_CENTERS}!A${workCenter.rowIndex}:Z${workCenter.rowIndex}`,
      [row]
    );

    return NextResponse.json({
      success: true,
      data: updatedWC,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to update work center:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_WORK_CENTER_FAILED',
        message: 'Failed to update work center',
      },
    }, { status: 500 });
  }
});
