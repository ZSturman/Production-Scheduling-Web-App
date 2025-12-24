import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { googleSheetsService } from '../services/googleSheets';
import { schedulingEngine } from '../services/schedulingEngine';
import { createModuleLogger } from '../utils/logger';
import { SyncStatusResponse, ApiResponse } from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('sync-route');

// Track sync state
let lastSyncTimestamp: string | null = null;
let syncInProgress = false;

/**
 * GET /api/sync/status
 * Get current sync status
 */
router.get(
  '/status',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const response: ApiResponse<SyncStatusResponse> = {
      success: true,
      data: {
        lastSyncTimestamp,
        syncInProgress,
        pendingChanges: 0, // Could implement change tracking
        errors: [],
      },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/sync/trigger
 * Trigger a manual sync (or called by Cloud Scheduler)
 */
router.post(
  '/trigger',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    if (syncInProgress) {
      res.json({
        success: true,
        data: { message: 'Sync already in progress', skipped: true },
        meta: { timestamp: new Date().toISOString() },
      });
      return;
    }

    syncInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Sync triggered', { userId: req.user?.uid });

      // For now, sync just means refreshing data from sheets
      // and optionally recalculating schedules
      const recalculate = req.query.recalculate === 'true';

      if (recalculate) {
        await schedulingEngine.calculateSchedules();
      }

      lastSyncTimestamp = new Date().toISOString();
      const duration = Date.now() - startTime;

      logger.info('Sync completed', { duration: `${duration}ms`, recalculate });

      const response: ApiResponse<{ synced: boolean; recalculated: boolean; duration: number }> = {
        success: true,
        data: {
          synced: true,
          recalculated: recalculate,
          duration,
        },
        meta: { timestamp: lastSyncTimestamp },
      };

      res.json(response);
    } catch (error) {
      logger.error('Sync failed', { error });
      throw error;
    } finally {
      syncInProgress = false;
    }
  })
);

/**
 * POST /api/sync/refresh
 * Force refresh all data from Google Sheets
 */
router.post(
  '/refresh',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    logger.info('Manual refresh triggered', { userId: req.user?.uid });

    // Load fresh data
    const [products, workCenters] = await Promise.all([
      googleSheetsService.getAllProducts(),
      googleSheetsService.getAllWorkCenters(),
    ]);

    lastSyncTimestamp = new Date().toISOString();

    const response: ApiResponse<{
      refreshed: boolean;
      products: number;
      workCenters: number;
    }> = {
      success: true,
      data: {
        refreshed: true,
        products: products.length,
        workCenters: workCenters.length,
      },
      meta: { timestamp: lastSyncTimestamp },
    };

    res.json(response);
  })
);

export default router;
