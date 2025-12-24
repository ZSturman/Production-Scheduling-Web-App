import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { googleSheetsService, SHEET_NAMES } from '../services/googleSheets';
import { createModuleLogger } from '../utils/logger';
import {
  WorkCenter,
  CreateWorkCenterInput,
  UpdateWorkCenterInput,
  DEFAULT_WEEKLY_SCHEDULE,
  ApiResponse,
} from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('work-centers-route');

/**
 * GET /api/work-centers
 * List all work centers
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const includeInactive = req.query.includeInactive === 'true';
    
    let workCenters = await googleSheetsService.getAllWorkCenters();
    
    if (!includeInactive) {
      workCenters = workCenters.filter((wc) => wc.active);
    }

    // Get job counts per work center
    const products = await googleSheetsService.getAllProducts();
    const workCentersWithCounts = workCenters.map((wc) => {
      const wcProducts = products.filter(
        (p) => p.workCenter === wc.id || p.workCenter === wc.name
      );
      return {
        ...wc,
        jobCount: wcProducts.length,
        lockedJobCount: wcProducts.filter((p) => p.scheduleLocked).length,
      };
    });

    const response: ApiResponse<{ workCenters: typeof workCentersWithCounts }> = {
      success: true,
      data: { workCenters: workCentersWithCounts },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * GET /api/work-centers/:id
 * Get a single work center
 */
router.get(
  '/:id',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const workCenters = await googleSheetsService.getAllWorkCenters();
    const workCenter = workCenters.find((wc) => wc.id === id);

    if (!workCenter) {
      throw new NotFoundError('Work Center', id);
    }

    // Get products for this work center
    const products = await googleSheetsService.getAllProducts();
    const wcProducts = products.filter(
      (p) => p.workCenter === workCenter.id || p.workCenter === workCenter.name
    );

    const response: ApiResponse<{ workCenter: WorkCenter; jobCount: number }> = {
      success: true,
      data: {
        workCenter,
        jobCount: wcProducts.length,
      },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/work-centers
 * Create a new work center
 */
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const input: CreateWorkCenterInput = req.body;

    if (!input.id || !input.name) {
      throw new ValidationError('ID and name are required');
    }

    // Check for duplicate
    const existingWCs = await googleSheetsService.getAllWorkCenters();
    if (existingWCs.some((wc) => wc.id === input.id)) {
      throw new ValidationError(`Work center ID ${input.id} already exists`);
    }

    const workCenter: WorkCenter = {
      id: input.id,
      name: input.name,
      type: input.type || 'Other',
      active: input.active !== false,
      efficiencyFactor: input.efficiencyFactor || 1.0,
      schedule: input.schedule || DEFAULT_WEEKLY_SCHEDULE,
      rowIndex: -1, // Will be set after append
    };

    const row = googleSheetsService.workCenterToRow(workCenter);
    const rowIndex = await googleSheetsService.appendRow(SHEET_NAMES.WORK_CENTERS, row);
    workCenter.rowIndex = rowIndex;

    logger.info('Created work center', { id: input.id, name: input.name });

    const response: ApiResponse<WorkCenter> = {
      success: true,
      data: workCenter,
      meta: { timestamp: new Date().toISOString() },
    };

    res.status(201).json(response);
  })
);

/**
 * PATCH /api/work-centers/:id
 * Update a work center
 */
router.patch(
  '/:id',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const input: UpdateWorkCenterInput = req.body;

    const workCenters = await googleSheetsService.getAllWorkCenters();
    const workCenter = workCenters.find((wc) => wc.id === id);

    if (!workCenter) {
      throw new NotFoundError('Work Center', id);
    }

    // Update fields
    if (input.name !== undefined) workCenter.name = input.name;
    if (input.type !== undefined) workCenter.type = input.type;
    if (input.active !== undefined) workCenter.active = input.active;
    if (input.efficiencyFactor !== undefined) workCenter.efficiencyFactor = input.efficiencyFactor;
    if (input.schedule) {
      workCenter.schedule = { ...workCenter.schedule, ...input.schedule };
    }

    // Update in sheet
    const row = googleSheetsService.workCenterToRow(workCenter);
    await googleSheetsService.updateSheetData(
      `${SHEET_NAMES.WORK_CENTERS}!A${workCenter.rowIndex}:S${workCenter.rowIndex}`,
      [row]
    );

    logger.info('Updated work center', { id, changes: Object.keys(input) });

    const response: ApiResponse<WorkCenter> = {
      success: true,
      data: workCenter,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * GET /api/work-centers/:id/jobs
 * Get all jobs for a work center, sorted by priority
 */
router.get(
  '/:id/jobs',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    const workCenters = await googleSheetsService.getAllWorkCenters();
    const workCenter = workCenters.find((wc) => wc.id === id);

    if (!workCenter) {
      throw new NotFoundError('Work Center', id);
    }

    const products = await googleSheetsService.getAllProducts();
    const wcProducts = products
      .filter((p) => p.workCenter === workCenter.id || p.workCenter === workCenter.name)
      .sort((a, b) => a.priority - b.priority);

    const response: ApiResponse<{ jobs: typeof wcProducts; workCenter: WorkCenter }> = {
      success: true,
      data: { jobs: wcProducts, workCenter },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

export default router;
