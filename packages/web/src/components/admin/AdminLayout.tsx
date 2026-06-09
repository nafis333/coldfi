import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/monitoring', label: 'Monitoring' },
  { to: '/admin/jobs', label: 'Jobs' },
  { to: '/admin/debug', label: 'Debug' },
  { to: '/admin/security', label: 'Security' },
  { to: '/admin/alerts', label: 'Alerts' },
  { to: '/admin/config', label: 'Config' },
  { to: '/admin/audit-log', label: 'Audit Log' },
  { to: '/admin/health', label: 'Health' },
];

export default function AdminLayout() {
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);

  if (role !== 'owner') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">Admin Panel</h2>
          <p className="text-xs text-neutral-500 truncate">{email}</p>
        </div>
        <nav className="p-2 space-y-1">
          {ADMIN_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto bg-neutral-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
