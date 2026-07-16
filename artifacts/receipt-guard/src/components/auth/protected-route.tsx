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
    query: { queryKey: ['/api/user/profile'], enabled: !!user && !!adminOnly, retry: false },
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

  // isLoading is true only when there is NO cached data and a fetch is in
  // flight.  Use isFetching as the guard instead so that stale cached data
  // (isAdmin: false from a previous AppShell fetch) is never used to make
  // the redirect decision before a fresh response arrives.
  const isLoading = loading || (!!adminOnly && !!user && isFetching);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (adminOnly) {
    // API call failed (401, 404, 500, network error).  Do NOT silently
    // redirect — show a visible error so we can distinguish a backend
    // failure from a genuine "not admin" case.
    if (isError) {
      const msg = (error as Error)?.message ?? 'Unknown error';
      console.error('[ReceiptGuard] ProtectedRoute: profile fetch failed —', msg);
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-background">
          <p className="font-semibold text-foreground">Could not verify admin access</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            The server returned an error. Check the browser console and Railway logs for
            the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">[profile]</code> log line to see the exact reason.
          </p>
          <pre className="text-xs bg-muted text-muted-foreground p-4 rounded-md max-w-lg w-full text-left overflow-auto">
            {msg}
          </pre>
        </div>
      );
    }

    // Fetch completed successfully — check isAdmin.
    // Only redirect once isFetched is true so we never act on undefined data.
    if (isFetched && !profile?.isAdmin) {
      console.warn('[ReceiptGuard] ProtectedRoute: redirect to /dashboard — profile.isAdmin is', profile?.isAdmin, '| full profile:', profile);
      return <Redirect to="/dashboard" />;
    }
  }

  return <Component />;
}
