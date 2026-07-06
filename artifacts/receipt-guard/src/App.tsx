import { lazy, Suspense } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { ThemeProvider } from './components/theme-provider';
import { AuthProvider } from './hooks/use-auth';
import { ProtectedRoute } from './components/auth/protected-route';
import { ErrorBoundary } from './components/error-boundary';

// Public pages
import LandingPage from './pages/landing';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import ForgotPasswordPage from './pages/forgot-password';
import ResetPasswordPage from './pages/reset-password';
import AuthCallbackPage from './pages/auth-callback';
import NotFound from './pages/not-found';
import PricingPage from './pages/pricing';
import PrivacyPage from './pages/privacy';
import TermsPage from './pages/terms';

// Protected pages (lazy-loaded)
const DashboardPage = lazy(() => import('./pages/dashboard'));
const ReceiptsPage = lazy(() => import('./pages/receipts'));
const SubscriptionsPage = lazy(() => import('./pages/subscriptions'));
const WarrantiesPage = lazy(() => import('./pages/warranties'));
const RenewalsPage = lazy(() => import('./pages/renewals'));
const RemindersPage = lazy(() => import('./pages/reminders'));
const SettingsPage = lazy(() => import('./pages/settings'));
const BillingPage = lazy(() => import('./pages/billing'));
const ProfilePage = lazy(() => import('./pages/profile'));
const ConnectGmailPage = lazy(() => import('./pages/connect-gmail'));
const AdminPage = lazy(() => import('./pages/admin'));
const FeedbackPage = lazy(() => import('./pages/feedback'));
const SearchPage = lazy(() => import('./pages/search'));
const SupportPage = lazy(() => import('./pages/support'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Router() {
  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* Public */}
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/auth/callback" component={AuthCallbackPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />

        {/* Protected */}
        <Route path="/dashboard">
          {() => <ProtectedRoute component={DashboardPage} />}
        </Route>
        <Route path="/receipts">
          {() => <ProtectedRoute component={ReceiptsPage} />}
        </Route>
        <Route path="/subscriptions">
          {() => <ProtectedRoute component={SubscriptionsPage} />}
        </Route>
        <Route path="/warranties">
          {() => <ProtectedRoute component={WarrantiesPage} />}
        </Route>
        <Route path="/renewals">
          {() => <ProtectedRoute component={RenewalsPage} />}
        </Route>
        <Route path="/reminders">
          {() => <ProtectedRoute component={RemindersPage} />}
        </Route>
        <Route path="/settings">
          {() => <ProtectedRoute component={SettingsPage} />}
        </Route>
        <Route path="/billing">
          {() => <ProtectedRoute component={BillingPage} />}
        </Route>
        <Route path="/profile">
          {() => <ProtectedRoute component={ProfilePage} />}
        </Route>
        <Route path="/connect-gmail">
          {() => <ProtectedRoute component={ConnectGmailPage} />}
        </Route>
        <Route path="/admin">
          {() => <ProtectedRoute component={AdminPage} adminOnly />}
        </Route>
        <Route path="/feedback">
          {() => <ProtectedRoute component={FeedbackPage} />}
        </Route>
        <Route path="/search">
          {() => <ProtectedRoute component={SearchPage} />}
        </Route>
        <Route path="/support">
          {() => <ProtectedRoute component={SupportPage} />}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster position="top-right" theme="system" richColors />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
