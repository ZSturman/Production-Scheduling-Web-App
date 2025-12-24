import { useData } from '../contexts/DataContext';
import {
  CubeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  LockClosedIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue',
  subtitle 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType; 
  color?: string;
  subtitle?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="card">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function WorkCenterCard({ 
  name, 
  totalJobs, 
  scheduledJobs, 
  lockedJobs 
}: { 
  name: string; 
  totalJobs: number; 
  scheduledJobs: number; 
  lockedJobs: number;
}) {
  const progress = totalJobs > 0 ? (scheduledJobs / totalJobs) * 100 : 0;
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">{name}</h3>
        <span className="text-sm text-gray-500">{totalJobs} jobs</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{scheduledJobs} scheduled</span>
        {lockedJobs > 0 && (
          <span className="flex items-center gap-1">
            <LockClosedIcon className="h-3 w-3" />
            {lockedJobs} locked
          </span>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { summary, loading } = useData();

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Production schedule overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Products"
          value={summary.totalProducts}
          icon={CubeIcon}
          color="blue"
        />
        <StatCard
          title="Scheduled"
          value={summary.scheduledProducts}
          icon={ClockIcon}
          color="purple"
          subtitle={`${summary.unscheduledProducts} unscheduled`}
        />
        <StatCard
          title="On Time"
          value={summary.onTime}
          icon={CheckCircleIcon}
          color="green"
        />
        <StatCard
          title="At Risk"
          value={summary.atRisk}
          icon={ExclamationTriangleIcon}
          color="yellow"
        />
        <StatCard
          title="Late"
          value={summary.late}
          icon={XCircleIcon}
          color="red"
        />
        <StatCard
          title="Locked"
          value={summary.lockedProducts}
          icon={LockClosedIcon}
          color="gray"
        />
      </div>

      {/* Work Centers */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Work Centers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {summary.workCenters
            .filter((wc) => wc.totalJobs > 0)
            .sort((a, b) => b.totalJobs - a.totalJobs)
            .map((wc) => (
              <WorkCenterCard
                key={wc.id}
                name={wc.name}
                totalJobs={wc.totalJobs}
                scheduledJobs={wc.scheduledJobs}
                lockedJobs={wc.lockedJobs}
              />
            ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="card-header">Quick Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Status Colors</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-status-on-time rounded-full" />
                <span className="text-gray-600">On-Time: Completes before due date</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-status-at-risk rounded-full" />
                <span className="text-gray-600">At-Risk: Within buffer days of due date</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-status-late rounded-full" />
                <span className="text-gray-600">Late: Scheduled end after due date</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Priority System</h3>
            <p className="text-gray-600">
              Jobs are scheduled by priority (1 = highest). When you change a priority, 
              other jobs in the same work center automatically shift to maintain sequence.
            </p>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Schedule Locking</h3>
            <p className="text-gray-600">
              Lock a job's schedule to prevent it from being recalculated. 
              Locked jobs show a 🔒 indicator and won't change during recalculation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
