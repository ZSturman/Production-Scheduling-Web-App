import type {
  Product,
  WorkCenter,
  Holiday,
  AppSettings,
  SchedulingResult,
  WorkCenterScheduleResult,
  CalculatedSchedule,
  ScheduleSegment,
  ScheduleStatus,
  SchedulingError,
} from '@/types';
import { DEFAULT_SETTINGS, holidayAffectsWorkCenter } from '@/types';
import { GoogleSheetsService } from './googleSheets';

interface TimeSlot {
  date: string;
  startHour: number;
  endHour: number;
  availableHours: number;
}

export class SchedulingEngine {
  private sheetsService: GoogleSheetsService;

  constructor(sheetsService: GoogleSheetsService) {
    this.sheetsService = sheetsService;
  }

  async calculateSchedules(settings?: AppSettings): Promise<SchedulingResult> {
    const effectiveSettings = settings || DEFAULT_SETTINGS;

    const [products, workCenters, holidays] = await Promise.all([
      this.sheetsService.getAllProducts(),
      this.sheetsService.getAllWorkCenters(),
      this.loadHolidays(),
    ]);

    const workCenterResults: WorkCenterScheduleResult[] = [];
    const errors: SchedulingError[] = [];
    let totalLockedAffected = 0;

    for (const wc of workCenters.filter((w) => w.active)) {
      const wcProducts = products.filter((p) => p.workCenter === wc.id || p.workCenter === wc.name);
      
      if (wcProducts.length === 0) {
        continue;
      }

      const result = this.scheduleWorkCenter(wc, wcProducts, holidays, effectiveSettings);
      workCenterResults.push(result);
      totalLockedAffected += result.skippedLockedJobs;
      
      for (const schedule of result.schedules) {
        if (schedule.scheduledStart === 'ERROR') {
          errors.push({
            jobNumber: schedule.jobNumber,
            workCenter: wc.id,
            message: 'Failed to schedule job',
            code: 'UNKNOWN',
          });
        }
      }
    }

    const allSchedules = workCenterResults.flatMap((r) => r.schedules);
    const onTimeCount = allSchedules.filter((s) => s.scheduleStatus === 'On-Time').length;
    const atRiskCount = allSchedules.filter((s) => s.scheduleStatus === 'At-Risk').length;
    const lateCount = allSchedules.filter((s) => s.scheduleStatus === 'Late').length;

    await this.writeSchedulesToSheet(allSchedules, products);

    return {
      success: errors.length === 0,
      timestamp: new Date().toISOString(),
      workCenterResults,
      totalJobs: products.length,
      scheduledJobs: allSchedules.length,
      lockedJobsAffected: totalLockedAffected,
      onTimeCount,
      atRiskCount,
      lateCount,
      errors,
    };
  }

  private scheduleWorkCenter(
    workCenter: WorkCenter,
    products: Product[],
    holidays: Holiday[],
    settings: AppSettings
  ): WorkCenterScheduleResult {
    const sortedProducts = [...products].sort((a, b) => a.priority - b.priority);
    
    const schedules: CalculatedSchedule[] = [];
    let currentTime = new Date();
    currentTime.setMinutes(0, 0, 0);
    
    let skippedLockedJobs = 0;

    for (const product of sortedProducts) {
      if (product.scheduleLocked) {
        if (product.scheduledStart) {
          skippedLockedJobs++;
        }
        continue;
      }

      if (!product.uph || product.uph <= 0) {
        schedules.push(this.createErrorSchedule(product, 'Invalid UPH'));
        continue;
      }
      if (product.balanceQuantity < 0) {
        schedules.push(this.createErrorSchedule(product, 'Invalid balance quantity'));
        continue;
      }

      const setupHours = product.setupMinutes / 60;
      const productionHours = product.balanceQuantity / product.uph;
      const totalHours = Math.ceil(setupHours + productionHours);

      const slots = this.findAvailableSlots(currentTime, totalHours, workCenter, holidays);

      if (slots.length === 0) {
        schedules.push(this.createErrorSchedule(product, 'No available slots'));
        continue;
      }

      const segments: ScheduleSegment[] = slots.map((slot) => ({
        date: slot.date,
        startHour: slot.startHour,
        endHour: slot.endHour,
        hoursScheduled: slot.availableHours,
      }));

      const scheduledStart = this.slotsToDateTime(slots[0], 'start');
      const scheduledEnd = this.slotsToDateTime(slots[slots.length - 1], 'end');

      const scheduleStatus = this.calculateStatus(
        scheduledEnd,
        product.requestedShipDate,
        settings.atRiskBufferDays
      );

      const dueDate = new Date(product.requestedShipDate);
      const endDate = new Date(scheduledEnd);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      schedules.push({
        jobNumber: product.jobNumber,
        workCenter: workCenter.id,
        priority: product.priority,
        balanceQuantity: product.balanceQuantity,
        uph: product.uph,
        setupHours,
        productionHours,
        totalHours,
        scheduledStart,
        scheduledEnd,
        segments,
        requestedShipDate: product.requestedShipDate,
        scheduleStatus,
        daysUntilDue,
        wasSkipped: false,
        lockReason: null,
      });

      currentTime = new Date(scheduledEnd);
    }

    return {
      workCenterId: workCenter.id,
      workCenterName: workCenter.name,
      totalJobs: products.length,
      scheduledJobs: schedules.length,
      lockedJobs: products.filter((p) => p.scheduleLocked).length,
      skippedLockedJobs,
      schedules,
      lastJobEnd: schedules.length > 0 ? schedules[schedules.length - 1].scheduledEnd : null,
    };
  }

