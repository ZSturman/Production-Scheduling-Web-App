'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { configApi, sheetsHealthApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  ClockIcon,
  TableCellsIcon,
  QuestionMarkCircleIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  UserGroupIcon,
  EnvelopeIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { RestartTourButton } from '@/components/GuidedTour';
import type { SheetsHealth, SheetsConfigHistory } from '@/types/settings';
import type { OrganizationMember, OrganizationInvite } from '@/types/organization';

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSettings, loading, orgInfo, sheetsHealth, refreshSheetsHealth } = useData();
  const { isAdmin } = useAuth();
  
  const [formData, setFormData] = useState({
    atRiskBufferDays: 2,
    syncIntervalSeconds: 60,
    defaultPriorityPosition: 'end' as 'end' | 'start',
  });
  const [saving, setSaving] = useState(false);

  // Sheets config state
  const [sheetsConfig, setSheetsConfig] = useState<{
    spreadsheetId?: string;
    spreadsheetTitle?: string;
    configured: boolean;
    configHistory?: SheetsConfigHistory[];
    currentConfig?: {
      sheetNames?: Record<string, string>;
      lastUpdated?: string;
    };
  }>({ configured: false });
  const [loadingSheetsConfig, setLoadingSheetsConfig] = useState(true);
  const [rollingBack, setRollingBack] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [editingSpreadsheetId, setEditingSpreadsheetId] = useState(false);
  const [newSpreadsheetId, setNewSpreadsheetId] = useState('');
  const [savingSpreadsheetId, setSavingSpreadsheetId] = useState(false);

  // Members state
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<OrganizationInvite[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'planner' | 'admin'>('viewer');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Update form when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        atRiskBufferDays: settings.atRiskBufferDays || 2,
        syncIntervalSeconds: settings.syncIntervalSeconds || 60,
        defaultPriorityPosition: settings.defaultPriorityPosition || 'end',
      });
    }
  }, [settings]);

  // Load sheets config
  useEffect(() => {
    async function loadSheetsConfig() {
      try {
        const response = await configApi.getGoogleSheets();
        if (response.data.data) {
          setSheetsConfig({
            spreadsheetId: response.data.data.spreadsheetId,
            spreadsheetTitle: response.data.data.spreadsheetTitle,
            configured: true,
            configHistory: response.data.data.configHistory || [],
            currentConfig: {
              sheetNames: response.data.data.sheetNames,
              lastUpdated: response.data.data.lastUpdated,
            },
          });
        }
      } catch {
        // No config yet
      } finally {
        setLoadingSheetsConfig(false);
      }
    }
    loadSheetsConfig();
  }, []);

  // Load members and invites
  useEffect(() => {
    async function loadMembers() {
      try {
        const response = await fetch('/api/organizations');
        const data = await response.json();
        if (data.success && data.data) {
          setMembers(data.data.members || []);
        }
        
        // Also load pending invites
        const invitesResponse = await fetch('/api/organizations/invites');
        const invitesData = await invitesResponse.json();
        if (invitesData.success && invitesData.data?.invites) {
          setPendingInvites(invitesData.data.invites.filter((i: OrganizationInvite) => i.status === 'pending'));
        }
      } catch (error) {
        console.error('Failed to load members:', error);
      } finally {
        setLoadingMembers(false);
      }
    }
    loadMembers();
  }, []);

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);
    try {
      await refreshSheetsHealth();
      toast.success('Sheet health refreshed');
    } catch {
      toast.error('Failed to refresh sheet health');
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleRollback = async (historyIndex: number) => {
    if (!isAdmin) {
      toast.error('Only admins can rollback configuration');
      return;
    }
    
    const historyItem = sheetsConfig.configHistory?.[historyIndex];
    if (!historyItem) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to rollback to the configuration from ${new Date(historyItem.changedAt).toLocaleString()}?\n\nThis will restore the previous sheet names and column settings.`
    );
    
    if (!confirmed) return;
    
    setRollingBack(true);
    try {
      const response = await fetch('/api/config/google-sheets/apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollbackToHistoryIndex: historyIndex,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Configuration rolled back successfully');
        // Reload config
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to rollback configuration');
      }
    } catch (error) {
      console.error('Rollback error:', error);
      toast.error('Failed to rollback configuration');
    } finally {
      setRollingBack(false);
    }
  };

  const handleUpdateSpreadsheetId = async () => {
    if (!isAdmin) {
      toast.error('Only admins can update configuration');
      return;
    }

    if (!newSpreadsheetId.trim()) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    if (newSpreadsheetId.trim() === sheetsConfig.spreadsheetId) {
      setEditingSpreadsheetId(false);
      return;
    }

    setSavingSpreadsheetId(true);
    try {
      const response = await fetch('/api/config/google-sheets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: newSpreadsheetId.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Spreadsheet ID updated successfully');
        setSheetsConfig(prev => ({
          ...prev,
          spreadsheetId: newSpreadsheetId.trim(),
          spreadsheetTitle: data.data.spreadsheetName,
        }));
        setEditingSpreadsheetId(false);
        // Refresh health after changing spreadsheet
        setTimeout(() => refreshSheetsHealth(), 1000);
      } else {
        toast.error(data.error?.message || 'Failed to update spreadsheet ID');
      }
    } catch (error) {
      console.error('Update spreadsheet ID error:', error);
      toast.error('Failed to update spreadsheet ID');
    } finally {
      setSavingSpreadsheetId(false);
    }
  };

  const startEditingSpreadsheetId = () => {
    setNewSpreadsheetId(sheetsConfig.spreadsheetId || '');
    setEditingSpreadsheetId(true);
  };

  const cancelEditingSpreadsheetId = () => {
    setEditingSpreadsheetId(false);
    setNewSpreadsheetId('');
  };

  const handleSendInvite = async () => {
    if (!isAdmin) {
      toast.error('Only admins can send invites');
      return;
    }

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    setSendingInvite(true);
    try {
      const response = await fetch('/api/organizations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Invite sent to ${inviteEmail}`);
        setInviteEmail('');
        
        // Show invite link
        if (data.data?.inviteLink) {
          toast((t) => (
            <div>
              <p className="font-medium">Invite link:</p>
              <p className="text-xs break-all">{data.data.inviteLink}</p>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(data.data.inviteLink);
                  toast.dismiss(t.id);
                  toast.success('Link copied!');
                }}
                className="mt-2 text-blue-600 text-sm"
              >
                Copy link
              </button>
            </div>
          ), { duration: 10000 });
        }
        
        // Refresh pending invites
        const invitesResponse = await fetch('/api/organizations/invites');
        const invitesData = await invitesResponse.json();
        if (invitesData.success && invitesData.data?.invites) {
          setPendingInvites(invitesData.data.invites.filter((i: OrganizationInvite) => i.status === 'pending'));
        }
      } else {
        toast.error(data.error?.message || 'Failed to send invite');
      }
    } catch (error) {
      console.error('Send invite error:', error);
      toast.error('Failed to send invite');
    } finally {
      setSendingInvite(false);
    }
  };

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
    <div className="space-y-6 max-w-2xl" data-tour="settings-panel">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Configure scheduling parameters</p>
      </div>

      {/* Organization Info */}
      {orgInfo && (
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-2">Organization</h3>
          <p className="text-gray-600">{orgInfo.organization?.name}</p>
        </div>
      )}

      {/* Members Management */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserGroupIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Team Members</h3>
          </div>
        </div>

        {loadingMembers ? (
          <div className="flex justify-center py-4">
            <div className="spinner" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Members List */}
            <div className="space-y-2">
              {members.map((member) => (
                <div 
                  key={member.uid}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-700 font-medium text-sm">
                        {(member.displayName || member.email)?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {member.displayName || member.email}
                      </p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        member.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        member.role === 'planner' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {member.role}
                      </span>
                      {member.lastLogin && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last active: {new Date(member.lastLogin).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <EnvelopeIcon className="h-4 w-4" />
                  Pending Invites
                </p>
                <div className="space-y-2">
                  {pendingInvites.map((invite) => (
                    <div 
                      key={invite.id}
                      className="flex items-center justify-between py-2 px-3 bg-yellow-50 rounded-lg border border-yellow-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <EnvelopeIcon className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{invite.email}</p>
                          <p className="text-xs text-gray-500">
                            Sent {new Date(invite.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        invite.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        invite.role === 'planner' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {invite.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite Form */}
            {isAdmin && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <UserPlusIcon className="h-4 w-4" />
                  Invite New Member
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
                    disabled={sendingInvite}
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'planner' | 'admin')}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-2"
                    disabled={sendingInvite}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="planner">Planner</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleSendInvite}
                    disabled={sendingInvite || !inviteEmail}
                    className="btn btn-primary text-sm"
                  >
                    {sendingInvite ? 'Sending...' : 'Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Sheets Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TableCellsIcon className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Google Sheets Configuration</h3>
          </div>
          <div className="flex items-center gap-2">
            {sheetsConfig.configured && (
              <button
                onClick={handleRefreshHealth}
                disabled={refreshingHealth}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                title="Refresh sheet health status"
              >
                <ArrowPathIcon className={`h-4 w-4 ${refreshingHealth ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => router.push('/setup/sheets')}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <Cog6ToothIcon className="h-4 w-4" />
                Configure Sheets
              </button>
            )}
          </div>
        </div>
        
        {loadingSheetsConfig ? (
          <div className="flex justify-center py-4">
            <div className="spinner" />
          </div>
        ) : sheetsConfig.configured ? (
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Spreadsheet</span>
                <span className="font-medium text-gray-900">
                  {sheetsConfig.spreadsheetTitle || 'Connected'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">ID</span>
                {editingSpreadsheetId ? (
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <input
                      type="text"
                      value={newSpreadsheetId}
                      onChange={(e) => setNewSpreadsheetId(e.target.value)}
                      placeholder="Enter new spreadsheet ID"
                      className="flex-1 font-mono text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={savingSpreadsheetId}
                    />
                    <button
                      onClick={handleUpdateSpreadsheetId}
                      disabled={savingSpreadsheetId}
                      className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                      title="Save"
                    >
                      {savingSpreadsheetId ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckIcon className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={cancelEditingSpreadsheetId}
                      disabled={savingSpreadsheetId}
                      className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                      title="Cancel"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-700">
                      {sheetsConfig.spreadsheetId?.slice(0, 20)}...
                    </span>
                    {isAdmin && (
                      <button
                        onClick={startEditingSpreadsheetId}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Edit spreadsheet ID"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {sheetsConfig.currentConfig?.lastUpdated && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Last Configured</span>
                  <span className="text-sm text-gray-700">
                    {new Date(sheetsConfig.currentConfig.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Health Status */}
            {sheetsHealth && (
              <div className={`rounded-lg p-4 ${
                sheetsHealth.status === 'healthy' 
                  ? 'bg-green-50 border border-green-200'
                  : sheetsHealth.status === 'degraded'
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {sheetsHealth.status === 'healthy' ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Sheets Healthy</span>
                    </>
                  ) : (
                    <>
                      <ExclamationTriangleIcon className={`h-5 w-5 ${
                        sheetsHealth.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                      <span className={`font-medium ${
                        sheetsHealth.status === 'degraded' ? 'text-yellow-800' : 'text-red-800'
                      }`}>
                        {sheetsHealth.issues.length} Issue{sheetsHealth.issues.length !== 1 ? 's' : ''} Found
                      </span>
                    </>
                  )}
                </div>
                {sheetsHealth.issues.length > 0 && (
                  <ul className="text-sm space-y-1 ml-7">
                    {sheetsHealth.issues.slice(0, 3).map((issue, i) => (
                      <li key={i} className={
                        sheetsHealth.status === 'degraded' ? 'text-yellow-700' : 'text-red-700'
                      }>
                        {issue.message}
                      </li>
                    ))}
                    {sheetsHealth.issues.length > 3 && (
                      <li className="text-gray-500">
                        +{sheetsHealth.issues.length - 3} more issues
                      </li>
                    )}
                  </ul>
                )}
                {sheetsHealth.lastChecked && (
                  <p className="text-xs text-gray-500 mt-2 ml-7">
                    Last checked: {new Date(sheetsHealth.lastChecked).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}

            {/* Current Sheet Names */}
            {sheetsConfig.currentConfig?.sheetNames && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sheet Names</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(sheetsConfig.currentConfig.sheetNames).map(([key, name]) => (
                    <div key={key} className="flex justify-between py-1 px-2 bg-gray-50 rounded">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-mono text-gray-700">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Configuration History / Rollback */}
            {isAdmin && sheetsConfig.configHistory && sheetsConfig.configHistory.length > 0 && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <ClockIcon className="h-4 w-4 text-gray-500" />
                  <p className="text-sm font-medium text-gray-700">Configuration History</p>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sheetsConfig.configHistory.slice(0, 5).map((history, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between text-sm bg-gray-50 rounded p-2"
                    >
                      <div>
                        <span className="text-gray-700">
                          {new Date(history.changedAt).toLocaleString()}
                        </span>
                        {history.changeReason && (
                          <span className="text-gray-500 ml-2">- {history.changeReason}</span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRollback(index)}
                        disabled={rollingBack}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Rollback will restore previous sheet names and column configurations.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <TableCellsIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-3">
              No Google Sheets connection configured.
            </p>
            {isAdmin && (
              <button
                onClick={() => router.push('/setup')}
                className="btn btn-primary"
              >
                Set Up Google Sheets
              </button>
            )}
          </div>
        )}
      </div>

      {/* Scheduling Settings */}
      <form onSubmit={handleSubmit} className="card space-y-6">
        <h3 className="font-medium text-gray-900">Scheduling Settings</h3>
        
        {/* At-Risk Buffer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            At-Risk Buffer Days
          </label>
          <p className="text-sm text-gray-500 mb-2">
            Jobs scheduled to complete within this many days of their due date will be marked as &quot;At-Risk&quot;.
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
          <h3 className="font-medium text-gray-900 mb-2">📄 Google Sheets</h3>
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

      {/* Help & Tour */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <QuestionMarkCircleIcon className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Help & Tour</h3>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Need a refresher on how to use the application? Take the guided tour again to learn about all the features.
        </p>
        <RestartTourButton className="font-medium" />
      </div>
    </div>
  );
}
