import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/hooks/use-auth';
import { ProtectedAdminRoute } from '@/components/auth/protected-admin-route';
import LoginPage from '@/pages/login';
import AuthCallbackPage from '@/pages/auth-callback';
import AdminDashboard from '@/pages/admin-dashboard';
import DebugPage from '@/pages/debug';
import NotFound from '@/pages/not-found';

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ProtectedAdminRoute component={AdminDashboard} />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/callback" component={AuthCallbackPage} />
      <Route path="/debug" component={DebugPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
