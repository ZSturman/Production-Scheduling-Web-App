'use client';

import { useEffect, useState, Fragment, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, Transition } from '@headlessui/react';
import {
  HomeIcon,
  CalendarIcon,
  CubeIcon,
  CogIcon,
  Cog8ToothIcon,
  ArrowPathIcon,
  Bars3Icon,
  XMarkIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import SheetHealthBanner from '@/components/SheetHealthBanner';
import { GuidedTour } from '@/components/GuidedTour';
import SheetsWizardModal from '@/components/sheets-wizard/SheetsWizardModal';
import type { WizardConfig } from '@/components/sheets-wizard/SheetsWizard';
import { configApi } from '@/lib/api';
import toast from 'react-hot-toast';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
  { name: 'Products', href: '/products', icon: CubeIcon },
  { name: 'Work Centers', href: '/work-centers', icon: Cog8ToothIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading, signOut, isPlanner, isAdmin } = useAuth();
  const { 
    orgInfo, 
    loading: dataLoading, 
    orgConfigured,
    syncing, 
    recalculating, 
    triggerSync, 
    recalculateSchedule, 
    lockedJobsAffected, 
    clearLockedJobsNotification,
    sheetsHealth,
    refreshSheetsHealth,
    refreshAll,
  } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSheetsWizard, setShowSheetsWizard] = useState(false);
  const [wizardCheckDone, setWizardCheckDone] = useState(false);
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);

  // Fetch templateId from google sheets config
  useEffect(() => {
    if (orgConfigured) {
      configApi.getGoogleSheets().then((response) => {
        if (response.data?.config?.templateId) {
          setTemplateId(response.data.config.templateId);
        }
      }).catch(console.error);
    }
  }, [orgConfigured]);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  // Org configuration check
  useEffect(() => {
    if (!authLoading && !dataLoading && user) {
      if (!orgInfo?.organization || !orgConfigured) {
        router.replace('/setup');
      }
    }
  }, [user, authLoading, dataLoading, orgInfo, orgConfigured, router]);

  // Check if sheets need configuration (template not selected yet)
  useEffect(() => {
    if (!authLoading && !dataLoading && orgConfigured && !wizardCheckDone) {
      // Check sheets health - if status is 'unconfigured' or has missing sheets, show wizard
      if (sheetsHealth?.status === 'unconfigured' || 
          sheetsHealth?.issues?.some(i => i.code === 'SHEET_NOT_FOUND')) {
        setShowSheetsWizard(true);
      }
      setWizardCheckDone(true);
    }
  }, [authLoading, dataLoading, orgConfigured, sheetsHealth, wizardCheckDone]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  // Handle wizard completion
  const handleWizardComplete = useCallback(async (config: WizardConfig) => {
    try {
      const response = await fetch('/api/config/google-sheets/apply-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to apply configuration');
      }
      
      toast.success('Google Sheets configured successfully!');
      setShowSheetsWizard(false);
      
      // Refresh data
      await refreshSheetsHealth();
      await refreshAll();
    } catch (error) {
      console.error('Error applying wizard config:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to configure sheets');
      throw error;
    }
  }, [refreshSheetsHealth, refreshAll]);

  if (authLoading || dataLoading || !user || !orgConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
          <div className="flex h-16 items-center justify-between px-4">
            <span className="text-xl font-bold text-gray-900 truncate">
              {orgInfo?.organization?.name || '📅 Scheduler'}
            </span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={classNames(
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col" data-tour="sidebar">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4 border-b border-gray-200">
            <span className="text-xl font-bold text-gray-900 truncate">
              {orgInfo?.organization?.name || '📅 Scheduler'}
            </span>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-4" data-tour="navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={classNames(
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50',
                    'group flex items-center px-3 py-2 text-sm font-medium rounded-md'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* Role indicator */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <span className={classNames(
                'px-2 py-1 text-xs font-medium rounded-full',
                isAdmin ? 'bg-purple-100 text-purple-800' :
                isPlanner ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              )}>
                {isAdmin ? 'Admin' : isPlanner ? 'Planner' : 'Viewer'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            className="lg:hidden text-gray-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-4">
            {/* Locked jobs notification */}
            {lockedJobsAffected > 0 && (
              <button
                onClick={clearLockedJobsNotification}
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm"
              >
                <span className="font-medium">{lockedJobsAffected} locked jobs affected</span>
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}

            {/* Sync button */}
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="btn btn-secondary btn-sm"
            >
              <ArrowPathIcon className={classNames('h-4 w-4 mr-1', syncing ? 'animate-spin' : '')} />
              {syncing ? 'Syncing...' : 'Refresh'}
            </button>

            {/* Recalculate button (Planner only) */}
            {isPlanner && (
              <button
                onClick={recalculateSchedule}
                disabled={recalculating}
                className="btn btn-primary btn-sm"
              >
                {recalculating ? 'Calculating...' : 'Recalculate'}
              </button>
            )}

            {/* User menu */}
            <Menu as="div" className="relative">
              <Menu.Button className="flex items-center gap-2">
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || ''}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <UserCircleIcon className="h-8 w-8 text-gray-400" />
                )}
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    <div className="font-medium">{user?.displayName}</div>
                    <div className="text-gray-500 truncate">{user?.email}</div>
                  </div>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={handleSignOut}
                        className={classNames(
                          active ? 'bg-gray-100' : '',
                          'block w-full text-left px-4 py-2 text-sm text-gray-700'
                        )}
                      >
                        Sign out
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          {/* Sheets health banner */}
          <SheetHealthBanner className="mb-4" />
          
          {children}
        </main>
      </div>

      {/* Sheets Wizard Modal - shows when sheets need configuration */}
      <SheetsWizardModal
        isOpen={showSheetsWizard}
        onClose={() => setShowSheetsWizard(false)}
        sheetsHealth={sheetsHealth}
        onComplete={handleWizardComplete}
        required={sheetsHealth?.status === 'unconfigured'}
      />

      {/* Guided Tour - shows on first visit */}
      <GuidedTour templateId={templateId} />
    </div>
  );
}
