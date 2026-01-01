import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { AppSettings, UpdateSettingsInput, ApiResponse } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';

// GET /api/settings - Get application settings
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    
    let settings: AppSettings = { ...DEFAULT_SETTINGS };
    
    try {
      const data = await sheetsClient.getSheetData(SHEET_NAMES.SETTINGS);
      
      // Settings are stored as key-value pairs
      for (const row of data.slice(1)) {
        const key = row[0];
        const value = row[1];
        
        if (key && value && key in DEFAULT_SETTINGS) {
          if (key === 'defaultPriorityPosition') {
            settings[key] = value as 'end' | 'start';
          } else {
            (settings as unknown as Record<string, unknown>)[key] = parseFloat(value) || DEFAULT_SETTINGS[key as keyof AppSettings];
          }
        }
      }
    } catch {
      // Settings sheet doesn't exist, use defaults
    }

    const response: ApiResponse<AppSettings> = {
      success: true,
      data: settings,
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_SETTINGS_FAILED',
        message: 'Failed to get settings',
      },
    }, { status: 500 });
  }
});

// PATCH /api/settings - Update application settings
export const PATCH = withConfiguredOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can update settings',
        },
      }, { status: 403 });
    }

    const input = await request.json() as UpdateSettingsInput;
    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);

    // Get current settings
    let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
    
    try {
      const data = await sheetsClient.getSheetData(SHEET_NAMES.SETTINGS);
      for (const row of data.slice(1)) {
        const key = row[0];
        const value = row[1];
        if (key && value && key in DEFAULT_SETTINGS) {
          if (key === 'defaultPriorityPosition') {
            currentSettings[key] = value as 'end' | 'start';
          } else {
            (currentSettings as unknown as Record<string, unknown>)[key] = parseFloat(value) || DEFAULT_SETTINGS[key as keyof AppSettings];
          }
        }
      }
    } catch {
      // Settings sheet doesn't exist
    }

    // Merge updates
    const updatedSettings: AppSettings = {
      ...currentSettings,
      ...input,
    };

    // Write back as key-value pairs
    const rows = [
      ['Key', 'Value'],
      ...Object.entries(updatedSettings).map(([key, value]) => [key, String(value)]),
    ];

    await sheetsClient.updateSheetData(
      `${SHEET_NAMES.SETTINGS}!A1:B${rows.length}`,
      rows
    );

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'UPDATE_SETTINGS_FAILED',
        message: 'Failed to update settings',
      },
    }, { status: 500 });
  }
});
