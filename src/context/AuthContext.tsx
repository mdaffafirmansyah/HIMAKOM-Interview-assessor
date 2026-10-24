import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  isAdmin: boolean;
  isInterviewer: boolean;
  isReviewer: boolean;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setDemoRole: (role: UserRole | null) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as UserProfile);
      }
    } catch (err) {
      console.warn('Gagal memuat profil pengguna:', err);
    }
  };

  const setDemoRole = (targetRole: UserRole | null) => {
    if (!targetRole) {
      setUser(null);
      setProfile(null);
      localStorage.removeItem('himakom_demo_role');
      return;
    }

    const demoProfiles: Record<UserRole, UserProfile> = {
      admin: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@himakom.org',
        full_name: 'Administrator HIMAKOM',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      interviewer: {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'pewawancara@himakom.org',
        full_name: 'Pewawancara Divisi (PSDM)',
        role: 'interviewer',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      reviewer: {
        id: '44444444-4444-4444-4444-444444444444',
        email: 'reviewer@himakom.org',
        full_name: 'Reviewer Senior HIMAKOM',
        role: 'reviewer',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    };

    setProfile(demoProfiles[targetRole]);
    setUser(null);
    localStorage.setItem('himakom_demo_role', targetRole);
  };

  useEffect(() => {
    if (!supabase || !isConfigured) {
      // Periksa apakah ada demo role tersimpan di localStorage
      const savedDemoRole = localStorage.getItem('himakom_demo_role') as UserRole | null;
      if (savedDemoRole && ['admin', 'interviewer', 'reviewer'].includes(savedDemoRole)) {
        setDemoRole(savedDemoRole);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
      return;
    }

    // Ambil sesi aktif Supabase Auth
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setIsLoading(false));
      } else {
        // Jika tidak ada user Supabase, periksa demo role
        const savedDemoRole = localStorage.getItem('himakom_demo_role') as UserRole | null;
        if (savedDemoRole) {
          setDemoRole(savedDemoRole);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    });

    // Berlangganan perubahan status auth
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        localStorage.removeItem('himakom_demo_role');
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return { error: 'Supabase belum terkonfigurasi di file lingkungan' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'interviewer'
  ) => {
    if (!supabase) return { error: 'Supabase belum terkonfigurasi di file lingkungan' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    return { error: error?.message || null };
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem('himakom_demo_role');
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const role = profile?.role ?? null;
  const isAdmin = role === 'admin';
  const isInterviewer = role === 'interviewer' || role === 'admin';
  const isReviewer = role === 'reviewer' || role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        isAdmin,
        isInterviewer,
        isReviewer,
        isLoading,
        isConfigured,
        signIn,
        signUp,
        signOut,
        setDemoRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return context;
};
