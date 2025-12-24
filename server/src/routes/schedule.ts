import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { schedulingEngine } from '../services/schedulingEngine';
import { googleSheetsService } from '../services/googleSheets';
import { createModuleLogger } from '../utils/logger';
import {
  GanttData,
  GanttTask,
  GanttFilters,
  RecalculateResponse,
  ApiResponse,
  DEFAULT_SETTINGS,
} from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('schedule-route');

/**
 * POST /api/schedule/recalculate
 * Trigger full schedule recalculation
 */
router.post(
  '/recalculate',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Schedule recalculation triggered', { userId: req.user?.uid });

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
        errors: result.errors.map((e) => e.message),
      },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * GET /api/schedule/gantt
 * Get Gantt chart data
 */
router.get(
  '/gantt',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const filters: GanttFilters = {
      workCenters: req.query.workCenters 
        ? (req.query.workCenters as string).split(',') 
        : undefined,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      showLocked: req.query.showLocked !== 'false',
      status: req.query.status
        ? (req.query.status as string).split(',') as GanttFilters['status']
        : undefined,
    };

    // Load data
    const [products, workCenters] = await Promise.all([
      googleSheetsService.getAllProducts(),
      googleSheetsService.getAllWorkCenters(),
    ]);

    // Build Gantt data grouped by work center
    const ganttWorkCenters: GanttData['workCenters'] = [];
    let minDate = '';
    let maxDate = '';
    let lockedAffected = 0;

    for (const wc of workCenters.filter((w) => w.active)) {
      // Filter by work center if specified
      if (filters.workCenters && !filters.workCenters.includes(wc.id)) {
        continue;
      }

      const wcProducts = products.filter(
        (p) => (p.workCenter === wc.id || p.workCenter === wc.name) &&
               p.scheduledStart && p.scheduledEnd
      );

      // Apply filters
      let filteredProducts = wcProducts;

      if (!filters.showLocked) {
        filteredProducts = filteredProducts.filter((p) => !p.scheduleLocked);
      }

      if (filters.startDate) {
        filteredProducts = filteredProducts.filter(
          (p) => p.scheduledStart! >= filters.startDate!
        );
      }

      if (filters.endDate) {
        filteredProducts = filteredProducts.filter(
          (p) => p.scheduledEnd! <= filters.endDate!
        );
      }

      if (filters.status) {
        filteredProducts = filteredProducts.filter(
          (p) => filters.status!.includes(p.scheduleStatus)
        );
      }

      // Sort by priority
      filteredProducts.sort((a, b) => a.priority - b.priority);

      // Convert to Gantt tasks
      const tasks: GanttTask[] = filteredProducts.map((p) => {
        // Calculate progress based on completed vs total quantity
        const progress = p.quantity > 0
          ? Math.round(((p.quantity - p.balanceQuantity) / p.quantity) * 100)
          : 0;

        // Calculate total hours
        const setupHours = p.setupMinutes / 60;
        const productionHours = p.uph > 0 ? p.balanceQuantity / p.uph : 0;

        // Track min/max dates
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

    // Default date range if no data
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

    res.json(response);
  })
);

/**
 * GET /api/schedule/summary
 * Get schedule summary statistics
 */
router.get(
  '/summary',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const products = await googleSheetsService.getAllProducts();
    const workCenters = await googleSheetsService.getAllWorkCenters();

    const scheduled = products.filter((p) => p.scheduledStart && p.scheduledEnd);
    const unscheduled = products.filter((p) => !p.scheduledStart || !p.scheduledEnd);
    const locked = products.filter((p) => p.scheduleLocked);

    const onTime = scheduled.filter((p) => p.scheduleStatus === 'On-Time').length;
    const atRisk = scheduled.filter((p) => p.scheduleStatus === 'At-Risk').length;
    const late = scheduled.filter((p) => p.scheduleStatus === 'Late').length;

    // Work center breakdown
    const wcSummary = workCenters
      .filter((wc) => wc.active)
      .map((wc) => {
        const wcProducts = products.filter(
          (p) => p.workCenter === wc.id || p.workCenter === wc.name
        );
        return {
          id: wc.id,
          name: wc.name,
          totalJobs: wcProducts.length,
          scheduledJobs: wcProducts.filter((p) => p.scheduledStart).length,
          lockedJobs: wcProducts.filter((p) => p.scheduleLocked).length,
        };
      });

    const response: ApiResponse<{
      totalProducts: number;
      scheduledProducts: number;
      unscheduledProducts: number;
      lockedProducts: number;
      onTime: number;
      atRisk: number;
      late: number;
      workCenters: typeof wcSummary;
    }> = {
      success: true,
      data: {
        totalProducts: products.length,
        scheduledProducts: scheduled.length,
        unscheduledProducts: unscheduled.length,
        lockedProducts: locked.length,
        onTime,
        atRisk,
        late,
        workCenters: wcSummary,
      },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

export default router;
