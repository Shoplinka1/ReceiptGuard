import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import LandingPage from './pages/landing';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';
import ConnectGmailPage from './pages/connect-gmail';
import DashboardPage from './pages/dashboard';
import ReceiptsPage from './pages/receipts';
import SubscriptionsPage from './pages/subscriptions';
import WarrantiesPage from './pages/warranties';
import RenewalsPage from './pages/renewals';
import RemindersPage from './pages/reminders';
import SettingsPage from './pages/settings';
import BillingPage from './pages/billing';
import ProfilePage from './pages/profile';
import NotFound from './pages/not-found';
import { ThemeProvider } from './components/theme-provider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/connect-gmail" component={ConnectGmailPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/receipts" component={ReceiptsPage} />
      <Route path="/subscriptions" component={SubscriptionsPage} />
      <Route path="/warranties" component={WarrantiesPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/renewals" component={RenewalsPage} />
      <Route path="/reminders" component={RemindersPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster position="top-right" theme="dark" richColors />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;