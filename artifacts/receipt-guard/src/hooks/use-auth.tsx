import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { queryClient } from '../lib/query-client';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Wire Supabase access token into every API call via the existing customFetch hook
  useEffect(() => {
    setAuthTokenGetter(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
    return () => setAuthTokenGetter(null);
  }, []);

  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      // On every sign-in, remove the cached profile so ProtectedRoute and
      // AppShell always fetch fresh data (including an up-to-date isAdmin
      // value). Without this, a stale cache entry with isAdmin:false causes
      // ProtectedRoute to redirect before the background refetch resolves.
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        queryClient.removeQueries({ queryKey: ['/api/user/profile'] });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
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

  const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    // Fix for "user must never remain authenticated after signing out":
    // previously this only called supabase.auth.signOut() and left the React
    // Query cache (dashboard/receipts/settings data) and any app-written
    // localStorage keys in place. A slow network or a thrown error here also
    // used to leave the UI in a stale "still logged in" state since nothing
    // downstream forced a re-render. We now always clear local state — cache,
    // storage, and React state — even if the Supabase call itself fails, then
    // rethrow so callers can still show an error toast.
    let signOutError: unknown = null;
    try {
      const { error } = await supabase.auth.signOut();
      signOutError = error;
    } catch (err) {
      signOutError = err;
    } finally {
      queryClient.clear();
      try {
        // Only clear Supabase's own auth-token keys (sb-<project-ref>-auth-token,
        // and legacy `supabase.auth.token`). Clearing ALL of localStorage would
        // also wipe next-themes' theme preference and any other benign,
        // non-auth prefs that should survive logout.
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('sb-') || key === 'supabase.auth.token')) {
            window.localStorage.removeItem(key);
          }
        }
      } catch { /* storage may be unavailable (e.g. private mode) — non-fatal */ }
      setSession(null);
      setUser(null);
    }
    if (signOutError) throw signOutError;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, session, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, sendPasswordReset, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
