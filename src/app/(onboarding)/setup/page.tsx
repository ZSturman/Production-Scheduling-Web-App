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
  ArrowLeftIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  InformationCircleIcon,
  KeyIcon,
  ShareIcon,
  LinkIcon,
  CheckIcon,
  XMarkIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';

type Step = 'org' | 'sheets' | 'invite' | 'complete';
type SheetsSubStep = 'enable-api' | 'service-account' | 'upload-key' | 'share-sheet' | 'connect';

interface StepConfig {
  id: Step;
  name: string;
  icon: React.ElementType;
}

interface ValidationIssue {
  sheet: string;
  type: 'missing_sheet' | 'missing_required_column' | 'missing_optional_column' | 'empty_sheet';
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  canProceed: boolean;
  issues: ValidationIssue[];
  sheets: {
    name: string;
    found: boolean;
    hasHeaders: boolean;
    rowCount: number;
  }[];
}

const steps: StepConfig[] = [
  { id: 'org', name: 'Organization', icon: BuildingOfficeIcon },
  { id: 'sheets', name: 'Google Sheets', icon: TableCellsIcon },
  { id: 'invite', name: 'Invite Team', icon: UserGroupIcon },
  { id: 'complete', name: 'Complete', icon: CheckCircleIcon },
];

const sheetsSubSteps = [
  { id: 'enable-api' as SheetsSubStep, name: 'Enable API', icon: CloudIcon },
  { id: 'service-account' as SheetsSubStep, name: 'Create Service Account', icon: KeyIcon },
  { id: 'upload-key' as SheetsSubStep, name: 'Upload Key', icon: DocumentTextIcon },
  { id: 'share-sheet' as SheetsSubStep, name: 'Share Spreadsheet', icon: ShareIcon },
  { id: 'connect' as SheetsSubStep, name: 'Connect & Validate', icon: LinkIcon },
];

// Component for copy-to-clipboard functionality
function CopyableText({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-100 rounded-lg p-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
        <p className="font-mono text-sm break-all">{text}</p>
      </div>
      <button
        onClick={handleCopy}
        className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-md transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <CheckIcon className="h-5 w-5 text-green-600" />
        ) : (
          <ClipboardDocumentIcon className="h-5 w-5 text-gray-600" />
        )}
      </button>
    </div>
  );
}

