import { type ComponentType, useEffect } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '../../hooks/use-auth';
import { useGetUserProfile } from '@workspace/api-client-react';

interface ProtectedRouteProps {
  component: ComponentType;
  adminOnly?: boolean;
}

/** Wraps a page component: redirects to /login if unauthenticated. */
export function ProtectedRoute({ component: Component, adminOnly }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  // Fetch profile for admin check — only runs once user is known
  const {
    data: profile,
    status,
    isLoading: profileLoading,
    isFetching,
    isFetched,
    isError,
    error,
  } = useGetUserProfile({
    query: { enabled: !!user && !!adminOnly, retry: false },
  });

  // ── Diagnostic logging ────────────────────────────────────────────────────
  // Logs every render so you can see exactly what values ProtectedRoute sees
  // before any redirect decision is made. Check DevTools Console → filter by
  // "[ReceiptGuard] ProtectedRoute".
  useEffect(() => {
    if (!adminOnly) return; // only log for admin routes
    console.group('[ReceiptGuard] ProtectedRoute render');
    console.log('adminOnly         :', adminOnly);
    console.log('auth.loading      :', loading);
    console.log('user              :', user?.id ?? null);
    console.log('RQ status         :', status);
    console.log('RQ isLoading      :', profileLoading);
    console.log('RQ isFetching     :', isFetching);
    console.log('RQ isFetched      :', isFetched);
    console.log('RQ isError        :', isError);
    console.log('RQ error          :', error ?? null);
    console.log('profile           :', profile ?? null);
    console.log('profile.isAdmin   :', profile?.isAdmin ?? '(no profile)');
    // Derived values that drive the redirect decision
    const computedLoading = loading || (adminOnly && !!user && profileLoading);
    const wouldRedirectAuth  = !loading && !user;
    const wouldRedirectAdmin = !computedLoading && !!user && adminOnly && !profile?.isAdmin;
    console.log('--- decision ---');
    console.log('computedLoading   :', computedLoading);
    console.log('→ redirect /login :', wouldRedirectAuth);
    console.log('→ redirect /dash  :', wouldRedirectAdmin);
    console.groupEnd();
  });
  // ─────────────────────────────────────────────────────────────────────────

  const isLoading = loading || (adminOnly && !!user && profileLoading);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  // Admin check — reads isAdmin from the profiles DB table via the API
  // (not from user_metadata, which is never populated for existing users)
  if (adminOnly && !profile?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}
