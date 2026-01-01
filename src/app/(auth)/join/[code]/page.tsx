'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { organizationsApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

interface InviteInfo {
  orgName: string;
  role: string;
  email: string;
  expiresAt: string;
}

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, refreshToken } = useAuth();
  
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Fetch invite info
  useEffect(() => {
    async function fetchInvite() {
      try {
        const response = await organizationsApi.getInviteByCode(resolvedParams.code);
        setInviteInfo(response.data.data);
      } catch (err) {
        console.error('Failed to fetch invite:', err);
        setError('This invite link is invalid or has expired.');
      } finally {
        setLoadingInvite(false);
      }
    }

    fetchInvite();
  }, [resolvedParams.code]);

  // Handle join
  const handleJoin = async () => {
    if (!user) {
      // Need to sign in first
      try {
        await signInWithGoogle();
        // After sign in, the effect below will handle joining
      } catch (err) {
        console.error('Sign in failed:', err);
        toast.error('Failed to sign in');
      }
      return;
    }

    setJoining(true);
    try {
      await organizationsApi.join(resolvedParams.code);
      await refreshToken(); // Get updated claims
      toast.success(`Welcome to ${inviteInfo?.orgName}!`);
      router.replace('/');
    } catch (err: unknown) {
      console.error('Failed to join:', err);
      const axiosError = err as { response?: { data?: { error?: { code?: string } } } };
      if (axiosError.response?.data?.error?.code === 'ALREADY_IN_ORG') {
        toast.error('You are already a member of an organization');
        router.replace('/dashboard');
      } else {
        toast.error('Failed to join organization');
      }
    } finally {
      setJoining(false);
    }
  };

  // Auto-join after sign in
  useEffect(() => {
    if (user && inviteInfo && !joining) {
      handleJoin();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, inviteInfo]);

  if (loadingInvite || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="card p-8 text-center">
            <ExclamationCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Invalid Invite
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.replace('/login')}
              className="btn btn-primary"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full mx-4">
        <div className="card p-8">
          <div className="text-center mb-8">
            <BuildingOfficeIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">
              You&apos;ve been invited!
            </h1>
            <p className="text-gray-600 mt-2">
              Join <strong>{inviteInfo?.orgName}</strong> as a{' '}
              <span className="capitalize">{inviteInfo?.role}</span>
            </p>
          </div>

          {user ? (
            <div className="text-center">
              {joining ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="spinner w-5 h-5" />
                  <span>Joining organization...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircleIcon className="h-5 w-5" />
                    <span>Signed in as {user.email}</span>
                  </div>
                  <button
                    onClick={handleJoin}
                    className="btn btn-primary w-full"
                  >
                    Join {inviteInfo?.orgName}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-center text-gray-600 mb-4">
                Sign in with your Google account to accept this invitation.
              </p>
              <button
                onClick={handleJoin}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-gray-500">
            This invite was sent to {inviteInfo?.email}
          </p>
        </div>
      </div>
    </div>
  );
}
