'use client';

import { useState } from 'react';
import { 
  ExclamationTriangleIcon, 
  XCircleIcon, 
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  WrenchScrewdriverIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import type { SheetIssue, SheetsHealth } from '@/types/settings';

interface SheetHealthBannerProps {
  className?: string;
}

export default function SheetHealthBanner({ className = '' }: SheetHealthBannerProps) {
  const { sheetsHealth, fixMissingSheets, fixMissingHeaders, refreshSheetsHealth } = useData();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Don't show if healthy or not yet loaded
  if (!sheetsHealth || sheetsHealth.status === 'healthy') {
    return null;
  }

  const isAdmin = user?.role === 'admin';
  const errorCount = sheetsHealth.issues.filter(i => i.severity === 'error').length;
  const warningCount = sheetsHealth.issues.filter(i => i.severity === 'warning').length;

  const getStatusColor = (status: SheetsHealth['status']) => {
    switch (status) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'degraded':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'unconfigured':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = (status: SheetsHealth['status']) => {
    switch (status) {
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'degraded':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'unconfigured':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getIssueIcon = (severity: SheetIssue['severity']) => {
    switch (severity) {
      case 'error':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <InformationCircleIcon className="h-4 w-4 text-blue-500" />;
    }
  };

  const handleFixMissingSheets = async () => {
    setFixing(true);
    try {
      await fixMissingSheets();
    } finally {
      setFixing(false);
    }
  };

  const handleFixHeaders = async (sheetName: string) => {
    setFixing(true);
    try {
      await fixMissingHeaders(sheetName);
    } finally {
      setFixing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSheetsHealth();
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusMessage = () => {
    if (sheetsHealth.status === 'unconfigured') {
      return 'Google Sheets has not been configured for this organization.';
    }
    if (errorCount > 0) {
      return `${errorCount} issue${errorCount > 1 ? 's' : ''} preventing data access`;
    }
    if (warningCount > 0) {
      return `${warningCount} warning${warningCount > 1 ? 's' : ''} detected`;
    }
    return 'Issues detected with Google Sheets configuration';
  };

  const hasMissingSheets = sheetsHealth.issues.some(i => i.code === 'SHEET_NOT_FOUND');
  const hasMissingHeaders = sheetsHealth.issues.some(i => i.code === 'MISSING_REQUIRED_HEADER');

  return (
    <div className={`border rounded-lg ${getStatusColor(sheetsHealth.status)} ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getStatusIcon(sheetsHealth.status)}
          <div>
            <p className="font-medium">{getStatusMessage()}</p>
            <p className="text-sm opacity-75">
              Last checked: {new Date(sheetsHealth.lastChecked).toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors disabled:opacity-50"
            title="Re-check sheets health"
          >
            <ArrowPathIcon className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {/* Quick fix button for admins */}
          {isAdmin && hasMissingSheets && (
            <button
              onClick={handleFixMissingSheets}
              disabled={fixing}
              className="btn btn-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 flex items-center space-x-1"
            >
              <WrenchScrewdriverIcon className="h-4 w-4" />
              <span>{fixing ? 'Fixing...' : 'Fix Missing Sheets'}</span>
            </button>
          )}
          
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            {expanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded issue list */}
      {expanded && (
        <div className="border-t border-current/10 px-4 py-3 space-y-3">
          {sheetsHealth.issues.map((issue, index) => (
            <div 
              key={index}
              className="bg-white/50 rounded-lg p-3 space-y-2"
            >
              <div className="flex items-start space-x-2">
                {getIssueIcon(issue.severity)}
                <div className="flex-1">
                  <p className="font-medium text-sm">{issue.message}</p>
                  {issue.sheetName && (
                    <p className="text-xs opacity-75">Sheet: {issue.sheetName}</p>
                  )}
                </div>
              </div>
              
              <div className="pl-6">
                <p className="text-sm opacity-75">{issue.userAction}</p>
                
                {/* Admin action buttons */}
                {isAdmin && !issue.adminRequired === false && (
                  <div className="mt-2">
                    {issue.code === 'MISSING_REQUIRED_HEADER' && issue.sheetName && (
                      <button
                        onClick={() => handleFixHeaders(issue.sheetName!)}
                        disabled={fixing}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                      >
                        {fixing ? 'Fixing...' : 'Add missing headers'}
                      </button>
                    )}
                  </div>
                )}
                
                {/* Non-admin message */}
                {!isAdmin && issue.adminRequired && (
                  <p className="text-sm text-gray-600 mt-1 italic">
                    Contact your organization administrator to resolve this issue.
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Sheet status overview */}
          {sheetsHealth.sheets.length > 0 && (
            <div className="border-t border-current/10 pt-3 mt-3">
              <p className="text-sm font-medium mb-2">Sheet Status:</p>
              <div className="grid grid-cols-2 gap-2">
                {sheetsHealth.sheets.map((sheet) => (
                  <div 
                    key={sheet.name}
                    className={`text-sm p-2 rounded ${
                      sheet.exists && sheet.hasRequiredHeaders
                        ? 'bg-green-100 text-green-800'
                        : sheet.exists
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <span className="font-medium">{sheet.name}</span>
                    <span className="ml-2">
                      {sheet.exists && sheet.hasRequiredHeaders
                        ? '✓'
                        : sheet.exists
                        ? '⚠'
                        : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings link */}
          {sheetsHealth.status === 'unconfigured' && (
            <div className="border-t border-current/10 pt-3 mt-3">
              <a
                href="/settings"
                className="btn btn-primary btn-sm"
              >
                Configure Google Sheets
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
