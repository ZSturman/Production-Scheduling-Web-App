'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { orgInfo, loading: dataLoading } = useData();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (dataLoading) return;

    // Check organization status and redirect appropriately
    if (!orgInfo?.organization) {
      // User not in an org - go to onboarding
      router.replace('/setup');
    } else if (orgInfo.configStatus !== 'configured') {
      // Org exists but not configured
      router.replace('/setup');
    } else {
      // All good - go to dashboard
      router.replace('/dashboard');
    }
  }, [user, authLoading, orgInfo, dataLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-gray-500">Loading...</p>
      </div>
    </div>
  );
}
