import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminUsersPage() {
  const { users, userDetail, userActivity, loading, fetchUsers, fetchUserDetail, fetchUserActivity, forceLogout, suspendUser, banUser, restoreUser, deleteUser } = useAdminStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; title: string; message: string; reason?: boolean; hours?: boolean } | null>(null);
  const [dialogInput, setDialogInput] = useState('');
  const [dialogInput2, setDialogInput2] = useState('');

  useEffect(() => {
    fetchUsers({ page, search, status: statusFilter || undefined });
  }, [fetchUsers, page]);

  function handleSearch() {
    setPage(1);
    fetchUsers({ page: 1, search, status: statusFilter || undefined });
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
        case 'force-logout': handleConfirmAction(action, userId, ''); break;
        case 'restore': handleConfirmAction(action, userId, ''); break;
        case 'delete': setConfirmDialog({
          action: 'delete',
          title: 'Delete User',
          message: 'Permanently delete this user and all data?',
        }); return;
      }
    } finally {
      setActionLoading(false);
    }
  }

  function handleConfirmAction(action: string, userId: string, reason: string) {
    setActionLoading(true);
    setConfirmDialog(null);
    (async () => {
      try {
        switch (action) {
          case 'force-logout': await forceLogout(userId); break;
          case 'restore': await restoreUser(userId); break;
          case 'delete': await deleteUser(userId); break;
          case 'suspend': await suspendUser(userId, reason, dialogInput2 ? parseInt(dialogInput2) : undefined); break;
          case 'ban': await banUser(userId, reason); break;
        }
        if (selectedUserId === userId) selectUser(userId);
        fetchUsers({ page, search, status: statusFilter || undefined });
      } finally {
        setActionLoading(false);
      }
    })();
  }

  function promptSuspend() {
    if (!selectedUserId) return;
    setDialogInput('');
    setDialogInput2('');
    setConfirmDialog({
      action: 'suspend',
      title: 'Suspend User',
      message: 'Enter suspension reason and optional duration.',
      reason: true,
      hours: true,
    });
  }

  function promptBan() {
    if (!selectedUserId) return;
    setDialogInput('');
    setConfirmDialog({
      action: 'ban',
      title: 'Ban User',
      message: 'Enter ban reason.',
      reason: true,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">User Management</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by display name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); fetchUsers({ page: 1, search, status: e.target.value || undefined }); }}
          className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {users && (
            <>
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-neutral-500">
                      <th className="p-3">Name</th>
                      <th className="p-3">Email (hash)</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.items?.map((u: any) => (
                      <tr
                        key={u.id}
                        onClick={() => selectUser(u.id)}
                        className={`border-b border-neutral-100 cursor-pointer hover:bg-neutral-50 ${
                          selectedUserId === u.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <td className="p-3 font-medium text-neutral-900">{u.displayName || 'N/A'}</td>
                        <td className="p-3 font-mono text-xs text-neutral-500">{u.emailHash}...</td>
                        <td className="p-3">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="p-3 text-neutral-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-neutral-500">Total: {users.pagination.total}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      disabled={page * 50 >= users.pagination.total}
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedUserId && userDetail && (
          <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900">User Detail</h2>
              <StatusBadge status={userDetail.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-neutral-500">Display Name:</span>
                <p className="font-medium">{userDetail.displayName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-neutral-500">Email Hash:</span>
                <p className="font-mono text-xs">{userDetail.emailHash}...</p>
              </div>
              <div>
                <span className="text-neutral-500">Created:</span>
                <p>{new Date(userDetail.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-neutral-500">Groups:</span>
                <p>{userDetail.groupCount}</p>
              </div>
              <div>
                <span className="text-neutral-500">Activities (30d):</span>
                <p>{userDetail.activity30d}</p>
              </div>
              <div>
                <span className="text-neutral-500">Blob Size:</span>
                <p>{(userDetail.blobSizeBytes / 1024).toFixed(1)} KB</p>
              </div>
            </div>

            {userDetail.restrictions?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Restrictions</h3>
                {userDetail.restrictions.map((r: any) => (
                  <div key={r.created_at} className="bg-red-50 rounded p-2 text-sm">
                    <span className="font-medium capitalize">{r.type}</span>: {r.reason}
                    {r.expires_at && <span className="text-neutral-500 ml-2">(until {new Date(r.expires_at).toLocaleDateString()})</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleAction('force-logout', selectedUserId)} disabled={actionLoading} className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded hover:bg-orange-100">
                Force Logout
              </button>
              {userDetail.status === 'active' && (
                <>
                  <button onClick={promptSuspend} disabled={actionLoading} className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">
                    Suspend
                  </button>
                  <button onClick={promptBan} disabled={actionLoading} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">
                    Ban
                  </button>
                </>
              )}
              {(userDetail.status === 'suspended' || userDetail.status === 'banned') && (
                <button onClick={() => handleAction('restore', selectedUserId)} disabled={actionLoading} className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100">
                  Restore
                </button>
              )}
              <button onClick={() => handleAction('delete', selectedUserId)} disabled={actionLoading} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">
                Delete
              </button>
            </div>

            {userActivity && userActivity.items?.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-neutral-700 mb-2">Recent Activity</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {userActivity.items.map((a: any) => (
                    <div key={a.id} className="flex justify-between text-xs text-neutral-600">
                      <span>{a.action}</span>
                      <span>{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmDialog(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-neutral-900">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-neutral-600">{confirmDialog.message}</p>
            {confirmDialog.reason && (
              <input
                type="text"
                value={dialogInput}
                onChange={(e) => setDialogInput(e.target.value)}
                placeholder="Reason"
                className="input-field mt-3"
                autoFocus
              />
            )}
            {confirmDialog.hours && (
              <input
                type="number"
                value={dialogInput2}
                onChange={(e) => setDialogInput2(e.target.value)}
                placeholder="Duration in hours (blank = permanent)"
                className="input-field mt-2"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmDialog(null)} className="btn-ghost">Cancel</button>
              <button
                onClick={() => {
                  if (!selectedUserId) return;
                  if (confirmDialog.reason && !dialogInput.trim()) return;
                  handleConfirmAction(confirmDialog.action, selectedUserId, dialogInput.trim());
                }}
                disabled={actionLoading || (confirmDialog.reason && !dialogInput.trim())}
                className="btn-primary"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-yellow-100 text-yellow-800',
    banned: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-neutral-100 text-neutral-800'}`}>
      {status}
    </span>
  );
}
