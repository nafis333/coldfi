import { createBrowserRouter, Navigate, Outlet, Link } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { lazy, Suspense } from 'react';
import AppLayout from './components/layout/AppLayout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ExpenseListPage = lazy(() => import('./pages/ExpenseListPage'));
const ExpenseFormPage = lazy(() => import('./pages/ExpenseFormPage'));
const BudgetViewPage = lazy(() => import('./pages/BudgetViewPage'));
const GroupListPage = lazy(() => import('./pages/groups/GroupsPage'));
const GroupDetailPage = lazy(() => import('./pages/groups/GroupDetailPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const RecapsPage = lazy(() => import('./pages/recaps/RecapsPage'));
const RecurringBillsPage = lazy(() => import('./pages/recurring/RecurringBillsPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ExpensesTab = lazy(() => import('./pages/groups/ExpensesTab'));
const SettlementsTab = lazy(() => import('./pages/groups/SettlementsTab'));
const ActivityLogTab = lazy(() => import('./pages/groups/ActivityLogTab'));
const MembersTab = lazy(() => import('./pages/groups/MembersTab'));
const GroupExpenseForm = lazy(() => import('./pages/groups/ExpenseForm'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const ProfileSettings = lazy(() => import('./pages/settings/ProfileSettings'));
const SecuritySettings = lazy(() => import('./pages/settings/SecuritySettings'));
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'));
const GroupsSettings = lazy(() => import('./pages/settings/GroupsSettings'));
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'));
const DataExportSettings = lazy(() => import('./pages/settings/DataExportSettings'));
const ImportPage = lazy(() => import('./pages/import/ImportPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminMonitoringPage = lazy(() => import('./pages/admin/AdminMonitoringPage'));
const AdminDebugPage = lazy(() => import('./pages/admin/AdminDebugPage'));
const AdminSecurityPage = lazy(() => import('./pages/admin/AdminSecurityPage'));
const AdminAlertsPage = lazy(() => import('./pages/admin/AdminAlertsPage'));
const AdminConfigPage = lazy(() => import('./pages/admin/AdminConfigPage'));
const AdminAuditLogPage = lazy(() => import('./pages/admin/AdminAuditLogPage'));
const AdminHealthPage = lazy(() => import('./pages/admin/AdminHealthPage'));
const AdminJobsPage = lazy(() => import('./pages/admin/AdminJobsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingFallback />}>{children}</Suspense>;
}

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <SuspenseWrapper>
        <LoginPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/register',
    element: (
      <SuspenseWrapper>
        <RegisterPage />
      </SuspenseWrapper>
    ),
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <SuspenseWrapper>
            <DashboardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'expenses',
        element: (
          <SuspenseWrapper>
            <ExpenseListPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'expenses/new',
        element: (
          <SuspenseWrapper>
            <ExpenseFormPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'expenses/:id/edit',
        element: (
          <SuspenseWrapper>
            <ExpenseFormPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'budgets',
        element: (
          <SuspenseWrapper>
            <BudgetViewPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'groups',
        element: (
          <SuspenseWrapper>
            <GroupListPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'groups/:id/expenses/new',
        element: (
          <SuspenseWrapper>
            <GroupExpenseForm />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'groups/:id',
        element: (
          <SuspenseWrapper>
            <GroupDetailPage />
          </SuspenseWrapper>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <ExpensesTab />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'settlements',
            element: (
              <SuspenseWrapper>
                <SettlementsTab />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'activity',
            element: (
              <SuspenseWrapper>
                <ActivityLogTab />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'members',
            element: (
              <SuspenseWrapper>
                <MembersTab />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'analytics',
        element: (
          <SuspenseWrapper>
            <AnalyticsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'import',
        element: (
          <SuspenseWrapper>
            <ImportPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'recaps',
        element: (
          <SuspenseWrapper>
            <RecapsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'recurring',
        element: (
          <SuspenseWrapper>
            <RecurringBillsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'notifications',
        element: (
          <SuspenseWrapper>
            <NotificationsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsLayout />
          </SuspenseWrapper>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <ProfileSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'security',
            element: (
              <SuspenseWrapper>
                <SecuritySettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'appearance',
            element: (
              <SuspenseWrapper>
                <AppearanceSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'groups',
            element: (
              <SuspenseWrapper>
                <GroupsSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'about',
            element: (
              <SuspenseWrapper>
                <AboutSettings />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'data',
            element: (
              <SuspenseWrapper>
                <DataExportSettings />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'admin',
        element: (
          <SuspenseWrapper>
            <AdminPage />
          </SuspenseWrapper>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <AdminDashboardPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'users',
            element: (
              <SuspenseWrapper>
                <AdminUsersPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'monitoring',
            element: (
              <SuspenseWrapper>
                <AdminMonitoringPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'jobs',
            element: (
              <SuspenseWrapper>
                <AdminJobsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'debug',
            element: (
              <SuspenseWrapper>
                <AdminDebugPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'security',
            element: (
              <SuspenseWrapper>
                <AdminSecurityPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'alerts',
            element: (
              <SuspenseWrapper>
                <AdminAlertsPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'config',
            element: (
              <SuspenseWrapper>
                <AdminConfigPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'audit-log',
            element: (
              <SuspenseWrapper>
                <AdminAuditLogPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'health',
            element: (
              <SuspenseWrapper>
                <AdminHealthPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: (
      <SuspenseWrapper>
        <NotFoundPage />
      </SuspenseWrapper>
    ),
  },
]);
