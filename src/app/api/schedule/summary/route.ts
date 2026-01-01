import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
} from '@/lib/server';
import type { ApiResponse } from '@/types';

interface ScheduleSummary {
  totalProducts: number;
  scheduledProducts: number;
  unscheduledProducts: number;
  lockedProducts: number;
  onTime: number;
  atRisk: number;
  late: number;
  workCenters: {
    id: string;
    name: string;
    totalJobs: number;
    scheduledJobs: number;
    lockedJobs: number;
  }[];
}

// GET /api/schedule/summary - Get schedule summary
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const [products, workCenters] = await Promise.all([
      sheetsClient.getAllProducts(),
      sheetsClient.getAllWorkCenters(),
    ]);

    const scheduledProducts = products.filter(p => p.scheduledStart && p.scheduledEnd);
    const lockedProducts = products.filter(p => p.scheduleLocked);
    const onTimeProducts = products.filter(p => p.scheduleStatus === 'On-Time');
    const atRiskProducts = products.filter(p => p.scheduleStatus === 'At-Risk');
    const lateProducts = products.filter(p => p.scheduleStatus === 'Late');

    const wcSummary = workCenters
      .filter(wc => wc.active)
      .map(wc => {
        const wcProducts = products.filter(p => p.workCenter === wc.id || p.workCenter === wc.name);
        const scheduled = wcProducts.filter(p => p.scheduledStart && p.scheduledEnd);
        const locked = wcProducts.filter(p => p.scheduleLocked);
        return {
          id: wc.id,
          name: wc.name,
          totalJobs: wcProducts.length,
          scheduledJobs: scheduled.length,
          lockedJobs: locked.length,
        };
      });

    const summary: ScheduleSummary = {
      totalProducts: products.length,
      scheduledProducts: scheduledProducts.length,
      unscheduledProducts: products.length - scheduledProducts.length,
      lockedProducts: lockedProducts.length,
      onTime: onTimeProducts.length,
      atRisk: atRiskProducts.length,
      late: lateProducts.length,
      workCenters: wcSummary,
    };

    const response: ApiResponse<ScheduleSummary> = {
      success: true,
      data: summary,
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get schedule summary:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_SUMMARY_FAILED',
        message: 'Failed to get schedule summary',
      },
    }, { status: 500 });
  }
});
