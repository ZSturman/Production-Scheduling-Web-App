export interface Holiday {
  date: string;
  name: string;
  affectedWorkCenters: string[];
  rowIndex: number;
}

export interface CreateHolidayInput {
  date: string;
  name: string;
  affectedWorkCenters: string[];
}

export interface UpdateHolidayInput {
  date?: string;
  name?: string;
  affectedWorkCenters?: string[];
}

export function holidayAffectsWorkCenter(holiday: Holiday, workCenterId: string): boolean {
  return (
    holiday.affectedWorkCenters.includes('ALL') ||
    holiday.affectedWorkCenters.includes(workCenterId)
  );
}
