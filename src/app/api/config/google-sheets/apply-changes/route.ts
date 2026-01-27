import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/auth';
import { createGoogleSheetsClient, SHEET_NAMES } from '@/lib/server/googleSheets';
import { getFirestore } from '@/lib/server/firebase-admin';
import type { WizardConfig } from '@/components/sheets-wizard/SheetsWizard';

interface RollbackRequest {
  rollbackToHistoryIndex: number;
}

function isRollbackRequest(body: unknown): body is RollbackRequest {
  return typeof body === 'object' && body !== null && 'rollbackToHistoryIndex' in body;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only admins can apply sheet changes
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can modify sheet configuration' } },
        { status: 403 }
      );
    }

    const orgId = authResult.user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ORG', message: 'User not in an organization' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Handle rollback request
    if (isRollbackRequest(body)) {
      return handleRollback(orgId, body.rollbackToHistoryIndex, authResult.user.uid);
    }

    const config: WizardConfig = body;
    
    const sheetsService = await createGoogleSheetsClient(orgId);
    const results = {
      sheetsCreated: [] as string[],
      sheetsRenamed: [] as { from: string; to: string }[],
      headersUpdated: [] as string[],
      errors: [] as { operation: string; message: string }[],
    };

    // Get current spreadsheet info
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
    const existingSheets = new Set(spreadsheetInfo.sheets);

    // 1. Create missing sheets
    for (const sheet of config.sheets) {
      if (!existingSheets.has(sheet.name) && !sheet.renamedFrom) {
        try {
          await sheetsService.createSheet(sheet.name);
          results.sheetsCreated.push(sheet.name);
          
          // Set up headers for new sheet
          const columnConfig = config.columns.find(c => c.sheetKey === sheet.key);
          if (columnConfig) {
            const headers = columnConfig.columns
              .filter(c => c.enabled)
              .map(c => c.label);
            await sheetsService.updateSheetHeaders(sheet.name, headers);
          }
          
          // Add default data if requested
          if (config.addDefaultData) {
            if (sheet.name === SHEET_NAMES.WORK_CENTERS || sheet.key === 'workCenters') {
              await sheetsService.setupWorkCentersSheet();
            } else if (sheet.name === SHEET_NAMES.HOLIDAYS || sheet.key === 'holidays') {
              await sheetsService.setupHolidaysSheet();
            } else if (sheet.name === SHEET_NAMES.SETTINGS || sheet.key === 'settings') {
              await sheetsService.setupSettingsSheet();
            }
          }
        } catch (error) {
          results.errors.push({
            operation: `Create sheet "${sheet.name}"`,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 2. Rename sheets if needed
    for (const sheet of config.sheets) {
      if (sheet.renamedFrom && existingSheets.has(sheet.renamedFrom)) {
        try {
          const result = await sheetsService.renameSheet(sheet.renamedFrom, sheet.name);
          if (result.success) {
            results.sheetsRenamed.push({ from: sheet.renamedFrom, to: sheet.name });
          } else if (result.issue) {
            results.errors.push({
              operation: `Rename sheet "${sheet.renamedFrom}" to "${sheet.name}"`,
              message: result.issue.message,
            });
          }
        } catch (error) {
          results.errors.push({
            operation: `Rename sheet "${sheet.renamedFrom}" to "${sheet.name}"`,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    // 3. Update headers for existing sheets
    for (const columnConfig of config.columns) {
      const sheetConfig = config.sheets.find(s => s.key === columnConfig.sheetKey);
      const sheetName = sheetConfig?.name || columnConfig.sheetKey;
      
      // Check if sheet exists (either original or renamed)
      const sheetExists = existingSheets.has(sheetName) || 
                          results.sheetsCreated.includes(sheetName) ||
                          results.sheetsRenamed.some(r => r.to === sheetName);
      
      if (sheetExists) {
        const columnsWithRenames = columnConfig.columns.filter(c => c.renamedFrom);
        
        if (columnsWithRenames.length > 0) {
          try {
            // Get current headers
            const { data } = await sheetsService.safeGetSheetData(sheetName);
            if (data && data[0]) {
              const currentHeaders = [...data[0]];
              
              // Apply renames
              for (const col of columnsWithRenames) {
                const index = currentHeaders.indexOf(col.renamedFrom!);
                if (index !== -1) {
                  currentHeaders[index] = col.label;
                }
              }
              
              // Update headers
              const result = await sheetsService.updateSheetHeaders(sheetName, currentHeaders);
              if (result.success) {
                results.headersUpdated.push(sheetName);
              } else if (result.issue) {
                results.errors.push({
                  operation: `Update headers for "${sheetName}"`,
                  message: result.issue.message,
                });
              }
            }
          } catch (error) {
            results.errors.push({
              operation: `Update headers for "${sheetName}"`,
              message: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    }

    // 4. Save the configuration to Firestore
    try {
      const db = getFirestore();
      const configDoc = {
        templateId: config.templateId,
        templateVersion: '1.0.0',
        sheets: config.sheets.map(s => ({
          key: s.key,
          name: s.name,
        })),
        columns: config.columns.map(c => ({
          sheetKey: c.sheetKey,
          columns: c.columns.map(col => ({
            key: col.key,
            label: col.label,
            enabled: col.enabled,
          })),
        })),
        configuredAt: new Date().toISOString(),
        configuredBy: authResult.user.uid,
      };

      await db.collection('organizations').doc(orgId).collection('sheetsConfig').doc('current').set(configDoc);
      
      // Also save to history
      await db.collection('organizations').doc(orgId).collection('sheetsConfigHistory').add({
        ...configDoc,
        changedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.errors.push({
        operation: 'Save configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // 5. Re-validate sheets health
    const health = await sheetsService.validateSheetHealth();

    return NextResponse.json({
      success: results.errors.length === 0,
      data: {
        results,
        health,
      },
    });
  } catch (error) {
    console.error('Error applying sheet changes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to apply sheet changes' 
        } 
      },
      { status: 500 }
    );
  }
}

/**
 * Handle rollback to a previous configuration
 */
async function handleRollback(orgId: string, historyIndex: number, userId: string) {
  try {
    const db = getFirestore();
    
    // Get configuration history
    const historySnapshot = await db
      .collection('organizations')
      .doc(orgId)
      .collection('sheetsConfigHistory')
      .orderBy('changedAt', 'desc')
      .get();
    
    if (historySnapshot.empty || historyIndex >= historySnapshot.docs.length) {
      return NextResponse.json(
        { success: false, error: 'Configuration history not found' },
        { status: 404 }
      );
    }
    
    const targetHistory = historySnapshot.docs[historyIndex].data();
    
    // Save current config to history before rollback
    const currentConfigDoc = await db
      .collection('organizations')
      .doc(orgId)
      .collection('sheetsConfig')
      .doc('current')
      .get();
    
    if (currentConfigDoc.exists) {
      await db
        .collection('organizations')
        .doc(orgId)
        .collection('sheetsConfigHistory')
        .add({
          ...currentConfigDoc.data(),
          changedAt: new Date().toISOString(),
          reason: 'Saved before rollback',
        });
    }
    
    // Restore the target configuration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restoredConfig: Record<string, any> = {
      ...targetHistory,
      configuredAt: new Date().toISOString(),
      configuredBy: userId,
      restoredFrom: targetHistory.changedAt,
    };
    
    // Remove the changedAt field as it's not part of current config
    delete restoredConfig.changedAt;
    delete restoredConfig.reason;
    
    await db
      .collection('organizations')
      .doc(orgId)
      .collection('sheetsConfig')
      .doc('current')
      .set(restoredConfig);
    
    // Apply sheet changes if there are sheet name differences
    const sheetsService = await createGoogleSheetsClient(orgId);
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo();
    const existingSheets = new Set(spreadsheetInfo.sheets);
    
    const results = {
      sheetsRenamed: [] as { from: string; to: string }[],
      errors: [] as { operation: string; message: string }[],
    };
    
    // Rename sheets back to their historical names if they exist with different names
    if (targetHistory.sheets && Array.isArray(targetHistory.sheets)) {
      for (const sheet of targetHistory.sheets) {
        const targetName = sheet.name;
        if (!existingSheets.has(targetName)) {
          // Try to find a sheet that might have been renamed
          // This is a best-effort approach - we can't always know the mapping
          console.log(`Sheet "${targetName}" not found, may need manual restoration`);
        }
      }
    }
    
    // Re-validate sheets health
    const health = await sheetsService.validateSheetHealth();
    
    return NextResponse.json({
      success: true,
      data: {
        message: 'Configuration rolled back successfully',
        restoredFrom: targetHistory.changedAt,
        results,
        health,
      },
    });
  } catch (error) {
    console.error('Error rolling back configuration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to rollback configuration' 
      },
      { status: 500 }
    );
  }
}
