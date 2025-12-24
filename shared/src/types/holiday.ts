/**
 * Holiday entry that affects work center availability
 */
export interface Holiday {
  date: string;                  // ISO date string (YYYY-MM-DD)
  name: string;                  // Holiday name (e.g., "Christmas Day")
  affectedWorkCenters: string[]; // Work center IDs, or ['ALL'] for all
  rowIndex: number;              // 1-based row index in sheet
}

/**
 * Holiday creation input
 */
export interface CreateHolidayInput {
  date: string;
  name: string;
  affectedWorkCenters: string[]; // Use ['ALL'] to affect all work centers
}

/**
 * Holiday update input
 */
export interface UpdateHolidayInput {
  date?: string;
  name?: string;
  affectedWorkCenters?: string[];
}

/**
 * Check if a holiday affects a specific work center
 */
export function holidayAffectsWorkCenter(holiday: Holiday, workCenterId: string): boolean {
  return (
    holiday.affectedWorkCenters.includes('ALL') ||
    holiday.affectedWorkCenters.includes(workCenterId)
  );
}
