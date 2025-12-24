import { EndsType, ScheduleStatus } from './enums';

/**
 * Product/Job data model
 * Represents a single production job from the Products sheet
 */
export interface Product {
  // === Core Identification ===
  jobNumber: string;           // Primary key
  customer: string;
  productText: string;
  
  // === Quantity & Dimensions ===
  quantity: number;
  length: number;
  balanceQuantity: number;     // Remaining quantity to produce
  
  // === Scheduling Inputs ===
  requestedShipDate: string;   // ISO date string (YYYY-MM-DD)
  setupMinutes: number;        // Setup time in minutes
  uph: number;                 // Units per hour
  
  // === Process Flags ===
  cut: boolean;
  extrusion: boolean;
  ground: boolean;
  
  // === Product Details ===
  drawing: string;
  ends: EndsType;
  
  // === Work Center Assignment ===
  workCenter: string;          // Work center ID/name
  
  // === Priority Management ===
  priority: number;            // Sequential within work center (1, 2, 3...)
  priorityUpdatedAt: string;   // ISO timestamp for conflict resolution
  
  // === Calculated Schedule ===
  scheduledStart: string | null;    // ISO datetime string
  scheduledEnd: string | null;      // ISO datetime string
  scheduleStatus: ScheduleStatus;
  
  // === Schedule Lock ===
  scheduleLocked: boolean;
  lockReason: string | null;
  
  // === Sync Metadata ===
  rowIndex: number;            // 1-based row index in sheet
  rowHash: string;             // MD5 hash for change detection
  
  // === Optional/Extensible Fields ===
  notes?: string;
  customerPO?: string;
  materialStatus?: string;
  lotNumber?: string;
  
  // Allow additional custom fields
  [key: string]: unknown;
}

/**
 * Product creation input (subset of Product)
 */
export interface CreateProductInput {
  jobNumber: string;
  customer: string;
  productText: string;
  quantity: number;
  length: number;
  balanceQuantity: number;
  requestedShipDate: string;
  setupMinutes: number;
  uph: number;
  cut?: boolean;
  extrusion?: boolean;
  ground?: boolean;
  drawing?: string;
  ends?: EndsType;
  workCenter: string;
  priority?: number;           // If not provided, appends to end
  notes?: string;
  customerPO?: string;
  materialStatus?: string;
  lotNumber?: string;
}

/**
 * Product update input (partial)
 */
export interface UpdateProductInput {
  customer?: string;
  productText?: string;
  quantity?: number;
  length?: number;
  balanceQuantity?: number;
  requestedShipDate?: string;
  setupMinutes?: number;
  uph?: number;
  cut?: boolean;
  extrusion?: boolean;
  ground?: boolean;
  drawing?: string;
  ends?: EndsType;
  workCenter?: string;
  priority?: number;
  scheduleLocked?: boolean;
  lockReason?: string | null;
  notes?: string;
  customerPO?: string;
  materialStatus?: string;
  lotNumber?: string;
}

/**
 * Product list filters
 */
export interface ProductFilters {
  workCenter?: string;
  scheduleStatus?: ScheduleStatus;
  scheduleLocked?: boolean;
  search?: string;             // Search in jobNumber, customer, productText
  startDate?: string;          // Filter by scheduled start >= date
  endDate?: string;            // Filter by scheduled end <= date
}

/**
 * Paginated product list response
 */
export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
