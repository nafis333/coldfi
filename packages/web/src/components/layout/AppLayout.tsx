import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTabSync } from '../../hooks/useTabSync';
import { useWebSocket } from '../../hooks/useWebSocket';
import ConnectionStatus from '../ConnectionStatus';
import PekPromptModal from '../PekPromptModal';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/expenses', label: 'Expenses', icon: '💰' },
  { to: '/import', label: 'Import', icon: '📥' },
  { to: '/groups', label: 'Groups', icon: '👥' },
  { to: '/recurring', label: 'Recurring', icon: '🔄' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const email = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const logout = useAuthStore((s) => s.logout);

  useTabSync();
  const { connectionState, forceReconnect } = useWebSocket();

  const userLabel = displayName ?? email ?? '';
  const avatarInitial = userLabel.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 bg-white border-r border-neutral-200
          transition-all duration-200 ease-in-out
          hidden md:flex md:flex-col
          ${sidebarCollapsed ? 'w-16' : 'w-60'}
        `}
      >
        <div className={`flex items-center h-16 border-b border-neutral-200 px-4 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <span className="text-xl font-bold text-primary-600">CF</span>
          {!sidebarCollapsed && <span className="ml-2 text-lg font-bold text-neutral-900">ColdFi</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="text-sm truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-2 py-2 border-t border-neutral-200">
          <ConnectionStatus connectionState={connectionState} onReconnect={forceReconnect} />
        </div>

        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex items-center justify-center h-12 border-t border-neutral-200 text-neutral-400 hover:text-neutral-600"
        >
          {sidebarCollapsed ? '\u203A' : '\u2039'}
        </button>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 bg-white border-r border-neutral-200 transition-transform duration-200 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} w-60`}>
        <div className="flex items-center h-16 border-b border-neutral-200 px-4">
          <span className="text-xl font-bold text-primary-600">CF</span>
          <span className="ml-2 text-lg font-bold text-neutral-900">ColdFi</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <span className="text-lg shrink-0">{item.icon}</span>
                <span className="text-sm truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className={`flex-1 flex flex-col min-h-screen ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-60'}`}>
        <header className="sticky top-0 z-20 bg-white border-b border-neutral-200 h-16 flex items-center justify-between px-4 lg:px-6">
          <button
            className="md:hidden p-2 text-neutral-500 hover:text-neutral-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600 hidden sm:block">{userLabel}</span>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-600">{avatarInitial}</span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-neutral-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-200 flex md:hidden pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center py-2 min-h-[56px] justify-center ${
                isActive ? 'text-primary-600' : 'text-neutral-500'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <PekPromptModal />
    </div>
  );
}
