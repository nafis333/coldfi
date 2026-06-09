// DEAD CODE — Replaced by AppLayout.tsx inline sidebar. Remove when confirmed
// no remaining imports reference this file.
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import clsx from 'clsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/expenses', label: 'Expenses', icon: '💰' },
  { to: '/budgets', label: 'Budgets', icon: '🎯' },
  { to: '/groups', label: 'Groups', icon: '👥' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { email, logout } = useAuthStore();

  return (
    <aside className="flex w-60 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-neutral-200 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
          FT
        </div>
        <span className="text-lg font-semibold text-neutral-900">ColdFi</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              )
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-neutral-200 px-4 py-4">
        <div className="mb-3 truncate text-sm text-neutral-500">
          {email}
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors duration-150"
        >
          <span>🚪</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
