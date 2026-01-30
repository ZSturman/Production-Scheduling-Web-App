'use client';

import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type SortField = 'jobNumber' | 'customer' | 'priority' | 'workCenter' | 'scheduleStatus' | 'requestedShipDate';
type SortDirection = 'asc' | 'desc';

interface Product {
  jobNumber: string;
  customer: string;
  productText: string;
  workCenter: string;
  priority: number;
  requestedShipDate: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduleStatus: string;
  scheduleLocked: boolean;
  lockReason?: string;
}

function StatusBadge({ status }: { status: string }) {
  const className = {
    'On-Time': 'status-badge on-time',
    'At-Risk': 'status-badge at-risk',
    'Late': 'status-badge late',
    'Unscheduled': 'status-badge unscheduled',
  }[status] || 'status-badge unscheduled';

  return <span className={className}>{status}</span>;
}

export default function ProductsPage() {
  const { products, workCenters, updateProduct, lockProduct, unlockProduct, loading } = useData();
  const { isPlanner } = useAuth();
  
  const [search, setSearch] = useState('');
  const [workCenterFilter, setWorkCenterFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [priorityValue, setPriorityValue] = useState('');
  const [lockModalOpen, setLockModalOpen] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState('');

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...(products as Product[])];
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.jobNumber.toLowerCase().includes(searchLower) ||
          p.customer.toLowerCase().includes(searchLower) ||
          p.productText.toLowerCase().includes(searchLower)
      );
    }
    
    // Work center filter
    if (workCenterFilter) {
      result = result.filter((p) => p.workCenter === workCenterFilter);
    }
    
    // Status filter
    if (statusFilter) {
      result = result.filter((p) => p.scheduleStatus === statusFilter);
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortField] as string | number;
      let bVal: string | number = b[sortField] as string | number;
      
      // Handle null/undefined
      if (aVal == null) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal == null) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [products, search, workCenterFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handlePrioritySubmit = async (jobNumber: string) => {
    const newPriority = parseInt(priorityValue, 10);
    if (isNaN(newPriority) || newPriority < 1) {
      toast.error('Priority must be a positive number');
      return;
    }
    
    try {
      await updateProduct(jobNumber, { priority: newPriority });
      setEditingPriority(null);
    } catch {
      // Error handled in context
    }
  };

  const handleLockSubmit = async () => {
    if (!lockModalOpen) return;
    try {
      await lockProduct(lockModalOpen, lockReason || 'Manually locked');
      setLockModalOpen(null);
      setLockReason('');
    } catch {
      // Error handled in context
    }
  };

  const handleUnlock = async (jobNumber: string) => {
    try {
      await unlockProduct(jobNumber);
    } catch {
      // Error handled in context
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDownIcon className="h-4 w-4 inline ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-500">
          {filteredProducts.length} of {products.length} products
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Work Center */}
          <select
            value={workCenterFilter}
            onChange={(e) => setWorkCenterFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Work Centers</option>
            {workCenters.map((wc) => (
              <option key={wc.id} value={wc.id}>
                {wc.name}
              </option>
            ))}
          </select>
          
          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="On-Time">On-Time</option>
            <option value="At-Risk">At-Risk</option>
            <option value="Late">Late</option>
            <option value="Unscheduled">Unscheduled</option>
          </select>
          
          {/* Clear filters */}
          {(search || workCenterFilter || statusFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setWorkCenterFilter('');
                setStatusFilter('');
              }}
              className="text-blue-600 hover:underline text-sm"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden" data-tour="products-table">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('jobNumber')} className="cursor-pointer">
                  Job # <SortIcon field="jobNumber" />
                </th>
                <th onClick={() => handleSort('customer')} className="cursor-pointer">
                  Customer <SortIcon field="customer" />
                </th>
                <th>Product</th>
                <th onClick={() => handleSort('workCenter')} className="cursor-pointer">
                  Work Center <SortIcon field="workCenter" />
                </th>
                <th onClick={() => handleSort('priority')} className="cursor-pointer">
                  Priority <SortIcon field="priority" />
                </th>
                <th onClick={() => handleSort('requestedShipDate')} className="cursor-pointer">
                  Due Date <SortIcon field="requestedShipDate" />
                </th>
                <th>Scheduled</th>
                <th onClick={() => handleSort('scheduleStatus')} className="cursor-pointer">
                  Status <SortIcon field="scheduleStatus" />
                </th>
                <th>Lock</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.jobNumber}>
                  <td className="font-medium">{product.jobNumber}</td>
                  <td>{product.customer}</td>
                  <td className="max-w-xs truncate" title={product.productText}>
                    {product.productText}
                  </td>
                  <td>
                    {isPlanner ? (
                      <select
                        value={product.workCenter}
                        onChange={(e) =>
                          updateProduct(product.jobNumber, { workCenter: e.target.value })
                        }
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {workCenters.map((wc) => (
                          <option key={wc.id} value={wc.id}>
                            {wc.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      product.workCenter
                    )}
                  </td>
                  <td>
                    {isPlanner && editingPriority === product.jobNumber ? (
                      <input
                        type="number"
                        min="1"
                        value={priorityValue}
                        onChange={(e) => setPriorityValue(e.target.value)}
                        onBlur={() => handlePrioritySubmit(product.jobNumber)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePrioritySubmit(product.jobNumber);
                          if (e.key === 'Escape') setEditingPriority(null);
                        }}
                        autoFocus
                        className="priority-input"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          if (isPlanner) {
                            setEditingPriority(product.jobNumber);
                            setPriorityValue(String(product.priority));
                          }
                        }}
                        className={`px-2 py-1 rounded ${
                          isPlanner ? 'hover:bg-gray-100 cursor-pointer' : ''
                        }`}
                        disabled={!isPlanner}
                      >
                        {product.priority}
                      </button>
                    )}
                  </td>
                  <td>{product.requestedShipDate}</td>
                  <td className="text-xs">
                    {product.scheduledStart && product.scheduledEnd ? (
                      <>
                        <div>{product.scheduledStart.split('T')[0]}</div>
                        <div className="text-gray-400">to</div>
                        <div>{product.scheduledEnd.split('T')[0]}</div>
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={product.scheduleStatus} />
                  </td>
                  <td>
                    {isPlanner ? (
                      product.scheduleLocked ? (
                        <button
                          onClick={() => handleUnlock(product.jobNumber)}
                          className="btn-icon text-yellow-600"
                          title={product.lockReason || 'Locked'}
                        >
                          <LockClosedIcon className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setLockModalOpen(product.jobNumber)}
                          className="btn-icon text-gray-400 hover:text-gray-600"
                          title="Lock schedule"
                        >
                          <LockOpenIcon className="h-5 w-5" />
                        </button>
                      )
                    ) : product.scheduleLocked ? (
                      <LockClosedIcon className="h-5 w-5 text-yellow-600" />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lock Modal */}
      {lockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Lock Schedule</h3>
            <p className="text-gray-600 text-sm mb-4">
              Locking this schedule will prevent it from being changed during recalculation.
            </p>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Reason for locking (optional)"
              className="w-full border rounded-lg px-3 py-2 mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setLockModalOpen(null);
                  setLockReason('');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleLockSubmit} className="btn btn-primary">
                Lock Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
