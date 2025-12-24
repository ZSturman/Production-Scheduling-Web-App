import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { googleSheetsService, SHEET_NAMES } from '../services/googleSheets';
import { createModuleLogger } from '../utils/logger';
import { Holiday, CreateHolidayInput, ApiResponse } from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('holidays-route');

/**
 * GET /api/holidays
 * List all holidays
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const year = req.query.year as string;
    
    const data = await googleSheetsService.getSheetData(SHEET_NAMES.HOLIDAYS);
    
    let holidays: Holiday[] = data.slice(1).map((row, index) => ({
      date: row[0] || '',
      name: row[1] || '',
      affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
      rowIndex: index + 2,
    }));

    // Filter by year if specified
    if (year) {
      holidays = holidays.filter((h) => h.date.startsWith(year));
    }

    // Sort by date
    holidays.sort((a, b) => a.date.localeCompare(b.date));

    const response: ApiResponse<{ holidays: Holiday[] }> = {
      success: true,
      data: { holidays },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * POST /api/holidays
 * Create a new holiday
 */
router.post(
  '/',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const input: CreateHolidayInput = req.body;

    if (!input.date || !input.name) {
      throw new ValidationError('Date and name are required');
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      throw new ValidationError('Date must be in YYYY-MM-DD format');
    }

    const affectedWCs = input.affectedWorkCenters?.join(',') || 'ALL';
    
    const row = [input.date, input.name, affectedWCs];
    const rowIndex = await googleSheetsService.appendRow(SHEET_NAMES.HOLIDAYS, row);

    logger.info('Created holiday', { date: input.date, name: input.name });

    const holiday: Holiday = {
      date: input.date,
      name: input.name,
      affectedWorkCenters: input.affectedWorkCenters || ['ALL'],
      rowIndex,
    };

    const response: ApiResponse<Holiday> = {
      success: true,
      data: holiday,
      meta: { timestamp: new Date().toISOString() },
    };

    res.status(201).json(response);
  })
);

/**
 * DELETE /api/holidays/:date
 * Delete a holiday by date
 */
router.delete(
  '/:date',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { date } = req.params;

    const data = await googleSheetsService.getSheetData(SHEET_NAMES.HOLIDAYS);
    const holidays: Holiday[] = data.slice(1).map((row, index) => ({
      date: row[0] || '',
      name: row[1] || '',
      affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
      rowIndex: index + 2,
    }));

    const holiday = holidays.find((h) => h.date === date);

    if (!holiday) {
      throw new NotFoundError('Holiday', date);
    }

    // Clear the row (we can't delete rows easily, so we clear content)
    await googleSheetsService.updateSheetData(
      `${SHEET_NAMES.HOLIDAYS}!A${holiday.rowIndex}:C${holiday.rowIndex}`,
      [['', '', '']]
    );

    logger.info('Deleted holiday', { date });

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

export default router;
