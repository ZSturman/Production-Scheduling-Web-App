import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { settings, updateSettings, loading } = useData();
  const { isAdmin } = useAuth();
  
  const [formData, setFormData] = useState({
    atRiskBufferDays: settings?.atRiskBufferDays || 2,
    syncIntervalSeconds: settings?.syncIntervalSeconds || 60,
    defaultPriorityPosition: settings?.defaultPriorityPosition || 'end',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can change settings');
      return;
    }
    
    setSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure scheduling parameters</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* At-Risk Buffer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            At-Risk Buffer Days
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Jobs scheduled to complete within this many days of their due date will be marked as "At-Risk".
          </p>
          <input
            type="number"
            min="0"
            max="30"
            value={formData.atRiskBufferDays}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                atRiskBufferDays: parseInt(e.target.value) || 0,
              }))
            }
            disabled={!isAdmin}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {/* Sync Interval */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sync Interval (seconds)
          </label>
          <p className="text-sm text-gray-500 mb-2">
            How often the app polls for changes from Google Sheets.
          </p>
          <select
            value={formData.syncIntervalSeconds}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                syncIntervalSeconds: parseInt(e.target.value),
              }))
            }
            disabled={!isAdmin}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value={30}>30 seconds</option>
            <option value={60}>1 minute</option>
            <option value={120}>2 minutes</option>
            <option value={300}>5 minutes</option>
          </select>
        </div>

        {/* Default Priority Position */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Default Priority Position
          </label>
          <p className="text-sm text-gray-500 mb-2">
            When a new product is added, where should it be placed in the priority queue?
          </p>
          <select
            value={formData.defaultPriorityPosition}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                defaultPriorityPosition: e.target.value as 'end' | 'start',
              }))
            }
            disabled={!isAdmin}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="end">End of queue (lowest priority)</option>
            <option value="start">Start of queue (highest priority)</option>
          </select>
        </div>

        {isAdmin && (
          <div className="pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </form>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2">🔗 Google Sheets</h3>
          <p className="text-sm text-gray-600">
            This app reads from and writes to your Google Sheets document.
            Changes made in the sheet are synced automatically.
          </p>
        </div>
        
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2">🔒 Roles</h3>
          <p className="text-sm text-gray-600">
            <strong>Viewer:</strong> View schedules only<br />
            <strong>Planner:</strong> Modify priorities, lock/unlock<br />
            <strong>Admin:</strong> Full access including settings
          </p>
        </div>
      </div>
    </div>
  );
}