// Enable Google Sheets API Guide Component
function EnableApiGuide({ onComplete }: { onComplete: () => void }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const guideSteps = [
    {
      title: 'Open Google Cloud Console',
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            First, you need to access the Google Cloud Console. If you don&apos;t have a project yet, 
            you&apos;ll be prompted to create one.
          </p>
          <a
            href="https://console.cloud.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Open Google Cloud Console
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        </div>
      ),
    },
    {
      title: 'Create or Select a Project',
      content: (
        <div className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Click the project dropdown at the top of the page</li>
            <li>Click <strong>&quot;NEW PROJECT&quot;</strong> (or select an existing one)</li>
            <li>Enter a name like <strong>&quot;Production Scheduler&quot;</strong></li>
            <li>Click <strong>&quot;CREATE&quot;</strong></li>
            <li>Wait for the project to be created, then select it</li>
          </ol>
        </div>
      ),
    },
    {
      title: 'Enable the Google Sheets API',
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            Navigate to the API Library and enable the Google Sheets API for your project.
          </p>
          <a
            href="https://console.cloud.google.com/apis/library/sheets.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Go to Google Sheets API
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 mt-2">
            <li>Make sure your project is selected at the top</li>
            <li>Click the <strong>&quot;ENABLE&quot;</strong> button</li>
            <li>Wait for the API to be enabled (takes a few seconds)</li>
          </ol>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">
              Once enabled, you&apos;ll see &quot;API Enabled&quot; with usage metrics on the page.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <CloudIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-blue-900 font-medium">Why do I need to enable an API?</p>
          <p className="text-sm text-blue-800 mt-1">
            Google Cloud APIs are disabled by default for security. Enabling the Google Sheets API 
            allows this application to read and write data to your spreadsheets through a secure connection.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {guideSteps.map((step, index) => (
          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedStep(expandedStep === index + 1 ? null : index + 1)}
              className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="font-medium text-gray-900">{step.title}</span>
              </span>
              <ArrowRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${
                expandedStep === index + 1 ? 'rotate-90' : ''
              }`} />
            </button>
            {expandedStep === index + 1 && (
              <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                {step.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="btn btn-primary w-full"
      >
        I&apos;ve enabled the Google Sheets API
        <ArrowRightIcon className="h-4 w-4 ml-2" />
      </button>
    </div>
  );
}

// Service Account Guide Component
function ServiceAccountGuide({ onComplete, onBack }: { onComplete: () => void; onBack?: () => void }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const guideSteps = [
    {
      title: 'Go to Google Cloud Console',
      content: (
        <div className="space-y-3">
          <p className="text-gray-600">
            Open the Google Cloud Console and navigate to the Service Accounts page.
          </p>
          <a
            href="https://console.cloud.google.com/iam-admin/serviceaccounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Open Service Accounts Page
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
          <p className="text-sm text-gray-500">
            You may need to create a new project first if you don&apos;t have one.
          </p>
        </div>
      ),
    },
    {
      title: 'Create a Service Account',
      content: (
        <div className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Click <strong>&quot;+ CREATE SERVICE ACCOUNT&quot;</strong> at the top</li>
            <li>Enter a name like <strong>&quot;production-scheduler&quot;</strong></li>
            <li>The Service Account ID will auto-fill</li>
            <li>Click <strong>&quot;CREATE AND CONTINUE&quot;</strong></li>
            <li>Skip the optional permissions steps - click <strong>&quot;DONE&quot;</strong></li>
          </ol>
        </div>
      ),
    },
    {
      title: 'Create and Download the JSON Key',
      content: (
        <div className="space-y-3">
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Click on your newly created service account</li>
            <li>Go to the <strong>&quot;Keys&quot;</strong> tab</li>
            <li>Click <strong>&quot;ADD KEY&quot;</strong> → <strong>&quot;Create new key&quot;</strong></li>
            <li>Select <strong>&quot;JSON&quot;</strong> format</li>
            <li>Click <strong>&quot;CREATE&quot;</strong> - the file will download automatically</li>
          </ol>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Keep this file secure! It provides access to your Google Cloud resources.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <InformationCircleIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-blue-900 font-medium">What is a Service Account?</p>
          <p className="text-sm text-blue-800 mt-1">
            A service account allows this app to read your Google Sheets data securely, 
            without needing your personal Google login. You control which spreadsheets 
            it can access by sharing them with the service account email.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {guideSteps.map((step, index) => (
          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedStep(expandedStep === index + 1 ? null : index + 1)}
              className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">
                  {index + 1}
                </span>
                <span className="font-medium text-gray-900">{step.title}</span>
              </span>
              <ArrowRightIcon className={`h-4 w-4 text-gray-400 transition-transform ${
                expandedStep === index + 1 ? 'rotate-90' : ''
              }`} />
            </button>
            {expandedStep === index + 1 && (
              <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                {step.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="btn btn-secondary"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </button>
        )}
        <button
          onClick={onComplete}
          className="btn btn-primary flex-1"
        >
          I have my JSON key file
          <ArrowRightIcon className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  );
}

// Validation Results Component
function ValidationResults({ 
  result, 
  onRetry 
}: { 
  result: ValidationResult; 
  onRetry: () => void;
}) {
  const errors = result.issues.filter(i => i.severity === 'error');
  const warnings = result.issues.filter(i => i.severity === 'warning');

  return (
    <div className="space-y-4">
      {/* Sheet Status */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Sheet Status:</p>
        <div className="grid grid-cols-2 gap-2">
          {result.sheets.map((sheet) => (
            <div
              key={sheet.name}
              className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                sheet.found
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {sheet.found ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
              ) : (
                <XMarkIcon className="h-5 w-5 text-red-600" />
              )}
              <span className="font-medium">{sheet.name}</span>
              {sheet.found && sheet.rowCount > 0 && (
                <span className="text-xs text-green-600">({sheet.rowCount} rows)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Issues that must be fixed:</p>
              <ul className="mt-2 space-y-1 text-sm text-red-800">
                {errors.map((issue, i) => (
                  <li key={i}>• {issue.message}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Optional improvements:</p>
              <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                {warnings.slice(0, 5).map((issue, i) => (
                  <li key={i}>• {issue.message}</li>
                ))}
                {warnings.length > 5 && (
                  <li className="text-yellow-600">...and {warnings.length - 5} more</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!result.canProceed && (
        <div className="flex items-center gap-3">
          <button onClick={onRetry} className="btn btn-secondary">
            Re-validate After Fixing
          </button>
          <a
            href="https://github.com/ZSturman/Production-Scheduling-Web-App/blob/main/docs/SHEETS_TEMPLATE.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
          >
            View required structure
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin, refreshToken } = useAuth();
  const { orgInfo, loading: dataLoading, refreshOrgInfo } = useData();
  
  const [currentStep, setCurrentStep] = useState<Step>('org');
  const [sheetsSubStep, setSheetsSubStep] = useState<SheetsSubStep>('enable-api');
  const [submitting, setSubmitting] = useState(false);
  
  // Org step state
  const [orgName, setOrgName] = useState('');
  
  // Sheets step state
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    spreadsheetName?: string;
    error?: string;
    troubleshooting?: string[];
  } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initializeResult, setInitializeResult] = useState<{
    success: boolean;
    created?: string[];
    errors?: string[];
    message?: string;
  } | null>(null);
  
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

  // Parse service account email from JSON
  const parseServiceAccountEmail = useCallback((json: string): string | null => {
    try {
      const parsed = JSON.parse(json);
      return parsed.client_email || null;
    } catch {
      return null;
    }
  }, []);

  // Handle file upload for service account
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setServiceAccountJson(content);
      setTestResult(null);
      setValidationResult(null);
      
      const email = parseServiceAccountEmail(content);
      if (email) {
        setServiceAccountEmail(email);
        toast.success('Service account key uploaded!');
      } else {
        toast.error('Invalid service account JSON file');
        setServiceAccountEmail('');
      }
    };
    reader.readAsText(file);
  }, [parseServiceAccountEmail]);

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
    setValidationResult(null);
    
    try {
      const response = await configApi.testGoogleSheets(spreadsheetId.trim(), serviceAccountJson);
      setTestResult(response.data.data);
      
      if (response.data.data.success) {
        toast.success(`Connected to "${response.data.data.spreadsheetName}"`);
        // Automatically run validation after successful connection
        await handleValidateStructure();
      } else {
        toast.error(response.data.data.error || 'Connection failed');
      }
    } catch (error: any) {
      console.error('Failed to test connection:', error);
      // Handle error response from API
      const errorData = error?.response?.data?.error;
      if (errorData) {
        setTestResult({ 
          success: false, 
          error: errorData.message || 'Connection failed',
          troubleshooting: errorData.troubleshooting 
        });
        toast.error(errorData.message || 'Connection failed');
      } else {
        setTestResult({ success: false, error: 'Failed to test connection' });
        toast.error('Failed to test connection');
      }
    } finally {
      setTesting(false);
    }
  };

  // Validate spreadsheet structure
  const handleValidateStructure = async () => {
    setValidating(true);
    try {
      const response = await configApi.validateGoogleSheets(spreadsheetId.trim(), serviceAccountJson);
      setValidationResult(response.data.data);
      
      if (response.data.data.valid) {
        toast.success('Spreadsheet structure verified!');
      } else if (response.data.data.canProceed) {
        toast('Structure validated with some warnings', { icon: '⚠️' });
      }
    } catch (error) {
      console.error('Failed to validate structure:', error);
      toast.error('Failed to validate spreadsheet structure');
    } finally {
      setValidating(false);
    }
  };

  // Initialize sheets with headers and default data
  const handleInitializeSheets = async () => {
    if (!spreadsheetId.trim()) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }
    if (!serviceAccountJson.trim()) {
      toast.error('Please upload a service account JSON file');
      return;
    }

    setInitializing(true);
    setInitializeResult(null);
    
    try {
      const response = await configApi.initializeSheets(spreadsheetId.trim(), serviceAccountJson);
      setInitializeResult(response.data.data);
      
      if (response.data.data.success) {
        toast.success(response.data.data.message || 'Sheets initialized successfully!');
        // Automatically retest connection and validate after initialization
        await handleTestConnection();
      } else {
        toast.error(response.data.data.message || 'Initialization completed with errors');
      }
    } catch (error: any) {
      console.error('Failed to initialize sheets:', error);
      const errorData = error?.response?.data?.error;
      if (errorData) {
        setInitializeResult({ 
          success: false, 
          message: errorData.message || 'Failed to initialize sheets',
          errors: errorData.troubleshooting || []
        });
        toast.error(errorData.message || 'Failed to initialize sheets');
      } else {
        setInitializeResult({ success: false, message: 'Failed to initialize sheets' });
        toast.error('Failed to initialize sheets');
      }
    } finally {
      setInitializing(false);
    }
  };

  // Save Google Sheets configuration
  const handleSaveConfig = async () => {
    if (!testResult?.success) {
      toast.error('Please test the connection first');
      return;
    }
    
    if (validationResult && !validationResult.canProceed) {
      toast.error('Please fix the required issues before continuing');
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

  // Extract spreadsheet ID from URL if pasted
  const handleSpreadsheetIdChange = (value: string) => {
    // Check if it's a full URL
    const urlMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      setSpreadsheetId(urlMatch[1]);
      toast.success('Spreadsheet ID extracted from URL');
    } else {
      setSpreadsheetId(value);
    }
    setTestResult(null);
    setValidationResult(null);
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
        {/* Main Progress steps */}
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

          {/* Step 2: Google Sheets - Guided Sub-steps */}
          {currentStep === 'sheets' && (
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Connect Google Sheets
              </h1>
              <p className="text-gray-600 mb-6">
                Link your production data spreadsheet to visualize schedules and create Gantt charts.
              </p>

              {/* Sub-step progress indicator */}
              <div className="mb-6 pb-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  {sheetsSubSteps.map((subStep, index) => {
                    const subStepIndex = sheetsSubSteps.findIndex(s => s.id === sheetsSubStep);
                    const isComplete = index < subStepIndex;
                    const isCurrent = subStep.id === sheetsSubStep;
                    
                    return (
                      <div key={subStep.id} className="flex items-center flex-1">
                        {index > 0 && (
                          <div className={`h-0.5 flex-1 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          isComplete ? 'bg-green-500 text-white' :
                          isCurrent ? 'bg-blue-600 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {isComplete ? <CheckIcon className="h-4 w-4" /> : index + 1}
                        </div>
                        {index < sheetsSubSteps.length - 1 && (
                          <div className={`h-0.5 flex-1 ${isComplete ? 'bg-green-500' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  {sheetsSubSteps.map((subStep) => (
                    <span key={subStep.id} className="text-xs text-gray-500 text-center flex-1">
                      {subStep.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Sub-step 2a: Enable Google Sheets API */}
              {sheetsSubStep === 'enable-api' && (
                <EnableApiGuide onComplete={() => setSheetsSubStep('service-account')} />
              )}

              {/* Sub-step 2b: Service Account Guide */}
              {sheetsSubStep === 'service-account' && (
                <ServiceAccountGuide 
                  onComplete={() => setSheetsSubStep('upload-key')} 
                  onBack={() => setSheetsSubStep('enable-api')}
                />
              )}

              {/* Sub-step 2c: Upload JSON Key */}
              {sheetsSubStep === 'upload-key' && (
                <div className="space-y-4">
                  <div>
                    <label className="label mb-2">
                      Upload Service Account Key (JSON)
                    </label>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      serviceAccountEmail 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-gray-300 hover:border-blue-400'
                    }`}>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="serviceAccount"
                        disabled={submitting}
                      />
                      {serviceAccountEmail ? (
                        <div className="space-y-2">
                          <CheckCircleIcon className="h-10 w-10 text-green-600 mx-auto" />
                          <p className="text-green-700 font-medium">Key file uploaded successfully!</p>
                          <label
                            htmlFor="serviceAccount"
                            className="cursor-pointer text-blue-600 hover:text-blue-700 text-sm"
                          >
                            Upload a different file
                          </label>
                        </div>
                      ) : (
                        <>
                          <DocumentTextIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                          <label
                            htmlFor="serviceAccount"
                            className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Click to upload JSON file
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            The file you downloaded from Google Cloud Console
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {serviceAccountEmail && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 mb-2">
                        <strong>Service Account Email:</strong>
                      </p>
                      <CopyableText text={serviceAccountEmail} />
                      <p className="text-sm text-blue-700 mt-2">
                        Copy this email - you&apos;ll need it in the next step to share your spreadsheet.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSheetsSubStep('service-account')}
                      className="btn btn-secondary"
                    >
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back
                    </button>
                    <button
                      onClick={() => setSheetsSubStep('share-sheet')}
                      disabled={!serviceAccountEmail}
                      className="btn btn-primary flex-1"
                    >
                      Continue
                      <ArrowRightIcon className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 2d: Share Spreadsheet */}
              {sheetsSubStep === 'share-sheet' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-900 font-medium mb-2">
                      Share your spreadsheet with this email:
                    </p>
                    <CopyableText text={serviceAccountEmail} />
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-gray-900">How to share:</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-600">
                      <li>Open your Google Spreadsheet</li>
                      <li>Click the <strong>&quot;Share&quot;</strong> button (top right)</li>
                      <li>Paste the service account email above</li>
                      <li>Set permission to <strong>&quot;Editor&quot;</strong></li>
                      <li>Uncheck &quot;Notify people&quot; (optional)</li>
                      <li>Click <strong>&quot;Share&quot;</strong></li>
                    </ol>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <InformationCircleIcon className="h-5 w-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600">
                        Don&apos;t have a spreadsheet yet? No problem! In the next step, 
                        you can connect any Google Spreadsheet and we&apos;ll help you 
                        set up the required structure automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSheetsSubStep('upload-key')}
                      className="btn btn-secondary"
                    >
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back
                    </button>
                    <button
                      onClick={() => setSheetsSubStep('connect')}
                      className="btn btn-primary flex-1"
                    >
                      I&apos;ve shared my spreadsheet
                      <ArrowRightIcon className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-step 2e: Connect & Validate */}
              {sheetsSubStep === 'connect' && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="spreadsheetId" className="label mb-1">
                      Spreadsheet ID or URL
                    </label>
                    <input
                      type="text"
                      id="spreadsheetId"
                      value={spreadsheetId}
                      onChange={(e) => handleSpreadsheetIdChange(e.target.value)}
                      placeholder="Paste spreadsheet URL or ID here"
                      className="input"
                      disabled={submitting || testing}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      You can paste the full URL - we&apos;ll extract the ID automatically
                    </p>
                  </div>

                  {/* Test Connection Button */}
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || validating || !spreadsheetId}
                    className="btn btn-secondary w-full"
                  >
                    {testing ? 'Testing connection...' : validating ? 'Validating structure...' : 'Test Connection'}
                  </button>

                  {/* Connection Result */}
                  {testResult && (
                    <div className={`p-4 rounded-lg ${
                      testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                      {testResult.success ? (
                        <div className="flex items-center gap-2 text-green-800">
                          <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          <span>Connected to &quot;{testResult.spreadsheetName}&quot;</span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-red-800">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Connection failed</p>
                            <p className="text-sm mt-1">{testResult.error}</p>
                            {testResult.troubleshooting && testResult.troubleshooting.length > 0 && (
                              <div className="mt-3">
                                <p className="text-sm font-medium mb-2">Troubleshooting steps:</p>
                                <ul className="text-sm space-y-1 list-disc list-inside">
                                  {testResult.troubleshooting.map((step, idx) => (
                                    <li key={idx}>{step}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {serviceAccountEmail && (
                              <div className="mt-3 p-2 bg-red-100 rounded text-xs">
                                <p className="font-medium mb-1">Service account email:</p>
                                <p className="font-mono break-all">{serviceAccountEmail}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Validation Results */}
                  {validationResult && testResult?.success && (
                    <div className="space-y-4">
                      <ValidationResults 
                        result={validationResult} 
                        onRetry={handleValidateStructure}
                      />
                      
                      {/* Show auto-create option only if there are issues that need fixing */}
                      {(!validationResult.valid || validationResult.issues.some(i => i.severity === 'error')) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <TableCellsIcon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-blue-900 font-medium">Need help setting up your spreadsheet?</p>
                              <p className="text-sm text-blue-800 mt-1">
                                We can automatically create the required sheets with proper headers and default data.
                              </p>
                              <button
                                onClick={handleInitializeSheets}
                                disabled={initializing}
                                className="btn btn-primary mt-3"
                              >
                                {initializing ? (
                                  <>
                                    <div className="spinner mr-2" />
                                    Creating sheets...
                                  </>
                                ) : (
                                  <>
                                    <TableCellsIcon className="h-5 w-5 mr-2" />
                                    Automatically Create Missing Sheets
                                  </>
                                )}
                              </button>
                              {initializeResult && (
                                <div className={`mt-3 p-3 rounded-lg ${
                                  initializeResult.success ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
                                }`}>
                                  <p className={`text-sm font-medium ${
                                    initializeResult.success ? 'text-green-800' : 'text-yellow-800'
                                  }`}>
                                    {initializeResult.message}
                                  </p>
                                  {initializeResult.created && initializeResult.created.length > 0 && (
                                    <p className="text-xs text-green-700 mt-1">
                                      Created: {initializeResult.created.join(', ')}
                                    </p>
                                  )}
                                  {initializeResult.errors && initializeResult.errors.length > 0 && (
                                    <div className="text-xs text-yellow-700 mt-2">
                                      <p className="font-medium">Errors:</p>
                                      <ul className="list-disc list-inside mt-1">
                                        {initializeResult.errors.map((error, idx) => (
                                          <li key={idx}>{error}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Show success message when everything is valid */}
                      {validationResult.valid && validationResult.canProceed && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-800">
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Spreadsheet structure verified! You&apos;re ready to continue.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSheetsSubStep('share-sheet')}
                      className="btn btn-secondary"
                    >
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      disabled={
                        submitting || 
                        !testResult?.success || 
                        (validationResult ? !validationResult.canProceed : false)
                      }
                      className="btn btn-primary flex-1"
                    >
                      {submitting ? 'Saving...' : 'Save & Continue'}
                      <ArrowRightIcon className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                </div>
              )}
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
