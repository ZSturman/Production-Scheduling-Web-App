import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { googleSheetsService, SHEET_NAMES } from '../services/googleSheets';
import { priorityService } from '../services/priorityService';
import { createModuleLogger } from '../utils/logger';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
  ApiResponse,
} from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('products-route');

/**
 * GET /api/products
 * List all products with optional filtering
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const filters: ProductFilters = {
      workCenter: req.query.workCenter as string,
      scheduleStatus: req.query.scheduleStatus as ProductFilters['scheduleStatus'],
      scheduleLocked: req.query.scheduleLocked === 'true' ? true : req.query.scheduleLocked === 'false' ? false : undefined,
      search: req.query.search as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
    };

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 100;

    let products = await googleSheetsService.getAllProducts();

    // Apply filters
    if (filters.workCenter) {
      products = products.filter(
        (p) => p.workCenter === filters.workCenter || p.workCenter === filters.workCenter
      );
    }
    if (filters.scheduleStatus) {
      products = products.filter((p) => p.scheduleStatus === filters.scheduleStatus);
    }
    if (filters.scheduleLocked !== undefined) {
      products = products.filter((p) => p.scheduleLocked === filters.scheduleLocked);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      products = products.filter(
        (p) =>
          p.jobNumber.toLowerCase().includes(searchLower) ||
          p.customer.toLowerCase().includes(searchLower) ||
          p.productText.toLowerCase().includes(searchLower)
      );
    }
    if (filters.startDate) {
      products = products.filter(
        (p) => p.scheduledStart && p.scheduledStart >= filters.startDate!
      );
    }
    if (filters.endDate) {
      products = products.filter(
        (p) => p.scheduledEnd && p.scheduledEnd <= filters.endDate!
      );
    }

    // Paginate
    const total = products.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedProducts = products.slice(startIndex, startIndex + pageSize);

    const response: ApiResponse<{ products: Product[]; total: number; page: number; pageSize: number }> = {
      success: true,
      data: {
        products: paginatedProducts,
        total,
        page,
        pageSize,
      },
      meta: {
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: startIndex + pageSize < total,
          hasPrevious: page > 1,
        },
      },
    };

    res.json(response);
  })
);

/**
 * GET /api/products/:jobNumber
 * Get a single product by job number
 */
router.get(
  '/:jobNumber',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const { jobNumber } = req.params;
    const products = await googleSheetsService.getAllProducts();
    const product = products.find((p) => p.jobNumber === jobNumber);

    if (!product) {
      throw new NotFoundError('Product', jobNumber);
    }

    const response: ApiResponse<Product> = {
      success: true,
      data: product,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/products
 * Create a new product
 */
router.post(
  '/',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const input: CreateProductInput = req.body;

    // Validate required fields
    if (!input.jobNumber) {
      throw new ValidationError('Job number is required');
    }
    if (!input.workCenter) {
      throw new ValidationError('Work center is required');
    }

    // Check for duplicate job number
    const existingProducts = await googleSheetsService.getAllProducts();
    if (existingProducts.some((p) => p.jobNumber === input.jobNumber)) {
      throw new ValidationError(`Job number ${input.jobNumber} already exists`);
    }

    // Determine priority (append to end of work center queue by default)
    const wcProducts = existingProducts.filter((p) => p.workCenter === input.workCenter);
    const maxPriority = wcProducts.reduce((max, p) => Math.max(max, p.priority), 0);
    const priority = input.priority || maxPriority + 1;

    // Build product object
    const product: Partial<Product> = {
      jobNumber: input.jobNumber,
      customer: input.customer,
      productText: input.productText,
      quantity: input.quantity,
      length: input.length,
      balanceQuantity: input.balanceQuantity,
      requestedShipDate: input.requestedShipDate,
      setupMinutes: input.setupMinutes,
      uph: input.uph,
      cut: input.cut || false,
      extrusion: input.extrusion || false,
      ground: input.ground || false,
      drawing: input.drawing || '',
      ends: input.ends || '_',
      workCenter: input.workCenter,
      priority,
      priorityUpdatedAt: new Date().toISOString(),
      scheduledStart: null,
      scheduledEnd: null,
      scheduleStatus: 'Unscheduled',
      scheduleLocked: false,
      lockReason: null,
      notes: input.notes,
      customerPO: input.customerPO,
      materialStatus: input.materialStatus,
      lotNumber: input.lotNumber,
    };

    // Append to sheet
    const row = googleSheetsService.productToRow(product);
    const rowIndex = await googleSheetsService.appendRow(SHEET_NAMES.PRODUCTS, row);

    logger.info('Created product', { jobNumber: input.jobNumber, rowIndex });

    const response: ApiResponse<{ jobNumber: string; rowIndex: number }> = {
      success: true,
      data: { jobNumber: input.jobNumber, rowIndex },
      meta: { timestamp: new Date().toISOString() },
    };

    res.status(201).json(response);
  })
);

