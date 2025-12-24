import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

export default function WorkCentersPage() {
  const { workCenters, loading } = useData();
  const { isAdmin } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Work Centers</h1>
          <p className="text-gray-500">
            {workCenters.filter((wc) => wc.active).length} active work centers
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workCenters.map((wc) => (
          <div
            key={wc.id}
            className={`card ${!wc.active ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{wc.name}</h3>
                <p className="text-sm text-gray-500">ID: {wc.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    wc.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {wc.active ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {wc.type || 'Other'}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Jobs:</span>
                <span className="ml-2 font-medium">{wc.jobCount || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Locked:</span>
                <span className="ml-2 font-medium">{wc.lockedJobCount || 0}</span>
              </div>
            </div>

            <button
              onClick={() => setExpandedId(expandedId === wc.id ? null : wc.id)}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              {expandedId === wc.id ? 'Hide schedule' : 'View schedule'}
            </button>

            {expandedId === wc.id && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Working Hours
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                  ].map((day) => {
                    const schedule = (wc as Record<string, unknown>).schedule as Record<
                      string,
                      { start: string; end: string } | null
                    > | undefined;
                    const daySchedule = schedule?.[day];
                    return (
                      <div key={day} className="flex justify-between">
                        <span className="capitalize text-gray-500">{day}</span>
                        <span className="font-medium">
                          {daySchedule
                            ? `${daySchedule.start} - ${daySchedule.end}`
                            : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {!isAdmin && (
        <div className="text-center text-sm text-gray-500 py-4">
          Contact an admin to add or modify work centers.
        </div>
      )}
    </div>
  );
}
