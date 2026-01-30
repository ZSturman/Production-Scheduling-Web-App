import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
} from '@/lib/server';
import type { AppSettings, UpdateSettingsInput, ApiResponse } from '@/types';
import { DEFAULT_SETTINGS } from '@/types/settings';
import { REQUIRED_SETTINGS } from '@/lib/sheetsTemplates';

// GET /api/settings - Get application settings
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const sheetNames = sheetsClient.getSheetNames();
    
    let settings: AppSettings = { ...DEFAULT_SETTINGS };
    
    try {
      const data = await sheetsClient.getSheetData(sheetNames.SETTINGS);
      
      // Settings are stored as key-value pairs (columns: Key, Value, Description, Notes)
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
    const sheetNames = sheetsClient.getSheetNames();

    // Get current settings with their descriptions and notes
    let currentData: string[][] = [];
    const existingSettingsMap = new Map<string, { value: string; description: string; notes: string }>();
    
    try {
      currentData = await sheetsClient.getSheetData(sheetNames.SETTINGS);
      for (const row of currentData.slice(1)) {
        const key = row[0];
        if (key) {
          existingSettingsMap.set(key, {
            value: row[1] || '',
            description: row[2] || '',
            notes: row[3] || '',
          });
        }
      }
    } catch {
      // Settings sheet doesn't exist
    }

    // Get current settings values
    let currentSettings: AppSettings = { ...DEFAULT_SETTINGS };
    for (const [key, data] of existingSettingsMap) {
      if (key in DEFAULT_SETTINGS) {
        if (key === 'defaultPriorityPosition') {
          currentSettings[key] = data.value as 'end' | 'start';
        } else {
          (currentSettings as unknown as Record<string, unknown>)[key] = parseFloat(data.value) || DEFAULT_SETTINGS[key as keyof AppSettings];
        }
      }
    }

    // Merge updates
    const updatedSettings: AppSettings = {
      ...currentSettings,
      ...input,
    };

    // Build rows with Key, Value, Description, Notes columns
    // Preserve existing descriptions and notes, use defaults from REQUIRED_SETTINGS for new entries
    const rows: (string | null)[][] = [
      ['Key', 'Value', 'Description', 'Notes'],
    ];
    
    for (const [key, value] of Object.entries(updatedSettings)) {
      const existing = existingSettingsMap.get(key);
      const requiredSetting = REQUIRED_SETTINGS.find(s => s.key === key);
      
      rows.push([
        key,
        String(value),
        existing?.description || requiredSetting?.description || '',
        existing?.notes || '',
      ]);
    }

    await sheetsClient.updateSheetData(
      `${sheetNames.SETTINGS}!A1:D${rows.length}`,
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
