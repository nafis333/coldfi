import { useEffect } from 'react';
import { useParams, Outlet, useLocation, Link } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';

const TABS = [
  { path: '', label: 'Expenses' },
  { path: 'settlements', label: 'Settlements' },
  { path: 'activity', label: 'Activity Log' },
  { path: 'members', label: 'Members' },
];

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { currentGroup, fetchGroupById, isLoading } = useGroupStore();
  const userId = useAuthStore((s) => s.userId);

  useEffect(() => {
    if (id) fetchGroupById(id);
    return () => { useGroupStore.setState({ currentGroup: null }); };
  }, [id, fetchGroupById]);

  const activeTab = location.pathname.replace(`/groups/${id}`, '') || '';

  if (isLoading || !currentGroup) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-100">
          <span className="text-2xl font-bold text-primary-600">
            {currentGroup.name?.charAt(0).toUpperCase() || 'G'}
          </span>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-neutral-900">{currentGroup.name}</h1>
          <p className="text-sm text-neutral-500">
            {currentGroup.members?.length || 0} members · Your balance:{' '}
            <span className={`font-semibold ${(currentGroup.myBalance || 0) >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
              {formatCurrency(currentGroup.myBalance || 0, 'USD')}
            </span>
          </p>
        </div>
        <Link
          to={`/groups/${id}/expenses/new`}
          className="btn-primary"
        >
          + Add Expense
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-neutral-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const isActive =
              (tab.path === '' && activeTab === '') ||
              (tab.path !== '' && activeTab === '/' + tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-b-2 border-primary-600 text-primary-600'
                    : 'text-neutral-500 hover:text-neutral-700'
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
