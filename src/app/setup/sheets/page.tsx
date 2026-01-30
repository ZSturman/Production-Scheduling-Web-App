'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import SheetsWizard, { type WizardConfig } from '@/components/sheets-wizard/SheetsWizard';
import { configApi, sheetsHealthApi, api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SheetsSetupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orgInfo, sheetsHealth, refreshSheetsHealth, refreshAll } = useData();
  const [existingSheetNames, setExistingSheetNames] = useState<string[]>([]);
  const [existingHeaders, setExistingHeaders] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Load existing spreadsheet info
  useEffect(() => {
    const loadSpreadsheetInfo = async () => {
      if (!orgInfo?.googleSheetsConfigured) {
        setLoading(false);
        return;
      }

      try {
        // Get sheets health which includes sheet info
        await refreshSheetsHealth();
        
        // Extract sheet names from health data
        if (sheetsHealth?.sheets) {
          setExistingSheetNames(sheetsHealth.sheets.map(s => s.name));
        }
        
        // TODO: Could also fetch headers for each sheet if needed
      } catch (error) {
        console.error('Failed to load spreadsheet info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSpreadsheetInfo();
  }, [orgInfo?.googleSheetsConfigured, refreshSheetsHealth, sheetsHealth?.sheets]);

  const handleComplete = async (config: WizardConfig) => {
    try {
      const response = await api.post('/config/google-sheets/apply-changes', config);
      const result = response.data.data;

      if (result.results.errors.length > 0) {
        toast.error(`Some operations failed: ${result.results.errors[0].message}`);
      } else {
        toast.success('Google Sheets configured successfully!');
      }

      // Refresh all data
      await refreshAll();

      // Navigate to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to apply configuration:', error);
      toast.error('Failed to apply configuration');
      throw error;
    }
  };

  const handleCancel = () => {
    if (orgInfo?.googleSheetsConfigured) {
      router.push('/dashboard');
    } else {
      router.push('/setup');
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user is admin
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            Only administrators can configure Google Sheets.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check if sheets are already configured
  if (!orgInfo?.googleSheetsConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Setup Not Complete</h1>
          <p className="text-gray-600 mb-4">
            Please complete the organization setup first, including connecting your Google Sheets credentials.
          </p>
          <button
            onClick={() => router.push('/setup')}
            className="btn btn-primary"
          >
            Go to Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Configure Google Sheets</h1>
          <p className="text-gray-600 mt-2">
            Set up the sheets and columns that the app will use to store and retrieve your data.
          </p>
        </div>

        {/* Wizard */}
        <SheetsWizard
          sheetsHealth={sheetsHealth}
          existingSheetNames={existingSheetNames}
          existingHeaders={existingHeaders}
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
