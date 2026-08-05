import { useEffect, useMemo, useState } from 'react';
import { useParams, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { silentCatch } from '../../lib/errorHandler';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { joinGroupRoom, leaveGroupRoom } from '../../hooks/useWebSocket';
import { formatCurrency } from '@coldfi/shared';

const TABS = [
  { path: '', label: 'Overview' },
  { path: 'expenses', label: 'Expenses' },
  { path: 'invoices', label: 'Invoice' },
  { path: 'analytics', label: 'Analytics' },
  { path: 'ex-members', label: 'Ex-Members' },
  { path: 'activity', label: 'Activity Log' },
  { path: 'statement', label: 'Statement' },
  { path: 'members', label: 'Members' },
  { path: 'settings', label: 'Settings' },
];

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentGroup, fetchGroupById, leaveGroup, isLoading, error: storeError } = useGroupStore();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (id) fetchGroupById(id);
    return () => { if (useGroupStore.getState().error !== null) useGroupStore.setState({ isLoading: false, error: null }); };
  }, [id, fetchGroupById]);

  const groupDataVersion = useGroupStore((s) => (id ? s.groupDataVersions?.[id] || 0 : 0));
  useEffect(() => {
    if (id && groupDataVersion > 0) fetchGroupById(id);
  }, [id, groupDataVersion, fetchGroupById]);

  useEffect(() => {
    if (!id) return;
    joinGroupRoom(id);
    return () => leaveGroupRoom(id);
  }, [id]);

  const activeTab = location.pathname.replace(`/groups/${id}`, '') || '';
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaving, setLeaving] = useState(false);

  const isGroupAdmin = useMemo(
    () => currentGroup?.members.some((m) => m.userId === userId && m.role === 'admin' && !m.leftAt) ?? false,
    [currentGroup, userId]
  );
  const visibleTabs = useMemo(
    () => (isGroupAdmin ? TABS : TABS.filter((t) => t.path !== 'settings')),
    [isGroupAdmin]
  );

  async function handleLeave() {
    if (!id || leaving) return;
    setLeaving(true);
    setLeaveError('');
    try {
      await leaveGroup(id);
      navigate('/groups', { replace: true });
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave group. Please try again.');
      silentCatch('GroupDetailPage.leave', err);
      setLeaveConfirm(false);
    } finally {
      setLeaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (!currentGroup) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <svg className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">Group not found</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {storeError || 'This group could not be loaded. It may have been deleted or you may no longer be a member.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => id && fetchGroupById(id)} className="btn-primary">Try Again</button>
          <Link to="/groups" className="btn-secondary">Back to Groups</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 shadow-sm">
            <span className="text-2xl font-bold text-white">
              {currentGroup.name?.charAt(0).toUpperCase() || 'G'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white truncate">{currentGroup.name}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              <span className="font-medium">{currentGroup.members?.filter((m) => !m.leftAt).length || 0}</span> members
              <span className="mx-2 text-neutral-300 dark:text-neutral-600">·</span>
              Your balance:{' '}
              <span className={`font-semibold ${(currentGroup.myBalance || 0) >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-500 dark:text-danger-400'}`}>
                {formatCurrency(currentGroup.myBalance || 0, currentGroup.defaultCurrency || useAuthStore.getState().defaultCurrency)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
          <Link to={`/groups/${id}/expenses/new`} className="btn-primary text-sm flex-1 sm:flex-initial">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Add Expense</span>
          </Link>
          {leaveConfirm ? (
            <div className="flex items-center gap-2">
              <button onClick={handleLeave} disabled={leaving} className="btn-ghost text-sm border border-danger-300 dark:border-danger-600 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20">
                {leaving ? 'Leaving...' : 'Confirm Leave'}
              </button>
              <button onClick={() => setLeaveConfirm(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setLeaveConfirm(true)} className="btn-ghost text-sm text-danger-500 dark:text-danger-400 hover:text-danger-600 dark:hover:text-danger-300 shrink-0" title="Leave group">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              <span className="hidden sm:inline">Leave</span>
            </button>
          )}
        </div>
      </div>

      {leaveError && (
        <div className="mb-4 rounded-xl border border-danger-200 dark:border-danger-800/50 bg-danger-50 dark:bg-danger-900/20 p-3">
          <p className="text-sm text-danger-700 dark:text-danger-300">{leaveError}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-neutral-200/80 dark:border-neutral-700/60">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const isActive =
              (tab.path === '' && activeTab === '') ||
              (tab.path !== '' && activeTab === '/' + tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`shrink-0 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium rounded-t-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-white dark:bg-neutral-800/90 text-primary-600 dark:text-primary-400 border-t border-l border-r border-neutral-200/80 dark:border-neutral-700/60 -mb-px'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <Outlet context={{ groupId: id, group: currentGroup, currentUserId: userId }} />
    </div>
  );
}
