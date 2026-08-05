import { useEffect, useState } from 'react';
import { useAdminUserStore } from '../../stores/adminUserStore';
import UserTable from './UserTable';
import UserDetailPanel from './UserDetailPanel';
import UserConfirmDialog from './UserConfirmDialog';

export default function AdminUsersPage() {
  const { users, userDetail, userActivity, fetchUsers, fetchUserDetail, fetchUserActivity, forceLogout, suspendUser, banUser, restoreUser, deleteUser } = useAdminUserStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; title: string; message: string; reason?: boolean; hours?: boolean } | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchUsers({ page, search, status: statusFilter || undefined });
  }, [fetchUsers, page, search, statusFilter]);

  function handleSearch() {
    setPage(1);
  }

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    fetchUserDetail(userId);
    fetchUserActivity(userId);
  }

  async function handleAction(action: string, userId: string) {
    setActionLoading(true);
    try {
      switch (action) {
        case 'force-logout': await handleConfirmAction(action, userId, ''); break;
        case 'restore': await handleConfirmAction(action, userId, ''); break;
        case 'delete': setConfirmDialog({
          action: 'delete', title: 'Delete User', message: 'Permanently delete this user and all data?',
        }); return;
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmAction(action: string, userId: string, reason: string, duration?: string) {
    setActionLoading(true);
    setConfirmDialog(null);
    setActionError('');
    try {
      switch (action) {
        case 'force-logout': await forceLogout(userId); break;
        case 'restore': await restoreUser(userId); break;
        case 'delete': await deleteUser(userId); break;
        case 'suspend': await suspendUser(userId, reason, duration ? parseInt(duration) : undefined); break;
        case 'ban': await banUser(userId, reason); break;
      }
      if (selectedUserId === userId) selectUser(userId);
      fetchUsers({ page, search, status: statusFilter || undefined });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">User Management</h1>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="flex gap-3">
        <input type="text" placeholder="Search by display name..." value={search}
          onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm" />
        <select value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-neutral-300 rounded-lg text-sm">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {users && (
            <UserTable
              items={users.items || []}
              pagination={users.pagination}
              selectedUserId={selectedUserId}
              page={page}
              onSelectUser={selectUser}
              onPageChange={setPage}
            />
          )}
        </div>

        {selectedUserId && userDetail && (
          <UserDetailPanel
            userDetail={userDetail}
            userActivity={userActivity}
            selectedUserId={selectedUserId}
            actionLoading={actionLoading}
            onAction={handleAction}
            onSuspend={() => setConfirmDialog({
              action: 'suspend', title: 'Suspend User', message: 'Enter suspension reason and optional duration.', reason: true, hours: true,
            })}
            onBan={() => setConfirmDialog({
              action: 'ban', title: 'Ban User', message: 'Enter ban reason.', reason: true,
            })}
          />
        )}
      </div>

      {confirmDialog && (
        <UserConfirmDialog
          config={confirmDialog}
          loading={actionLoading}
          onConfirm={(action, reason, duration) => {
            if (!selectedUserId) return;
            if (confirmDialog.reason && !reason.trim()) return;
            handleConfirmAction(action, selectedUserId, reason.trim(), duration);
          }}
          onClose={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
