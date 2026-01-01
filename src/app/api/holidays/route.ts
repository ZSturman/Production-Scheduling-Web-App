import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { Holiday, CreateHolidayInput, ApiResponse } from '@/types';

// GET /api/holidays - List all holidays
export const GET = withConfiguredOrg(async (request, context) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const data = await sheetsClient.getSheetData(SHEET_NAMES.HOLIDAYS);

    let holidays: Holiday[] = data.slice(1).map((row, index) => ({
      date: row[0] || '',
      name: row[1] || '',
      affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
      rowIndex: index + 2,
    }));

    if (year) {
      holidays = holidays.filter(h => h.date.startsWith(year));
    }

    holidays.sort((a, b) => a.date.localeCompare(b.date));

    const response: ApiResponse<{ holidays: Holiday[] }> = {
      success: true,
      data: { holidays },
      meta: { timestamp: new Date().toISOString() },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get holidays:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'GET_HOLIDAYS_FAILED',
        message: 'Failed to get holidays',
      },
    }, { status: 500 });
  }
});

// POST /api/holidays - Create a new holiday
export const POST = withConfiguredOrg(async (request, context) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can create holidays',
        },
      }, { status: 403 });
    }

    const input = await request.json() as CreateHolidayInput;

    if (!input.date || !input.name) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date and name are required',
        },
      }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Date must be in YYYY-MM-DD format',
        },
      }, { status: 400 });
    }

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const affectedWCs = input.affectedWorkCenters?.join(',') || 'ALL';
    const row = [input.date, input.name, affectedWCs];
    const rowIndex = await sheetsClient.appendRow(SHEET_NAMES.HOLIDAYS, row);

    const holiday: Holiday = {
      date: input.date,
      name: input.name,
      affectedWorkCenters: input.affectedWorkCenters || ['ALL'],
      rowIndex,
    };

    return NextResponse.json({
      success: true,
      data: holiday,
      meta: { timestamp: new Date().toISOString() },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create holiday:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'CREATE_HOLIDAY_FAILED',
        message: 'Failed to create holiday',
      },
    }, { status: 500 });
  }
});
