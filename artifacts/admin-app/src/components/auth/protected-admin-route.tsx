import { type ComponentType } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '../../hooks/use-auth';

interface Props {
  component: ComponentType;
}

/**
 * Renders the component only when:
 *  1. The user has an active Supabase session.
 *  2. Their profile has is_admin=true (checked via /api/user/profile on the API server).
 *
 * Shows a spinner while auth and profile are loading, and redirects to /login if unauthenticated.
 * Shows an "Access Denied" screen if authenticated but not an admin.
 */
export function ProtectedAdminRoute({ component: Component }: Props) {
  const { user, loading, isAdmin } = useAuth();

  // Still loading auth or admin check
  if (loading || (user && isAdmin === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) return <Redirect to="/login" />;

  // Signed in but not an admin
  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 text-center bg-background">
        <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
          <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="text-xl font-semibold text-foreground">Access Denied</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Your account does not have admin privileges. Contact the system owner to request access.
        </p>
        <button
          onClick={() => window.location.href = '/login'}
          className="mt-2 text-sm text-primary hover:underline"
        >
          Sign out and try a different account
        </button>
      </div>
    );
  }

  return <Component />;
}
