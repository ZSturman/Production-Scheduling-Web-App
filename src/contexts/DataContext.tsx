'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { productsApi, workCentersApi, scheduleApi, syncApi, settingsApi, organizationsApi } from '@/lib/api';
import { useAuth } from './AuthContext';

// Types (simplified versions of shared types)
interface Product {
  jobNumber: string;
  customer: string;
  productText: string;
  quantity: number;
  balanceQuantity: number;
  requestedShipDate: string;
  setupMinutes: number;
  uph: number;
  workCenter: string;
  priority: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleStatus: 'On-Time' | 'At-Risk' | 'Late' | 'Unscheduled';
  scheduleLocked: boolean;
  lockReason: string | null;
  rowIndex: number;
  [key: string]: unknown;
}

interface WorkCenter {
  id: string;
  name: string;
  type: string;
  active: boolean;
  jobCount?: number;
  lockedJobCount?: number;
  [key: string]: unknown;
}

interface GanttData {
  workCenters: {
    id: string;
    name: string;
    tasks: GanttTask[];
  }[];
  startDate: string;
  endDate: string;
  totalTasks: number;
  lockedTasksAffected: number;
}

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  workCenter: string;
  workCenterName: string;
  priority: number;
  status: 'On-Time' | 'At-Risk' | 'Late' | 'Unscheduled';
  dueDate: string;
  isLocked: boolean;
  lockReason: string | null;
  customer: string;
  productText: string;
  quantity: number;
  balanceQuantity: number;
  totalHours: number;
}

interface Settings {
  atRiskBufferDays: number;
  syncIntervalSeconds: number;
  ganttRefreshMinutes: number;
  defaultPriorityPosition: 'end' | 'start';
  minGanttDisplayHours: number;
}

interface ScheduleSummary {
  totalProducts: number;
  scheduledProducts: number;
  unscheduledProducts: number;
  lockedProducts: number;
  onTime: number;
  atRisk: number;
  late: number;
  workCenters: {
    id: string;
    name: string;
    totalJobs: number;
    scheduledJobs: number;
    lockedJobs: number;
  }[];
}

interface OrgInfo {
  organization: {
    id: string;
    name: string;
    configStatus: string;
    memberCount: number;
  } | null;
  configStatus: string;
  googleSheetsConfigured: boolean;
}

interface DataContextType {
  // Data
  products: Product[];
  workCenters: WorkCenter[];
  ganttData: GanttData | null;
  settings: Settings | null;
  summary: ScheduleSummary | null;
  orgInfo: OrgInfo | null;
  
  // Loading states
  loading: boolean;
  syncing: boolean;
  recalculating: boolean;
  orgConfigured: boolean;
  
  // Notifications
  lockedJobsAffected: number;
  
  // Actions
  refreshProducts: () => Promise<void>;
  refreshWorkCenters: () => Promise<void>;
  refreshGantt: (filters?: Record<string, string>) => Promise<void>;
  refreshSummary: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshOrgInfo: () => Promise<void>;
  refreshAll: () => Promise<void>;
  
  // Product actions
  updateProduct: (jobNumber: string, data: Partial<Product>) => Promise<void>;
  lockProduct: (jobNumber: string, reason: string) => Promise<void>;
  unlockProduct: (jobNumber: string) => Promise<void>;
  reorderProducts: (workCenter: string, orderedJobNumbers: string[]) => Promise<void>;
  
  // Schedule actions
  recalculateSchedule: () => Promise<void>;
  triggerSync: () => Promise<void>;
  
  // Settings actions
  updateSettings: (data: Partial<Settings>) => Promise<void>;
  
