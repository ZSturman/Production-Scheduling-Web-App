import { NextRequest, NextResponse } from 'next/server';
import { 
  withConfiguredOrg,
  createGoogleSheetsClient,
  SHEET_NAMES,
} from '@/lib/server';
import type { Holiday } from '@/types';

// DELETE /api/holidays/[date] - Delete a holiday
export const DELETE = withConfiguredOrg(async (
  request: NextRequest,
  context,
  params?: { params: Promise<{ date: string }> }
) => {
  try {
    if (context.user.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only admins can delete holidays',
        },
      }, { status: 403 });
    }

    const { date } = await (params?.params || Promise.resolve({ date: '' }));

    const sheetsClient = await createGoogleSheetsClient(context.org!.orgId);
    const data = await sheetsClient.getSheetData(SHEET_NAMES.HOLIDAYS);

    const holidays: Holiday[] = data.slice(1).map((row, index) => ({
      date: row[0] || '',
      name: row[1] || '',
      affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
      rowIndex: index + 2,
    }));

    const holiday = holidays.find(h => h.date === date);

    if (!holiday) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Holiday ${date} not found`,
        },
      }, { status: 404 });
    }

    // Clear the row
    await sheetsClient.updateSheetData(
      `${SHEET_NAMES.HOLIDAYS}!A${holiday.rowIndex}:C${holiday.rowIndex}`,
      [['', '', '']]
    );

    return NextResponse.json({
      success: true,
      data: { deleted: true },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Failed to delete holiday:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'DELETE_HOLIDAY_FAILED',
        message: 'Failed to delete holiday',
      },
    }, { status: 500 });
  }
});
