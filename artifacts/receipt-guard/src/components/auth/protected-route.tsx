import { type ComponentType } from 'react';
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

  // Fetch profile for admin check — only runs once user is known.
  // `isFetched` (not just `isLoading`) is used below to guard the redirect:
  // React Query's `isLoading` can be `false` for one render cycle after
  // `enabled` transitions from false→true while `fetchStatus` is still 'idle',
  // which would cause a premature redirect before the profile arrives.
  const { data: profile, isFetched: profileFetched } = useGetUserProfile({
    query: { enabled: !!user && !!adminOnly, retry: false },
  });

  // Keep showing the spinner until:
  //   • auth finishes resolving, AND
  //   • for admin routes: the profile fetch has completed (success OR error)
  const isLoading = loading || (!!adminOnly && !!user && !profileFetched);

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
  // (not from user_metadata, which is never updated for existing users).
  // Only evaluated after profileFetched=true (see isLoading guard above).
  if (adminOnly && !profile?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}
