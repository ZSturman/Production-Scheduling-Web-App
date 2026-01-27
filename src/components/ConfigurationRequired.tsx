'use client';

import { DocumentTextIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface ConfigurationRequiredProps {
  featureName?: string;
  className?: string;
}

export default function ConfigurationRequired({ 
  featureName = 'This feature',
  className = '' 
}: ConfigurationRequiredProps) {
  const { sheetsHealth, orgConfigured } = useData();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin';
  const isUnconfigured = !orgConfigured || sheetsHealth?.status === 'unconfigured';
  const hasErrors = sheetsHealth?.status === 'error';

  // Determine the message and action based on state
  const getContent = () => {
    if (isUnconfigured) {
      return {
        icon: DocumentTextIcon,
        title: 'Google Sheets Not Configured',
        description: `${featureName} requires a connected Google Sheets spreadsheet to function.`,
        actionText: isAdmin ? 'Configure Google Sheets' : 'Contact your administrator',
        actionHref: isAdmin ? '/setup/sheets' : undefined,
        secondaryText: 'The app stores all your data in Google Sheets, giving you full control and easy data access.',
      };
    }

    if (hasErrors) {
      const errorIssues = sheetsHealth?.issues.filter(i => i.severity === 'error') || [];
      const primaryIssue = errorIssues[0];
      
      return {
        icon: ExclamationTriangleIcon,
        title: 'Configuration Issues Detected',
        description: primaryIssue?.message || `${featureName} is temporarily unavailable due to Google Sheets configuration issues.`,
        actionText: isAdmin ? 'Fix Issues' : 'Contact your administrator',
        actionHref: isAdmin ? '/settings' : undefined,
        secondaryText: primaryIssue?.userAction || 'Review the issues in settings to restore functionality.',
      };
    }

    return {
      icon: Cog6ToothIcon,
      title: 'Configuration Required',
      description: `${featureName} needs additional setup before it can be used.`,
      actionText: isAdmin ? 'Complete Setup' : 'Contact your administrator',
      actionHref: isAdmin ? '/settings' : undefined,
      secondaryText: 'Complete the configuration to start using this feature.',
    };
  };

  const content = getContent();
  const IconComponent = content.icon;

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] p-8 ${className}`}>
      <div className="bg-gray-50 rounded-full p-6 mb-6">
        <IconComponent className="h-16 w-16 text-gray-400" />
      </div>
      
      <h2 className="text-xl font-semibold text-gray-900 mb-2 text-center">
        {content.title}
      </h2>
      
      <p className="text-gray-600 text-center max-w-md mb-6">
        {content.description}
      </p>
      
      {content.actionHref ? (
        <Link
          href={content.actionHref}
          className="btn btn-primary"
        >
          {content.actionText}
        </Link>
      ) : (
        <p className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
          {content.actionText} to enable this feature.
        </p>
      )}
      
      <p className="text-sm text-gray-500 mt-4 text-center max-w-sm">
        {content.secondaryText}
      </p>

      {/* Show specific issues if there are errors */}
      {hasErrors && sheetsHealth?.issues && (
        <div className="mt-6 w-full max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-red-800 mb-2">
              Issues preventing data access:
            </h3>
            <ul className="text-sm text-red-700 space-y-1">
              {sheetsHealth.issues
                .filter(i => i.severity === 'error')
                .slice(0, 3)
                .map((issue, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
            </ul>
            {sheetsHealth.issues.filter(i => i.severity === 'error').length > 3 && (
              <p className="text-xs text-red-600 mt-2">
                +{sheetsHealth.issues.filter(i => i.severity === 'error').length - 3} more issues
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
