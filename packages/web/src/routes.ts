import { createElement, lazy } from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SuspenseWrapper from './components/SuspenseWrapper';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const RecoveryPage = lazy(() => import('./pages/RecoveryPage'));
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
const ActivityLogTab = lazy(() => import('./pages/groups/ActivityLogTab'));
const MembersTab = lazy(() => import('./pages/groups/MembersTab'));
const GroupSettingsTab = lazy(() => import('./pages/groups/GroupSettingsTab'));
const PersonalLogTab = lazy(() => import('./pages/groups/PersonalLogTab'));
const GroupExpenseForm = lazy(() => import('./pages/groups/GroupExpenseForm'));
const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout'));
const ProfileSettings = lazy(() => import('./pages/settings/ProfileSettings'));
const SecuritySettings = lazy(() => import('./pages/settings/SecuritySettings'));
const AppearanceSettings = lazy(() => import('./pages/settings/AppearanceSettings'));
const GroupsSettings = lazy(() => import('./pages/settings/GroupsSettings'));
const AboutSettings = lazy(() => import('./pages/settings/AboutSettings'));
const DataExportSettings = lazy(() => import('./pages/settings/DataExportSettings'));
const NotificationPreferencesSettings = lazy(() => import('./pages/settings/NotificationPreferencesSettings'));
const ImportPage = lazy(() => import('./pages/import/ImportPage'));
const GroupOverviewTab = lazy(() => import('./pages/groups/GroupOverviewTab'));
const GroupInvoicesTab = lazy(() => import('./pages/groups/GroupInvoicesTab'));
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

function wrap(page: React.LazyExoticComponent<React.ComponentType<any>>) {
  return createElement(SuspenseWrapper, null, createElement(page));
}

export const routes = [
  { path: '/login', element: wrap(LoginPage) },
  { path: '/register', element: wrap(RegisterPage) },
  { path: '/forgot-password', element: createElement(Navigate, { to: '/recover', replace: true }) },
  { path: '/reset-password', element: createElement(Navigate, { to: '/recover', replace: true }) },
  { path: '/recover', element: wrap(RecoveryPage) },
  {
    path: '/',
    element: createElement(ProtectedRoute),
    children: [
      { index: true, element: createElement(Navigate, { to: '/dashboard', replace: true }) },
      { path: 'dashboard', element: wrap(DashboardPage) },
      { path: 'expenses', element: wrap(ExpenseListPage) },
      { path: 'expenses/new', element: wrap(ExpenseFormPage) },
      { path: 'expenses/:id/edit', element: wrap(ExpenseFormPage) },
      { path: 'budgets', element: wrap(BudgetViewPage) },
      { path: 'groups', element: wrap(GroupListPage) },
      { path: 'groups/:id/expenses/new', element: wrap(GroupExpenseForm) },
      {
        path: 'groups/:id',
        element: wrap(GroupDetailPage),
        children: [
          { index: true, element: wrap(GroupOverviewTab) },
          { path: 'expenses', element: wrap(ExpensesTab) },
          { path: 'invoices', element: wrap(GroupInvoicesTab) },
          { path: 'activity', element: wrap(ActivityLogTab) },
          { path: 'statement', element: wrap(PersonalLogTab) },
          { path: 'members', element: wrap(MembersTab) },
          { path: 'settings', element: wrap(GroupSettingsTab) },
        ],
      },
      { path: 'analytics', element: wrap(AnalyticsPage) },
      { path: 'import', element: wrap(ImportPage) },
      { path: 'recaps', element: wrap(RecapsPage) },
      { path: 'recurring', element: wrap(RecurringBillsPage) },
      { path: 'notifications', element: wrap(NotificationsPage) },
      {
        path: 'settings',
        element: wrap(SettingsLayout),
        children: [
          { index: true, element: wrap(ProfileSettings) },
          { path: 'security', element: wrap(SecuritySettings) },
          { path: 'appearance', element: wrap(AppearanceSettings) },
          { path: 'groups', element: wrap(GroupsSettings) },
          { path: 'notifications', element: wrap(NotificationPreferencesSettings) },
          { path: 'about', element: wrap(AboutSettings) },
          { path: 'data', element: wrap(DataExportSettings) },
        ],
      },
      {
        path: 'admin',
        element: wrap(AdminPage),
        children: [
          { index: true, element: wrap(AdminDashboardPage) },
          { path: 'users', element: wrap(AdminUsersPage) },
          { path: 'monitoring', element: wrap(AdminMonitoringPage) },
          { path: 'jobs', element: wrap(AdminJobsPage) },
          { path: 'debug', element: wrap(AdminDebugPage) },
          { path: 'security', element: wrap(AdminSecurityPage) },
          { path: 'alerts', element: wrap(AdminAlertsPage) },
          { path: 'config', element: wrap(AdminConfigPage) },
          { path: 'audit-log', element: wrap(AdminAuditLogPage) },
          { path: 'health', element: wrap(AdminHealthPage) },
        ],
      },
    ],
  },
  { path: '*', element: wrap(NotFoundPage) },
];