/**
 * PATCH /api/products/:jobNumber
 * Update a product
 */
router.patch(
  '/:jobNumber',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobNumber } = req.params;
    const input: UpdateProductInput = req.body;

    const products = await googleSheetsService.getAllProducts();
    const product = products.find((p) => p.jobNumber === jobNumber);

    if (!product) {
      throw new NotFoundError('Product', jobNumber);
    }

    // Track what changed for priority cascade
    const priorityChanged = input.priority !== undefined && input.priority !== product.priority;
    const workCenterChanged = input.workCenter !== undefined && input.workCenter !== product.workCenter;

    // Handle work center change with priority cascade
    if (workCenterChanged) {
      await priorityService.moveToWorkCenter(
        jobNumber,
        product.workCenter,
        input.workCenter!,
        input.priority
      );
      // Update work center in product object
      product.workCenter = input.workCenter!;
    } else if (priorityChanged) {
      // Just priority change within same work center
      await priorityService.updatePriority(jobNumber, input.priority!, product.workCenter);
    }

    // Update other fields
    const updatedProduct: Product = {
      ...product,
      ...input,
      priorityUpdatedAt: priorityChanged || workCenterChanged 
        ? new Date().toISOString() 
        : product.priorityUpdatedAt,
    };

    // Don't override priority/workCenter if they were handled above
    if (priorityChanged || workCenterChanged) {
      delete (input as Record<string, unknown>).priority;
      delete (input as Record<string, unknown>).workCenter;
    }

    await googleSheetsService.updateProduct(updatedProduct);

    logger.info('Updated product', { jobNumber, changes: Object.keys(input) });

    const response: ApiResponse<Product> = {
      success: true,
      data: updatedProduct,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/products/:jobNumber/lock
 * Lock a product's schedule
 */
router.post(
  '/:jobNumber/lock',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobNumber } = req.params;
    const { reason } = req.body;

    const products = await googleSheetsService.getAllProducts();
    const product = products.find((p) => p.jobNumber === jobNumber);

    if (!product) {
      throw new NotFoundError('Product', jobNumber);
    }

    product.scheduleLocked = true;
    product.lockReason = reason || 'Manually locked';

    await googleSheetsService.updateProduct(product);

    logger.info('Locked product schedule', { jobNumber, reason: product.lockReason });

    const response: ApiResponse<{ locked: boolean; reason: string }> = {
      success: true,
      data: { locked: true, reason: product.lockReason },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * DELETE /api/products/:jobNumber/lock
 * Unlock a product's schedule
 */
router.delete(
  '/:jobNumber/lock',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { jobNumber } = req.params;

    const products = await googleSheetsService.getAllProducts();
    const product = products.find((p) => p.jobNumber === jobNumber);

    if (!product) {
      throw new NotFoundError('Product', jobNumber);
    }

    product.scheduleLocked = false;
    product.lockReason = null;

    await googleSheetsService.updateProduct(product);

    logger.info('Unlocked product schedule', { jobNumber });

    const response: ApiResponse<{ locked: boolean }> = {
      success: true,
      data: { locked: false },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/products/reorder
 * Batch reorder priorities (for drag-drop)
 */
router.post(
  '/reorder',
  authMiddleware,
  requireRole('planner', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { workCenter, orderedJobNumbers } = req.body;

    if (!workCenter || !Array.isArray(orderedJobNumbers)) {
      throw new ValidationError('workCenter and orderedJobNumbers array required');
    }

    const updates = await priorityService.batchReorderPriorities(workCenter, orderedJobNumbers);

    logger.info('Batch reordered priorities', { workCenter, updated: updates.length });

    const response: ApiResponse<{ updates: typeof updates }> = {
      success: true,
      data: { updates },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

export default router;
