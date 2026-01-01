'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { organizationsApi, configApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BuildingOfficeIcon,
  TableCellsIcon,
  UserGroupIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

type Step = 'org' | 'sheets' | 'invite' | 'complete';

interface StepConfig {
  id: Step;
  name: string;
  icon: React.ElementType;
}

const steps: StepConfig[] = [
  { id: 'org', name: 'Organization', icon: BuildingOfficeIcon },
  { id: 'sheets', name: 'Google Sheets', icon: TableCellsIcon },
  { id: 'invite', name: 'Invite Team', icon: UserGroupIcon },
  { id: 'complete', name: 'Complete', icon: CheckCircleIcon },
];

export default function SetupPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin, refreshToken } = useAuth();
  const { orgInfo, loading: dataLoading, refreshOrgInfo } = useData();
  
  const [currentStep, setCurrentStep] = useState<Step>('org');
  const [submitting, setSubmitting] = useState(false);
  
  // Org step state
  const [orgName, setOrgName] = useState('');
  
  // Sheets step state
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    spreadsheetName?: string;
    error?: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  
  // Invite step state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'planner' | 'admin'>('planner');
  const [sentInvites, setSentInvites] = useState<string[]>([]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login?returnTo=/setup');
    }
  }, [user, authLoading, router]);

  // Determine current step based on org state
  useEffect(() => {
    if (dataLoading || !user) return;

    if (!orgInfo?.organization) {
      setCurrentStep('org');
    } else if (orgInfo.configStatus !== 'configured') {
      setCurrentStep('sheets');
    } else {
      // Already configured - either show invite or redirect
      setCurrentStep('invite');
    }
  }, [orgInfo, dataLoading, user]);

  // Handle file upload for service account
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setServiceAccountJson(content);
      setTestResult(null);
    };
    reader.readAsText(file);
  }, []);

  // Create organization
  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      toast.error('Please enter an organization name');
      return;
    }

    setSubmitting(true);
    try {
      await organizationsApi.create(orgName.trim());
      await refreshToken(); // Refresh token to get updated claims
      await refreshOrgInfo();
      toast.success('Organization created!');
      setCurrentStep('sheets');
    } catch (error) {
      console.error('Failed to create org:', error);
      toast.error('Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  // Test Google Sheets connection
  const handleTestConnection = async () => {
    if (!spreadsheetId.trim()) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }
    if (!serviceAccountJson.trim()) {
      toast.error('Please upload a service account JSON file');
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const response = await configApi.testGoogleSheets(spreadsheetId.trim(), serviceAccountJson);
      setTestResult(response.data.data);
      if (response.data.data.success) {
        toast.success(`Connected to "${response.data.data.spreadsheetName}"`);
      } else {
        toast.error(response.data.data.error || 'Connection failed');
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      setTestResult({ success: false, error: 'Failed to test connection' });
      toast.error('Failed to test connection');
    } finally {
      setTesting(false);
    }
  };

  // Save Google Sheets configuration
  const handleSaveConfig = async () => {
    if (!testResult?.success) {
      toast.error('Please test the connection first');
      return;
    }

    setSubmitting(true);
    try {
      await configApi.saveGoogleSheets(spreadsheetId.trim(), serviceAccountJson);
      await refreshOrgInfo();
      toast.success('Google Sheets configured!');
      setCurrentStep('invite');
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSubmitting(false);
    }
  };

  // Send invite
  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }

    setSubmitting(true);
    try {
      const response = await organizationsApi.invite(inviteEmail.trim(), inviteRole);
      setSentInvites([...sentInvites, inviteEmail.trim()]);
      setInviteEmail('');
      toast.success(`Invite sent to ${inviteEmail}`);
      
      // Show the invite link (in production this would be emailed)
      const inviteLink = response.data.data.inviteLink;
      toast((t) => (
        <div>
          <p className="font-medium">Invite link:</p>
          <p className="text-xs break-all">{inviteLink}</p>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              toast.dismiss(t.id);
              toast.success('Link copied!');
            }}
            className="mt-2 text-blue-600 text-sm"
          >
            Copy link
          </button>
        </div>
      ), { duration: 10000 });
    } catch (error) {
      console.error('Failed to send invite:', error);
      toast.error('Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  };

  // Complete setup
  const handleComplete = () => {
    router.replace('/dashboard');
  };

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner" />
      </div>
    );
  }

  // Non-admin users in an unconfigured org see waiting screen
  if (orgInfo?.organization && orgInfo.configStatus !== 'configured' && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="card p-8 text-center">
            <ExclamationCircleIcon className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Setup Required
            </h1>
            <p className="text-gray-600 mb-6">
              Your organization administrator needs to complete the Google Sheets setup 
              before you can use the scheduler.
            </p>
            <p className="text-sm text-gray-500">
              Organization: <strong>{orgInfo.organization.name}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Progress steps */}
        <nav className="mb-8">
          <ol className="flex items-center justify-between">
            {steps.map((step, index) => {
              const stepIndex = steps.findIndex(s => s.id === currentStep);
              const isComplete = index < stepIndex;
              const isCurrent = step.id === currentStep;
              
              return (
                <li key={step.id} className="flex items-center">
                  <div className={`flex items-center ${index > 0 ? 'flex-1' : ''}`}>
                    {index > 0 && (
                      <div className={`h-0.5 w-full ${isComplete ? 'bg-blue-600' : 'bg-gray-200'}`} />
                    )}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      isComplete ? 'bg-blue-600 text-white' :
                      isCurrent ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' :
                      'bg-gray-200 text-gray-400'
                    }`}>
                      {isComplete ? (
                        <CheckCircleIcon className="h-6 w-6" />
                      ) : (
                        <step.icon className="h-5 w-5" />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex justify-between mt-2">
            {steps.map((step) => (
              <span key={step.id} className="text-xs text-gray-500">
                {step.name}
              </span>
            ))}
          </div>
        </nav>

        {/* Step content */}
        <div className="card p-6">
          {/* Step 1: Organization */}
          {currentStep === 'org' && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Create Your Organization
              </h1>
              <p className="text-gray-600 mb-6">
                Organizations help you manage team access and settings.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="orgName" className="label mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Acme Manufacturing"
                    className="input"
                    disabled={submitting}
                  />
                </div>

                <button
                  onClick={handleCreateOrg}
                  disabled={submitting || !orgName.trim()}
                  className="btn btn-primary w-full"
                >
                  {submitting ? 'Creating...' : 'Create Organization'}
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Google Sheets */}
          {currentStep === 'sheets' && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Connect Google Sheets
              </h1>
              <p className="text-gray-600 mb-6">
                Link your production data spreadsheet to the scheduler.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="spreadsheetId" className="label mb-1">
                    Spreadsheet ID
                  </label>
                  <input
                    type="text"
                    id="spreadsheetId"
                    value={spreadsheetId}
                    onChange={(e) => {
                      setSpreadsheetId(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="input"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Find this in your spreadsheet URL after /d/
                  </p>
                </div>

                <div>
                  <label className="label mb-1">
                    Service Account Key (JSON)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="serviceAccount"
                      disabled={submitting}
                    />
                    <label
                      htmlFor="serviceAccount"
                      className="cursor-pointer text-blue-600 hover:text-blue-700"
                    >
                      {serviceAccountJson ? 'File uploaded ✓' : 'Upload JSON file'}
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Create a service account in Google Cloud Console and share the spreadsheet with its email.
                  </p>
                </div>

                {testResult && (
                  <div className={`p-4 rounded-lg ${
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    {testResult.success ? (
                      <p>✓ Connected to &quot;{testResult.spreadsheetName}&quot;</p>
                    ) : (
                      <p>✗ {testResult.error}</p>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !spreadsheetId || !serviceAccountJson}
                    className="btn btn-secondary flex-1"
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={submitting || !testResult?.success}
                    className="btn btn-primary flex-1"
                  >
                    {submitting ? 'Saving...' : 'Save & Continue'}
                    <ArrowRightIcon className="h-4 w-4 ml-2" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Invite Team */}
          {currentStep === 'invite' && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Invite Your Team
              </h1>
              <p className="text-gray-600 mb-6">
                Add team members who need access to the scheduler. You can skip this and invite later.
              </p>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      className="input"
                      disabled={submitting}
                    />
                  </div>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'viewer' | 'planner' | 'admin')}
                    className="input w-32"
                    disabled={submitting}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="planner">Planner</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleSendInvite}
                    disabled={submitting || !inviteEmail}
                    className="btn btn-secondary"
                  >
                    Send
                  </button>
                </div>

                {sentInvites.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Invites sent:</p>
                    <ul className="space-y-1">
                      {sentInvites.map((email) => (
                        <li key={email} className="text-sm text-gray-600 flex items-center gap-2">
                          <CheckCircleIcon className="h-4 w-4 text-green-500" />
                          {email}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={handleComplete}
                  className="btn btn-primary w-full"
                >
                  {sentInvites.length > 0 ? 'Continue to Dashboard' : 'Skip & Continue'}
                  <ArrowRightIcon className="h-4 w-4 ml-2" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
