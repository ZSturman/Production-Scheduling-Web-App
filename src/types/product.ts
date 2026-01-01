import { EndsType, ScheduleStatus } from './enums';

/**
 * Product/Job data model
 */
export interface Product {
  jobNumber: string;
  customer: string;
  productText: string;
  quantity: number;
  length: number;
  balanceQuantity: number;
  requestedShipDate: string;
  setupMinutes: number;
  uph: number;
  cut: boolean;
  extrusion: boolean;
  ground: boolean;
  drawing: string;
  ends: EndsType;
  workCenter: string;
  priority: number;
  priorityUpdatedAt: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleStatus: ScheduleStatus;
  scheduleLocked: boolean;
  lockReason: string | null;
  rowIndex: number;
  rowHash: string;
  notes?: string;
  customerPO?: string;
  materialStatus?: string;
  lotNumber?: string;
  [key: string]: unknown;
}

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
  priority?: number;
  notes?: string;
  customerPO?: string;
  materialStatus?: string;
  lotNumber?: string;
}

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

export interface ProductFilters {
  workCenter?: string;
  scheduleStatus?: ScheduleStatus;
  scheduleLocked?: boolean;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
