import { createModuleLogger } from '../utils/logger';
import { googleSheetsService, SHEET_NAMES } from './googleSheets';
import {
  Product,
  WorkCenter,
  Holiday,
  AppSettings,
  DEFAULT_SETTINGS,
  SchedulingResult,
  WorkCenterScheduleResult,
  CalculatedSchedule,
  ScheduleSegment,
  ScheduleStatus,
  SchedulingError,
  holidayAffectsWorkCenter,
} from '../../../shared/src';

const logger = createModuleLogger('scheduling-engine');

interface TimeSlot {
  date: string;        // YYYY-MM-DD
  startHour: number;   // 0-23
  endHour: number;     // 0-23
  availableHours: number;
}

class SchedulingEngine {
  /**
   * Run full schedule calculation for all work centers
   */
  async calculateSchedules(settings?: AppSettings): Promise<SchedulingResult> {
    const startTime = Date.now();
    const effectiveSettings = settings || DEFAULT_SETTINGS;
    
    logger.info('Starting schedule calculation', { settings: effectiveSettings });

    try {
      // Load all data from sheets
      const [products, workCenters, holidays] = await Promise.all([
        googleSheetsService.getAllProducts(),
        googleSheetsService.getAllWorkCenters(),
        this.loadHolidays(),
      ]);

      logger.info('Loaded data for scheduling', {
        products: products.length,
        workCenters: workCenters.length,
        holidays: holidays.length,
      });

      const workCenterResults: WorkCenterScheduleResult[] = [];
      const errors: SchedulingError[] = [];
      let totalLockedAffected = 0;

      // Process each active work center
      for (const wc of workCenters.filter((w) => w.active)) {
        const wcProducts = products.filter((p) => p.workCenter === wc.id || p.workCenter === wc.name);
        
        if (wcProducts.length === 0) {
          continue;
        }

        const result = await this.scheduleWorkCenter(
          wc,
          wcProducts,
          holidays,
          effectiveSettings
        );
        
        workCenterResults.push(result);
        totalLockedAffected += result.skippedLockedJobs;
        
        // Collect any errors
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

      // Calculate summary stats
      const allSchedules = workCenterResults.flatMap((r) => r.schedules);
      const onTimeCount = allSchedules.filter((s) => s.scheduleStatus === 'On-Time').length;
      const atRiskCount = allSchedules.filter((s) => s.scheduleStatus === 'At-Risk').length;
      const lateCount = allSchedules.filter((s) => s.scheduleStatus === 'Late').length;

      // Write schedules back to sheet
      await this.writeSchedulesToSheet(allSchedules, products);

      const duration = Date.now() - startTime;
      logger.info('Schedule calculation complete', {
        duration: `${duration}ms`,
        totalJobs: allSchedules.length,
        onTime: onTimeCount,
        atRisk: atRiskCount,
        late: lateCount,
        lockedAffected: totalLockedAffected,
      });

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
    } catch (error) {
      logger.error('Schedule calculation failed', { error });
      throw error;
    }
  }

  /**
   * Schedule all jobs for a single work center
   */
  private async scheduleWorkCenter(
    workCenter: WorkCenter,
    products: Product[],
    holidays: Holiday[],
    settings: AppSettings
  ): Promise<WorkCenterScheduleResult> {
    // Sort by priority (ascending)
    const sortedProducts = [...products].sort((a, b) => a.priority - b.priority);
    
    const schedules: CalculatedSchedule[] = [];
    let currentTime = new Date();
    currentTime.setMinutes(0, 0, 0); // Round to hour
    
    let skippedLockedJobs = 0;

    for (const product of sortedProducts) {
      // Skip locked jobs but track if they would have been affected
      if (product.scheduleLocked) {
        const existingSchedule = product.scheduledStart;
        // Would this job's schedule have changed?
        if (existingSchedule) {
          skippedLockedJobs++;
        }
        continue;
      }

      // Validate inputs
      if (!product.uph || product.uph <= 0) {
        schedules.push(this.createErrorSchedule(product, 'Invalid UPH'));
        continue;
      }
      if (product.balanceQuantity < 0) {
        schedules.push(this.createErrorSchedule(product, 'Invalid balance quantity'));
        continue;
      }

      // Calculate required production time
      const setupHours = product.setupMinutes / 60;
      const productionHours = product.balanceQuantity / product.uph;
      const totalHours = Math.ceil(setupHours + productionHours); // Round up to nearest hour

      // Find available time slots
      const slots = this.findAvailableSlots(
        currentTime,
        totalHours,
        workCenter,
        holidays
      );

      if (slots.length === 0) {
        schedules.push(this.createErrorSchedule(product, 'No available slots'));
        continue;
      }

      // Build segments from slots
      const segments: ScheduleSegment[] = slots.map((slot) => ({
        date: slot.date,
        startHour: slot.startHour,
        endHour: slot.endHour,
        hoursScheduled: slot.availableHours,
      }));

      // Calculate scheduled start and end
      const scheduledStart = this.slotsToDateTime(slots[0], 'start');
      const scheduledEnd = this.slotsToDateTime(slots[slots.length - 1], 'end');

      // Determine schedule status
      const scheduleStatus = this.calculateStatus(
        scheduledEnd,
        product.requestedShipDate,
        settings.atRiskBufferDays
      );

      // Calculate days until due
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

      // Update current time for next job
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
      lastJobEnd: schedules.length > 0 
        ? schedules[schedules.length - 1].scheduledEnd 
        : null,
    };
  }

  /**
   * Find available time slots for the required hours
   */
  private findAvailableSlots(
    startFrom: Date,
    requiredHours: number,
    workCenter: WorkCenter,
    holidays: Holiday[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    let remainingHours = requiredHours;
    let currentDate = new Date(startFrom);
    let maxIterations = 365; // Prevent infinite loop

    while (remainingHours > 0 && maxIterations > 0) {
      maxIterations--;
      
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      
      // Check if it's a holiday
      const isHoliday = holidays.some(
        (h) => h.date === dateStr && holidayAffectsWorkCenter(h, workCenter.id)
      );
      
      if (isHoliday) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      // Get schedule for this day
      const daySchedule = this.getDaySchedule(workCenter, dayOfWeek);
      
      if (!daySchedule) {
        currentDate.setDate(currentDate.getDate() + 1);
        currentDate.setHours(0, 0, 0, 0);
        continue;
      }

      // Parse start and end hours
      const [startH] = daySchedule.start.split(':').map(Number);
      const [endH] = daySchedule.end.split(':').map(Number);
      
      // Determine actual start hour for this day
      let actualStartHour = startH;
      if (currentDate.toISOString().split('T')[0] === startFrom.toISOString().split('T')[0]) {
        // First day - start from current hour if after work start
        actualStartHour = Math.max(startH, currentDate.getHours());
      }

      // Calculate available hours this day
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

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return slots;
  }

  /**
   * Get the schedule for a specific day of the week
   */
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

  /**
   * Convert slot to ISO datetime string
   */
  private slotsToDateTime(slot: TimeSlot, which: 'start' | 'end'): string {
    const hour = which === 'start' ? slot.startHour : slot.endHour;
    const hourStr = hour.toString().padStart(2, '0');
    return `${slot.date}T${hourStr}:00:00`;
  }

  /**
   * Calculate schedule status based on end date vs due date
   */
  private calculateStatus(
    scheduledEnd: string,
    requestedShipDate: string,
    atRiskBufferDays: number
  ): ScheduleStatus {
    if (!requestedShipDate) return 'Unscheduled';
    
    const endDate = new Date(scheduledEnd);
    const dueDate = new Date(requestedShipDate);
    
    // Calculate days difference
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

  /**
   * Create an error schedule entry
   */
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

  /**
   * Load holidays from sheet
   */
  private async loadHolidays(): Promise<Holiday[]> {
    try {
      const data = await googleSheetsService.getSheetData(SHEET_NAMES.HOLIDAYS);
      
      return data.slice(1).map((row, index) => ({
        date: row[0] || '',
        name: row[1] || '',
        affectedWorkCenters: (row[2] || 'ALL').split(',').map((s: string) => s.trim()),
        rowIndex: index + 2,
      }));
    } catch (error) {
      logger.warn('Failed to load holidays, continuing without', { error });
      return [];
    }
  }

  /**
   * Write calculated schedules back to the Products sheet
   */
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
      
      // Skip error schedules
      if (schedule.scheduledStart === 'ERROR') continue;

      updates.push({
        rowIndex: product.rowIndex,
        scheduledStart: schedule.scheduledStart,
        scheduledEnd: schedule.scheduledEnd,
        scheduleStatus: schedule.scheduleStatus,
      });
    }

    if (updates.length > 0) {
      await googleSheetsService.batchUpdateSchedules(updates);
      logger.info('Wrote schedules to sheet', { count: updates.length });
    }
  }
}

// Export singleton instance
export const schedulingEngine = new SchedulingEngine();
