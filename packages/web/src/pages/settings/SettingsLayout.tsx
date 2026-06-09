import { Outlet, NavLink } from 'react-router-dom';

const SETTINGS_LINKS = [
  { to: '/settings', label: 'Profile', end: true },
  { to: '/settings/security', label: 'Security' },
  { to: '/settings/appearance', label: 'Appearance' },
  { to: '/settings/groups', label: 'Groups' },
  { to: '/settings/data', label: 'Data Export' },
  { to: '/settings/about', label: 'About' },
];

export default function SettingsLayout() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Settings</h1>
      <div className="flex gap-8">
        <nav className="flex w-48 shrink-0 flex-col gap-1">
          {SETTINGS_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
