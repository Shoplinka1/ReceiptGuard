import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/query-client';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean | null; // null = not yet determined
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchIsAdmin(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.isAdmin);
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        const admin = await fetchIsAdmin(data.session.access_token);
        setIsAdmin(admin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.removeQueries({ queryKey: ['admin'] });
        if (session?.access_token) {
          const admin = await fetchIsAdmin(session.access_token);
          setIsAdmin(admin);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`.replace(/\/\//g, '/').replace(':/', '://');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    let signOutError: unknown = null;
    try {
      const { error } = await supabase.auth.signOut();
      signOutError = error;
    } catch (err) {
      signOutError = err;
    } finally {
      queryClient.clear();
      try {
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('sb-') || key === 'supabase.auth.token')) {
            window.localStorage.removeItem(key);
          }
        }
      } catch { /* non-fatal */ }
      setSession(null);
      setUser(null);
      setIsAdmin(false);
    }
    if (signOutError) throw signOutError;
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signInWithGoogle, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
