import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/common/Layout';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingPage } from './components/auth/OnboardingPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { AnalyticsPage } from './components/analytics/AnalyticsPage';
import { ExpensesPage } from './components/expenses/ExpensesPage';
import { BillingPage } from './components/billing/BillingPage';
import { ContractsPage } from './components/contracts/ContractsPage';
import { DecisionForgePage } from './components/decision-forge/DecisionForgePage';
import { SettingsPage } from './components/settings/SettingsPage';
import { GoalsPage } from './components/goals/GoalsPage';
import { WealthPage } from './components/wealth/WealthPage';
import { authService } from './services/authService';
import { PersonaProvider } from './context/PersonaContext';
import { ToastProvider } from './context/ToastContext';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 10000, retry: 1 } } });

// The public landing page is code-split so signed-in users never download it.
const LandingPage = lazy(() => import('./components/landing/LandingPage'));

const PrivateRoute = ({ children }: { children: React.ReactNode }) =>
  authService.isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;

// Same as PrivateRoute, except a signed-out visitor at "/" sees the landing page
// instead of being redirected. Every other protected path still redirects to /login.
const AppOrLanding = ({ children }: { children: React.ReactNode }) => {
  const { pathname } = useLocation();
  if (authService.isAuthenticated()) return <>{children}</>;
  if (pathname === '/') {
    return (
      <Suspense fallback={null}>
        <LandingPage />
      </Suspense>
    );
  }
  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <PersonaProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            {/* Public alias so the landing page can be viewed while signed in. */}
            <Route
              path="/welcome"
              element={
                <Suspense fallback={null}>
                  <LandingPage />
                </Suspense>
              }
            />
            <Route
              path="/onboarding"
              element={
                <PrivateRoute>
                  <OnboardingPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/*"
              element={
                <AppOrLanding>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/decision-forge" element={<DecisionForgePage />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="/expenses" element={<ExpensesPage />} />
                      <Route path="/contracts" element={<ContractsPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/goals" element={<GoalsPage />} />
                      <Route path="/wealth" element={<WealthPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Routes>
                  </Layout>
                </AppOrLanding>
              }
            />
          </Routes>
        </BrowserRouter>
      </PersonaProvider>
    </ToastProvider>
  </QueryClientProvider>
  );
}


export default App;
