import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { googleSheetsService, SHEET_NAMES } from '../services/googleSheets';
import { createModuleLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLogEntry,
  CreateAuditLogInput,
  AuditLogFilters,
  ApiResponse,
} from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('audit-route');

/**
 * Parse audit log row from sheet
 */
function parseAuditRow(row: string[], rowIndex: number): AuditLogEntry {
  return {
    id: row[0] || '',
    timestamp: row[1] || '',
    userId: row[2] || '',
    userEmail: row[3] || '',
    action: row[4] as AuditLogEntry['action'],
    jobNumber: row[5] || null,
    workCenterId: row[6] || null,
    field: row[7] || null,
    oldValue: row[8] || null,
    newValue: row[9] || null,
    details: row[10] || null,
    rowIndex: rowIndex + 1,
  };
}

/**
 * GET /api/audit
 * Get audit log entries
 */
router.get(
  '/',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const filters: AuditLogFilters = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      action: req.query.action as AuditLogFilters['action'],
      userId: req.query.userId as string,
      jobNumber: req.query.jobNumber as string,
      workCenterId: req.query.workCenterId as string,
    };

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    try {
      const data = await googleSheetsService.getSheetData(SHEET_NAMES.AUDIT_LOG);
      
      let entries = data.slice(1).map((row, index) => parseAuditRow(row, index + 1));

      // Apply filters
      if (filters.startDate) {
        entries = entries.filter((e) => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        entries = entries.filter((e) => e.timestamp <= filters.endDate!);
      }
      if (filters.action) {
        entries = entries.filter((e) => e.action === filters.action);
      }
      if (filters.userId) {
        entries = entries.filter((e) => e.userId === filters.userId);
      }
      if (filters.jobNumber) {
        entries = entries.filter((e) => e.jobNumber === filters.jobNumber);
      }
      if (filters.workCenterId) {
        entries = entries.filter((e) => e.workCenterId === filters.workCenterId);
      }

      // Sort by timestamp descending (newest first)
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Paginate
      const total = entries.length;
      const startIndex = (page - 1) * pageSize;
      const paginatedEntries = entries.slice(startIndex, startIndex + pageSize);

      const response: ApiResponse<{ entries: AuditLogEntry[]; total: number }> = {
        success: true,
        data: {
          entries: paginatedEntries,
          total,
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
    } catch (error) {
      // Audit log sheet might not exist yet
      logger.warn('Failed to read audit log', { error });
      
      const response: ApiResponse<{ entries: AuditLogEntry[]; total: number }> = {
        success: true,
        data: { entries: [], total: 0 },
        meta: { timestamp: new Date().toISOString() },
      };

      res.json(response);
    }
  })
);

/**
 * Create an audit log entry (internal use)
 */
export async function createAuditEntry(input: CreateAuditLogInput): Promise<void> {
  try {
    const entry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userId: input.userId,
      userEmail: input.userEmail,
      action: input.action,
      jobNumber: input.jobNumber || null,
      workCenterId: input.workCenterId || null,
      field: input.field || null,
      oldValue: input.oldValue !== undefined ? JSON.stringify(input.oldValue) : null,
      newValue: input.newValue !== undefined ? JSON.stringify(input.newValue) : null,
      details: input.details || null,
      rowIndex: -1,
    };

    const row = [
      entry.id,
      entry.timestamp,
      entry.userId,
      entry.userEmail,
      entry.action,
      entry.jobNumber || '',
      entry.workCenterId || '',
      entry.field || '',
      entry.oldValue || '',
      entry.newValue || '',
      entry.details || '',
    ];

    await googleSheetsService.appendRow(SHEET_NAMES.AUDIT_LOG, row);
  } catch (error) {
    // Don't fail operations if audit logging fails
    logger.error('Failed to create audit entry', { error, input });
  }
}

export default router;
