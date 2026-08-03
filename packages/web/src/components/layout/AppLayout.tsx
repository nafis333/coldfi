import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTabSync } from '../../hooks/useTabSync';
import { useWebSocket } from '../../hooks/useWebSocket';
import ConnectionStatus from '../ConnectionStatus';
import PekPromptModal from '../PekPromptModal';
import ToastContainer from '../ToastContainer';
import { useGlobalErrorToast } from '../../hooks/useGlobalErrorToast';
import ErrorDebugPanel from '../ErrorDebugPanel';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
  ) },
  { to: '/expenses', label: 'Expenses', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ) },
  { to: '/budgets', label: 'Budgets', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ) },
  { to: '/analytics', label: 'Analytics', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
  ) },
  { to: '/import', label: 'Import', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
  ) },
  { to: '/recaps', label: 'Recaps', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  ) },
  { to: '/groups', label: 'Groups', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
  ) },
  { to: '/recurring', label: 'Recurring', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
  ) },
  { to: '/notifications', label: 'Notifications', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
  ) },
  { to: '/settings', label: 'Settings', icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ) },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const email = useAuthStore((s) => s.email);
  const displayName = useAuthStore((s) => s.displayName);
  const logout = useAuthStore((s) => s.logout);

  const lastActivityRef = useRef(0);
  const updateActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < 30000) return;
    lastActivityRef.current = now;
    localStorage.setItem('coldfi:lastActivity', String(now));
  }, []);

  useEffect(() => {
    updateActivity();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, updateActivity));
    return () => events.forEach((e) => window.removeEventListener(e, updateActivity));
  }, [updateActivity]);

  useTabSync();
  useGlobalErrorToast();
  const { connectionState, forceReconnect } = useWebSocket();

  const userLabel = displayName ?? email ?? '';
  const avatarInitial = userLabel.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex">
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 bg-white dark:bg-neutral-800/95 border-r border-neutral-200/80 dark:border-neutral-700/60
          transition-all duration-300 ease-in-out
          hidden md:flex md:flex-col
          ${sidebarOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full'}
        `}
      >
        <div className="flex items-center h-16 border-b border-neutral-200/80 dark:border-neutral-700/60 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold shadow-sm">
            CF
          </div>
          <span className="ml-3 text-lg font-bold text-neutral-900 dark:text-white">ColdFi</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] ${
                  isActive
                    ? 'sidebar-link-active'
                    : 'sidebar-link'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400" />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-neutral-200/80 dark:border-neutral-700/60">
          <ConnectionStatus connectionState={connectionState} onReconnect={forceReconnect} />
        </div>

        <button
          onClick={() => setSidebarOpen(false)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-neutral-200/80 dark:border-neutral-700/60 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors"
          title="Close sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
        </button>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 bg-white dark:bg-neutral-800/95 border-r border-neutral-200/80 dark:border-neutral-700/60 transition-transform duration-300 ease-in-out md:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} w-60`}>
        <div className="flex items-center h-16 border-b border-neutral-200/80 dark:border-neutral-700/60 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white text-sm font-bold shadow-sm">
            CF
          </div>
          <span className="ml-3 text-lg font-bold text-neutral-900 dark:text-white">ColdFi</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] ${
                  isActive
                    ? 'sidebar-link-active'
                    : 'sidebar-link'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className={`flex-1 flex flex-col min-h-screen ${sidebarOpen ? 'md:ml-60' : 'md:ml-0'}`}>
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-700/60 h-16 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <button
              className="md:hidden p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 rounded-xl transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              title="Open navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              className="hidden md:flex p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/60 rounded-xl transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              )}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hidden sm:block">{userLabel}</span>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-white">{avatarInitial}</span>
            </div>
            <button
              onClick={logout}
              className="p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-xl transition-colors"
              title="Logout"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-neutral-700/60 flex md:hidden pb-[env(safe-area-inset-bottom)] safe-bottom">
        <div className="flex flex-1 justify-around px-1">
          {NAV_ITEMS.filter(i => ['/dashboard', '/expenses', '/groups', '/settings'].includes(i.to)).map((item) => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center py-1.5 min-h-[52px] justify-center relative transition-colors duration-150 min-w-0 ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {isActive && <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-b-full" />}
                <span className="[&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
                <span className="text-[10px] font-semibold mt-0.5">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <PekPromptModal />
      <ErrorDebugPanel />
      <ToastContainer />

    </div>
  );
}
