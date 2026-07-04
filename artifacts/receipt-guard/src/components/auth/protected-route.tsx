import { type ComponentType } from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '../../hooks/use-auth';

interface ProtectedRouteProps {
  component: ComponentType;
  adminOnly?: boolean;
}

/** Wraps a page component: redirects to /login if unauthenticated. */
export function ProtectedRoute({ component: Component, adminOnly }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
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

  // Admin check — reads from user metadata set by the server
  if (adminOnly && !user.user_metadata?.is_admin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}