  private findAvailableSlots(
    startFrom: Date,
    requiredHours: number,
    workCenter: WorkCenter,
    holidays: Holiday[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let remainingHours = requiredHours;
    let currentDate = new Date(startFrom);
    let maxIterations = 365;

    while (remainingHours > 0 && maxIterations > 0) {
      maxIterations--;
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      
      const isHoliday = holidays.some(
        (h) => h.date === dateStr && holidayAffectsWorkCenter(h, workCenter.id)
      );
      
      if (isHoliday) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      const daySchedule = this.getDaySchedule(workCenter, dayOfWeek);
      
      if (!daySchedule) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      const [startH] = daySchedule.start.split(':').map(Number);
      const [endH] = daySchedule.end.split(':').map(Number);
      
      let actualStartHour = startH;
      if (currentDate.toISOString().split('T')[0] === startFrom.toISOString().split('T')[0]) {
        actualStartHour = Math.max(startH, currentDate.getHours());
      }

      const availableHours = Math.max(0, endH - actualStartHour);
      
      if (availableHours > 0) {
        const hoursToUse = Math.min(availableHours, remainingHours);
        slots.push({
          date: dateStr,
          startHour: actualStartHour,
          endHour: actualStartHour + hoursToUse,
          availableHours: hoursToUse,
        });
        remainingHours -= hoursToUse;
      }

      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return slots;
  }

  private getDaySchedule(
    workCenter: WorkCenter,
    dayOfWeek: number
  ): { start: string; end: string } | null {
    const schedule = workCenter.schedule;
    
    switch (dayOfWeek) {
      case 0: return schedule.sunday;
      case 1: return schedule.monday;
      case 2: return schedule.tuesday;
      case 3: return schedule.wednesday;
      case 4: return schedule.thursday;
      case 5: return schedule.friday;
      case 6: return schedule.saturday;
      default: return null;
    }
  }

  private slotsToDateTime(slot: TimeSlot, which: 'start' | 'end'): string {
    const hour = which === 'start' ? slot.startHour : slot.endHour;
    const hourStr = hour.toString().padStart(2, '0');
    return `${slot.date}T${hourStr}:00:00`;
  }

  private calculateStatus(
    scheduledEnd: string,
    requestedShipDate: string,
    atRiskBufferDays: number
  ): ScheduleStatus {
    if (!requestedShipDate) return 'Unscheduled';
    
    const endDate = new Date(scheduledEnd);
    const dueDate = new Date(requestedShipDate);
    
    const diffMs = dueDate.getTime() - endDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffDays < 0) {
      return 'Late';
    } else if (diffDays <= atRiskBufferDays) {
      return 'At-Risk';
    } else {
      return 'On-Time';
    }
  }

  private createErrorSchedule(product: Product, error: string): CalculatedSchedule {
    return {
      jobNumber: product.jobNumber,
      workCenter: product.workCenter,
      priority: product.priority,
      balanceQuantity: product.balanceQuantity,
      uph: product.uph,
      setupHours: 0,
      productionHours: 0,
      totalHours: 0,
      scheduledStart: 'ERROR',
      scheduledEnd: 'ERROR',
      segments: [],
      requestedShipDate: product.requestedShipDate,
      scheduleStatus: 'Unscheduled',
      daysUntilDue: 0,
      wasSkipped: false,
      lockReason: error,
    };
  }

  private async loadHolidays(): Promise<Holiday[]> {
    try {
      const sheetNames = this.sheetsService.getSheetNames();
      const data = await this.sheetsService.getSheetData(sheetNames.HOLIDAYS);
      
      return data.slice(1).map((row, index) => ({
        date: row[0] || '',
        name: row[1] || '',
        affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
        rowIndex: index + 2,
      }));
    } catch {
      return [];
    }
  }

  private async writeSchedulesToSheet(
    schedules: CalculatedSchedule[],
    products: Product[]
  ): Promise<void> {
    const updates: {
      rowIndex: number;
      scheduledStart: string | null;
      scheduledEnd: string | null;
      scheduleStatus: string;
    }[] = [];

    for (const schedule of schedules) {
      const product = products.find((p) => p.jobNumber === schedule.jobNumber);
      if (!product) continue;
      if (schedule.scheduledStart === 'ERROR') continue;

      updates.push({
        rowIndex: product.rowIndex,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        scheduleStatus: schedule.scheduleStatus,
      });
    }

    if (updates.length > 0) {
      await this.sheetsService.batchUpdateSchedules(updates);
    }
  }
}
