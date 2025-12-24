import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { googleSheetsService, SHEET_NAMES } from '../services/googleSheets';
import { createModuleLogger } from '../utils/logger';
import {
  AppSettings,
  UpdateSettingsInput,
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  ApiResponse,
} from '../../../shared/src';

const router = Router();
const logger = createModuleLogger('settings-route');

/**
 * Load settings from the Settings sheet
 */
async function loadSettings(): Promise<AppSettings> {
  try {
    const data = await googleSheetsService.getSheetData(SHEET_NAMES.SETTINGS);
    
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    
    // Parse key-value pairs from sheet
    for (const row of data.slice(1)) {
      const key = row[0] as keyof AppSettings;
      const value = row[1];
      
      if (key && value !== undefined) {
        switch (key) {
          case 'atRiskBufferDays':
          case 'syncIntervalSeconds':
          case 'ganttRefreshMinutes':
          case 'minGanttDisplayHours':
            settings[key] = parseInt(value, 10) || DEFAULT_SETTINGS[key];
            break;
          case 'defaultPriorityPosition':
            settings[key] = value === 'start' ? 'start' : 'end';
            break;
        }
      }
    }
    
    return settings;
  } catch (error) {
    logger.warn('Failed to load settings, using defaults', { error });
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save a setting to the Settings sheet
 */
async function saveSetting(key: string, value: string | number): Promise<void> {
  const data = await googleSheetsService.getSheetData(SHEET_NAMES.SETTINGS);
  
  // Find existing row for this key
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      rowIndex = i + 1; // 1-based
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing
    await googleSheetsService.updateSheetData(
      `${SHEET_NAMES.SETTINGS}!B${rowIndex}`,
      [[String(value)]]
    );
  } else {
    // Append new
    await googleSheetsService.appendRow(SHEET_NAMES.SETTINGS, [key, String(value)]);
  }
}

/**
 * GET /api/settings
 * Get all settings
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await loadSettings();

    const response: ApiResponse<AppSettings> = {
      success: true,
      data: settings,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

/**
 * PATCH /api/settings
 * Update settings
 */
router.patch(
  '/',
  authMiddleware,
  requireRole('admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const input: UpdateSettingsInput = req.body;
    
    // Update each provided setting
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined && key in SETTINGS_KEYS) {
        await saveSetting(key, value);
        logger.info('Updated setting', { key, value, userId: req.user?.uid });
      }
    }

    // Reload and return updated settings
    const settings = await loadSettings();

    const response: ApiResponse<AppSettings> = {
      success: true,
      data: settings,
      meta: { timestamp: new Date().toISOString() },
    };

    res.json(response);
  })
);

export default router;
