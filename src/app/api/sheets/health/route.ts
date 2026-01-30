import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/server/auth';
import { createGoogleSheetsClient } from '@/lib/server/googleSheets';
import type { SheetsHealth } from '@/types/settings';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const orgId = authResult.user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ORG', message: 'User not in an organization' } },
        { status: 400 }
      );
    }

    try {
      const sheetsService = await createGoogleSheetsClient(orgId);
      const health = await sheetsService.validateSheetHealth();

      return NextResponse.json({
        success: true,
        data: health,
      });
    } catch (error) {
      // If we can't even create the client, sheets aren't configured
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      const unconfiguredHealth: SheetsHealth = {
        status: 'unconfigured',
        issues: [{
          code: 'INVALID_CREDENTIALS',
          severity: 'error',
          message: errorMessage.includes('not configured') 
            ? 'Google Sheets has not been configured for this organization.'
            : errorMessage,
          userAction: 'Complete the Google Sheets setup in Settings.',
          adminRequired: true,
        }],
        lastChecked: new Date().toISOString(),
        sheets: [],
      };

      return NextResponse.json({
        success: true,
        data: unconfiguredHealth,
      });
    }
  } catch (error) {
    console.error('Error checking sheets health:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check sheets health' } },
      { status: 500 }
    );
  }
}

// POST to trigger auto-fix for issues
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !authResult.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Only admins can fix issues
    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Only administrators can fix sheet issues' } },
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
    const { action, sheetName } = body;

    const sheetsService = await createGoogleSheetsClient(orgId);

    switch (action) {
      case 'fix-missing-sheets': {
        const result = await sheetsService.fixMissingSheets();
        
        // Re-validate after fix
        const health = await sheetsService.validateSheetHealth();
        
        return NextResponse.json({
          success: true,
          data: {
            fixed: result.fixed,
            errors: result.errors,
            health,
          },
        });
      }

      case 'fix-missing-headers': {
        if (!sheetName) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Sheet name required' } },
            { status: 400 }
          );
        }

        const result = await sheetsService.fixMissingHeaders(sheetName);
        
        // Re-validate after fix
        const health = await sheetsService.validateSheetHealth();
        
        return NextResponse.json({
          success: true,
          data: {
            success: result.success,
            issue: result.issue,
            health,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ACTION', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fixing sheets:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fix sheet issues' } },
      { status: 500 }
    );
  }
}
