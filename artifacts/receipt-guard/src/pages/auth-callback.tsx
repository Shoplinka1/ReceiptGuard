import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../lib/supabase';

/**
 * Handles the OAuth redirect from Supabase (Google login, email confirm, password reset).
 * Supabase exchanges the code for a session automatically via detectSessionInUrl.
 * We just wait for the session and redirect to the right place.
 */
export default function AuthCallbackPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Fire-and-forget: send welcome email on first sign-in (idempotent on backend)
        fetch(`${API_BASE}/api/user/welcome`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {/* non-fatal */});
        navigate('/dashboard');
      } else if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      } else if (!session) {
        navigate('/login');
      }
    });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Completing sign in…</p>
      </div>
    </div>
  );
}