  // Clear notification
  clearLockedJobsNotification: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, hasOrg } = useAuth();
  
  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [ganttData, setGanttData] = useState<GanttData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  // Notifications
  const [lockedJobsAffected, setLockedJobsAffected] = useState(0);

  // Check if org is configured
  const orgConfigured = orgInfo?.googleSheetsConfigured ?? false;

  // Refresh functions
  const refreshOrgInfo = useCallback(async () => {
    if (!user) return;
    try {
      const response = await organizationsApi.getMe();
      setOrgInfo(response.data.data);
    } catch (error: unknown) {
      // User might not be in an org yet - that's okay
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status !== 404) {
        console.error('Failed to fetch org info:', error);
      }
      setOrgInfo(null);
    }
  }, [user]);

  const refreshProducts = useCallback(async () => {
    if (!orgConfigured) return;
    try {
      const response = await productsApi.list();
      setProducts(response.data.data.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    }
  }, [orgConfigured]);

  const refreshWorkCenters = useCallback(async () => {
    if (!orgConfigured) return;
    try {
      const response = await workCentersApi.list();
      setWorkCenters(response.data.data.workCenters);
    } catch (error) {
      console.error('Failed to fetch work centers:', error);
      toast.error('Failed to load work centers');
    }
  }, [orgConfigured]);

  const refreshGantt = useCallback(async (filters?: Record<string, string>) => {
    if (!orgConfigured) return;
    try {
      const response = await scheduleApi.getGantt(filters);
      setGanttData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch gantt data:', error);
      toast.error('Failed to load schedule');
    }
  }, [orgConfigured]);

  const refreshSummary = useCallback(async () => {
    if (!orgConfigured) return;
    try {
      const response = await scheduleApi.getSummary();
      setSummary(response.data.data);
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, [orgConfigured]);

  const refreshSettings = useCallback(async () => {
    if (!orgConfigured) return;
    try {
      const response = await settingsApi.get();
      setSettings(response.data.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  }, [orgConfigured]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await refreshOrgInfo();
      
      if (orgConfigured) {
        await Promise.all([
          refreshProducts(),
          refreshWorkCenters(),
          refreshGantt(),
          refreshSummary(),
          refreshSettings(),
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshOrgInfo, orgConfigured, refreshProducts, refreshWorkCenters, refreshGantt, refreshSummary, refreshSettings]);

  // Product actions
  const updateProduct = useCallback(async (jobNumber: string, data: Partial<Product>) => {
    try {
      await productsApi.update(jobNumber, data);
      await refreshProducts();
      toast.success('Product updated');
    } catch (error) {
      console.error('Failed to update product:', error);
      toast.error('Failed to update product');
      throw error;
    }
  }, [refreshProducts]);

  const lockProduct = useCallback(async (jobNumber: string, reason: string) => {
    try {
      await productsApi.lock(jobNumber, reason);
      await refreshProducts();
      toast.success('Schedule locked');
    } catch (error) {
      console.error('Failed to lock product:', error);
      toast.error('Failed to lock schedule');
      throw error;
    }
  }, [refreshProducts]);

  const unlockProduct = useCallback(async (jobNumber: string) => {
    try {
      await productsApi.unlock(jobNumber);
      await refreshProducts();
      toast.success('Schedule unlocked');
    } catch (error) {
      console.error('Failed to unlock product:', error);
      toast.error('Failed to unlock schedule');
      throw error;
    }
  }, [refreshProducts]);

  const reorderProducts = useCallback(async (workCenter: string, orderedJobNumbers: string[]) => {
    try {
      await productsApi.reorder(workCenter, orderedJobNumbers);
      await refreshProducts();
      toast.success('Priorities updated');
    } catch (error) {
      console.error('Failed to reorder products:', error);
      toast.error('Failed to update priorities');
      throw error;
    }
  }, [refreshProducts]);

  // Schedule actions
  const recalculateSchedule = useCallback(async () => {
    setRecalculating(true);
    try {
      const response = await scheduleApi.recalculate();
      const result = response.data.data;
      
      if (result.lockedJobsAffected > 0) {
        setLockedJobsAffected(result.lockedJobsAffected);
        toast(`${result.lockedJobsAffected} locked job(s) would have been affected`, {
          icon: '🔒',
          duration: 5000,
        });
      }
      
      await Promise.all([refreshProducts(), refreshGantt(), refreshSummary()]);
      toast.success(`Schedule recalculated: ${result.jobsScheduled} jobs`);
    } catch (error) {
      console.error('Failed to recalculate schedule:', error);
      toast.error('Failed to recalculate schedule');
      throw error;
    } finally {
      setRecalculating(false);
    }
  }, [refreshProducts, refreshGantt, refreshSummary]);

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncApi.trigger();
      await refreshAll();
      toast.success('Data synced from Google Sheets');
    } catch (error) {
      console.error('Failed to sync:', error);
      toast.error('Failed to sync data');
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [refreshAll]);

  // Settings actions
  const updateSettings = useCallback(async (data: Partial<Settings>) => {
    try {
      const response = await settingsApi.update(data);
      setSettings(response.data.data);
      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
      throw error;
    }
  }, []);

  // Clear notification
  const clearLockedJobsNotification = useCallback(() => {
    setLockedJobsAffected(0);
  }, []);

  // Initial load
  useEffect(() => {
    if (user) {
      refreshOrgInfo().then(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user, refreshOrgInfo]);

  // Load data when org is configured
  useEffect(() => {
    if (user && orgConfigured) {
      setLoading(true);
      Promise.all([
        refreshProducts(),
        refreshWorkCenters(),
        refreshGantt(),
        refreshSummary(),
        refreshSettings(),
      ]).finally(() => setLoading(false));
    }
  }, [user, orgConfigured, refreshProducts, refreshWorkCenters, refreshGantt, refreshSummary, refreshSettings]);

  // Polling when org is configured
  useEffect(() => {
    if (user && orgConfigured) {
      const pollInterval = (settings?.syncIntervalSeconds || 60) * 1000;
      const intervalId = setInterval(() => {
        refreshProducts();
        refreshSummary();
      }, pollInterval);
      
      return () => clearInterval(intervalId);
    }
  }, [user, orgConfigured, settings?.syncIntervalSeconds, refreshProducts, refreshSummary]);

  const value: DataContextType = {
    products,
    workCenters,
    ganttData,
    settings,
    summary,
    orgInfo,
    loading,
    syncing,
    recalculating,
    orgConfigured,
    lockedJobsAffected,
    refreshProducts,
    refreshWorkCenters,
    refreshGantt,
    refreshSummary,
    refreshSettings,
    refreshOrgInfo,
    refreshAll,
    updateProduct,
    lockProduct,
    unlockProduct,
    reorderProducts,
    recalculateSchedule,
    triggerSync,
    updateSettings,
    clearLockedJobsNotification,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
