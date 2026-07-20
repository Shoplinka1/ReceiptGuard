import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '../lib/supabase';

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Capture the subscription so it can be cleaned up when the component
    // unmounts. Without this the listener persisted across navigation events
    // and fired on every subsequent TOKEN_REFRESHED / SIGNED_OUT, causing
    // unexpected redirects.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN') {
        navigate('/');
      } else if (!_session) {
        navigate('/login');
      }
    });
    return () => subscription.unsubscribe();
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
