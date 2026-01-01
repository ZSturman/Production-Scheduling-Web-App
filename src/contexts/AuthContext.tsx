'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

type UserRole = 'viewer' | 'planner' | 'admin';

interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  orgId: string | null;
  orgName?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isPlanner: boolean;
  isAdmin: boolean;
  hasOrg: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Get custom claims for role and orgId
        const tokenResult = await firebaseUser.getIdTokenResult();
        const role = (tokenResult.claims.role as UserRole) || 
                     (tokenResult.claims.admin ? 'admin' : 
                      tokenResult.claims.planner ? 'planner' : 'viewer');
        const orgId = tokenResult.claims.orgId as string | undefined;

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role,
          orgId: orgId || null,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const refreshToken = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      // Force refresh the token to get updated claims
      await currentUser.getIdToken(true);
      const tokenResult = await currentUser.getIdTokenResult();
      
      setUser(prev => prev ? {
        ...prev,
        role: (tokenResult.claims.role as UserRole) || prev.role,
        orgId: (tokenResult.claims.orgId as string) || prev.orgId,
      } : null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithGoogle,
    signOut,
    refreshToken,
    isPlanner: user?.role === 'planner' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    hasOrg: !!user?.orgId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
