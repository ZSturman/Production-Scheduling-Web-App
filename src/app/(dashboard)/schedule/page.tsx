'use client';

import { useEffect, useRef, useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { FunnelIcon } from '@heroicons/react/24/outline';

// Gantt chart data type
interface GanttData {
  startDate: string;
  endDate: string;
  totalTasks: number;
  workCenters: {
    id: string;
    name: string;
    tasks: {
      id: string;
      name: string;
      customer: string;
      start: string;
      end: string;
      dueDate: string;
      priority: number;
      totalHours: number;
      status: string;
      isLocked: boolean;
    }[];
  }[];
}

// Simple Gantt chart component
function GanttChart({ data }: { data: GanttData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate date range
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  // Generate date headers
  const dates: Date[] = [];
  for (let i = 0; i < Math.min(totalDays, 90); i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On-Time': return 'bg-green-500';
      case 'At-Risk': return 'bg-yellow-500';
      case 'Late': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getTaskPosition = (task: GanttData['workCenters'][0]['tasks'][0]) => {
    const taskStart = new Date(task.start);
    const taskEnd = new Date(task.end);
    const left = Math.max(0, (taskStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const width = Math.max(1, (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60 * 60 * 24));
    return { left: left * 40, width: width * 40 }; // 40px per day
  };

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <div style={{ minWidth: dates.length * 40 + 250 }}>
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
          <div className="w-[250px] min-w-[250px] px-4 py-2 font-medium text-gray-700 border-r">
            Work Center / Job
          </div>
          <div className="flex">
            {dates.map((date, i) => (
              <div
                key={i}
                className="w-10 text-center text-xs text-gray-500 py-2 border-r border-gray-100"
              >
                <div>{date.getDate()}</div>
                <div className="text-[10px]">
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Work Centers and Tasks */}
        {data.workCenters.map((wc) => (
          <div key={wc.id}>
            {/* Work Center Header */}
            <div className="flex border-b border-gray-200 bg-blue-50">
              <div className="w-[250px] min-w-[250px] px-4 py-2 font-medium text-blue-900">
                {wc.name} ({wc.tasks.length})
              </div>
              <div className="flex-1" />
            </div>

            {/* Tasks */}
            {wc.tasks.map((task) => {
              const { left, width } = getTaskPosition(task);
              return (
                <div
                  key={task.id}
                  className="flex border-b border-gray-100 hover:bg-gray-50 group"
                >
                  <div className="w-[250px] min-w-[250px] px-4 py-2 flex items-center gap-2">
                    <span className="text-sm text-gray-900 truncate" title={task.name}>
                      {task.isLocked && '🔒 '}
                      {task.id}: {task.customer}
                    </span>
                  </div>
                  <div className="relative flex-1 h-10">
                    {/* Day grid lines */}
                    {dates.map((_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 w-10 border-r border-gray-100"
                        style={{ left: i * 40 }}
                      />
                    ))}
                    {/* Task bar */}
                    <div
                      className={`absolute top-1 h-8 rounded ${getStatusColor(task.status)} ${
                        task.isLocked ? 'opacity-70' : ''
                      } cursor-pointer transition-all hover:opacity-80`}
                      style={{ left, width: Math.max(width, 20) }}
                      title={`${task.name}\nPriority: ${task.priority}\nStatus: ${task.status}\nDue: ${task.dueDate}\nHours: ${task.totalHours}`}
                    >
                      <span className="text-xs text-white px-1 truncate block leading-8">
                        P{task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { ganttData, workCenters, refreshGantt, loading } = useData();
  const [filters, setFilters] = useState({
    workCenters: [] as string[],
    showLocked: true,
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    refreshGantt({
      workCenters: filters.workCenters.join(',') || undefined,
      showLocked: String(filters.showLocked),
    } as Record<string, string>);
  }, [filters, refreshGantt]);

  if (loading || !ganttData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-500">
            {ganttData.totalTasks} scheduled jobs across {ganttData.workCenters.length} work centers
          </p>
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-secondary btn-sm"
        >
          <FunnelIcon className="h-4 w-4 mr-1" />
          Filters
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Centers
              </label>
              <div className="flex flex-wrap gap-2">
                {workCenters.map((wc) => (
                  <button
                    key={wc.id}
                    onClick={() => {
                      setFilters((prev) => ({
                        ...prev,
                        workCenters: prev.workCenters.includes(wc.id)
                          ? prev.workCenters.filter((id) => id !== wc.id)
                          : [...prev.workCenters, wc.id],
                      }));
                    }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      filters.workCenters.includes(wc.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {wc.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.showLocked}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, showLocked: e.target.checked }))
                  }
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Show locked jobs</span>
              </label>
            </div>
          </div>
          
          {filters.workCenters.length > 0 && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, workCenters: [] }))}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Clear work center filter
            </button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-green-500 rounded" />
          <span className="text-gray-600">On-Time</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-500 rounded" />
          <span className="text-gray-600">At-Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-red-500 rounded" />
          <span className="text-gray-600">Late</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🔒</span>
          <span className="text-gray-600">Locked</span>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="card p-0 overflow-hidden">
        {ganttData.workCenters.length > 0 ? (
          <GanttChart data={ganttData as GanttData} />
        ) : (
          <div className="p-8 text-center text-gray-500">
            No scheduled jobs to display.
            {filters.workCenters.length > 0 && (
              <span> Try adjusting your filters.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
