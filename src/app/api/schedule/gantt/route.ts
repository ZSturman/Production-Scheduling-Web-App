import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
} from '@/lib/server';
import type { GanttData, GanttTask, GanttFilters, ApiResponse } from '@/types';

// GET /api/schedule/gantt - Get Gantt chart data
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: GanttFilters = {
      workCenters: searchParams.get('workCenters')?.split(',') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      showLocked: searchParams.get('showLocked') !== 'false',
      status: searchParams.get('status')?.split(',') as GanttFilters['status'] || undefined,
    };

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const [products, workCenters] = await Promise.all([
      sheetsClient.getAllProducts(),
      sheetsClient.getAllWorkCenters(),
    ]);

    const ganttWorkCenters: GanttData['workCenters'] = [];
    let minDate = '';
    let maxDate = '';
    let lockedAffected = 0;

    for (const wc of workCenters.filter(w => w.active)) {
      if (filters.workCenters && !filters.workCenters.includes(wc.id)) {
        continue;
      }

      let wcProducts = products.filter(
        p => (p.workCenter === wc.id || p.workCenter === wc.name) &&
             p.scheduledStart && p.scheduledEnd
      );

      if (!filters.showLocked) {
        wcProducts = wcProducts.filter(p => !p.scheduleLocked);
      }
      if (filters.startDate) {
        wcProducts = wcProducts.filter(p => p.scheduledStart! >= filters.startDate!);
      }
      if (filters.endDate) {
        wcProducts = wcProducts.filter(p => p.scheduledEnd! <= filters.endDate!);
      }
      if (filters.status) {
        wcProducts = wcProducts.filter(p => filters.status!.includes(p.scheduleStatus));
      }

      wcProducts.sort((a, b) => a.priority - b.priority);

      const tasks: GanttTask[] = wcProducts.map(p => {
        const progress = p.quantity > 0
          ? Math.round(((p.quantity - p.balanceQuantity) / p.quantity) * 100)
          : 0;

        const setupHours = p.setupMinutes / 60;
        const productionHours = p.uph > 0 ? p.balanceQuantity / p.uph : 0;

        if (!minDate || p.scheduledStart! < minDate) minDate = p.scheduledStart!;
        if (!maxDate || p.scheduledEnd! > maxDate) maxDate = p.scheduledEnd!;

        if (p.scheduleLocked) lockedAffected++;

        return {
          id: p.jobNumber,
          name: `${p.customer} - ${p.productText}`.substring(0, 50),
          start: p.scheduledStart!.split('T')[0],
          end: p.scheduledEnd!.split('T')[0],
          progress,
          workCenter: wc.id,
          workCenterName: wc.name,
          priority: p.priority,
          status: p.scheduleStatus,
          dueDate: p.requestedShipDate,
          isLocked: p.scheduleLocked,
          lockReason: p.lockReason,
          customer: p.customer,
          productText: p.productText,
          quantity: p.quantity,
          balanceQuantity: p.balanceQuantity,
          totalHours: Math.ceil(setupHours + productionHours),
        };
      });

      if (tasks.length > 0) {
        ganttWorkCenters.push({
          id: wc.id,
          name: wc.name,
          tasks,
        });
      }
    }

    if (!minDate) {
      minDate = new Date().toISOString().split('T')[0];
    }
    if (!maxDate) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);
      maxDate = futureDate.toISOString().split('T')[0];
    }

    const ganttData: GanttData = {
      workCenters: ganttWorkCenters,
      startDate: minDate,
      endDate: maxDate,
      totalTasks: ganttWorkCenters.reduce((sum, wc) => sum + wc.tasks.length, 0),
      lockedTasksAffected: lockedAffected,
    };

    const response: ApiResponse<GanttData> = {
      success: true,
      data: ganttData,
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get Gantt data:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_GANTT_FAILED',
        message: 'Failed to get Gantt data',
      },
    }, { status: 500 });
  }
});
