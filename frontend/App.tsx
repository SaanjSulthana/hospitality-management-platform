import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { isDevelopment } from './src/utils/env';

// Run environment tests in development
if (isDevelopment()) {
  import('./src/utils/test-env');
  import('./src/utils/test-uploads');
}
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import TasksPage from './pages/TasksPage';
import TaskManagementPage from './pages/TaskManagementPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import StaffPage from './pages/StaffPage';
import UsersPage from './pages/UsersPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';
import GuestCheckInPage from './pages/GuestCheckInPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
      gcTime: 300000, // 5 minutes
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

function AppInner() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/properties" element={<PropertiesPage />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/task-management" element={<TaskManagementPage />} />
                  <Route path="/finance" element={<FinancePage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/staff" element={<StaffPage />} />
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/guest-checkin" element={<GuestCheckInPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <PageTitleProvider>
            <AppInner />
            <Toaster />
          </PageTitleProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
