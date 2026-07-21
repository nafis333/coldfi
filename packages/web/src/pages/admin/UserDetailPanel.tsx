import StatusBadge from './StatusBadge';

interface Restriction {
  type: string;
  reason: string;
  expires_at?: string;
  created_at?: string;
  createdAt?: string;
}

interface ActivityItem {
  id: string;
  action: string;
  created_at?: string;
  createdAt?: string;
}

interface UserDetailData {
  displayName?: string;
  emailHash: string;
  status: string;
  createdAt: string;
  groupCount: number;
  activity30d: number;
  blobSizeBytes: number;
  restrictions?: Restriction[];
}

interface ActivityData {
  items?: ActivityItem[];
}

interface UserDetailPanelProps {
  userDetail: UserDetailData;
  userActivity: ActivityData | null;
  selectedUserId: string;
  actionLoading: boolean;
  onAction: (action: string, userId: string) => void;
  onSuspend: () => void;
  onBan: () => void;
}

export default function UserDetailPanel({
  userDetail, userActivity, selectedUserId, actionLoading, onAction, onSuspend, onBan,
}: UserDetailPanelProps) {
  return (
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

      {userDetail.restrictions && userDetail.restrictions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-2">Restrictions</h3>
          {userDetail.restrictions.map((r, i) => (
            <div key={r.created_at || r.createdAt || i} className="bg-red-50 rounded p-2 text-sm">
              <span className="font-medium capitalize">{r.type}</span>: {r.reason}
              {r.expires_at && <span className="text-neutral-500 ml-2">(until {new Date(r.expires_at).toLocaleDateString()})</span>}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onAction('force-logout', selectedUserId)} disabled={actionLoading}
          className="px-3 py-1.5 text-sm bg-orange-50 text-orange-700 rounded hover:bg-orange-100">Force Logout</button>
        {userDetail.status === 'active' && (
          <>
            <button onClick={onSuspend} disabled={actionLoading}
              className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">Suspend</button>
            <button onClick={onBan} disabled={actionLoading}
              className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Ban</button>
          </>
        )}
        {(userDetail.status === 'suspended' || userDetail.status === 'banned') && (
          <button onClick={() => onAction('restore', selectedUserId)} disabled={actionLoading}
            className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded hover:bg-green-100">Restore</button>
        )}
        <button onClick={() => onAction('delete', selectedUserId)} disabled={actionLoading}
          className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
      </div>

      {userActivity && userActivity.items && userActivity.items.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-neutral-700 mb-2">Recent Activity</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {userActivity.items.map((a) => (
              <div key={a.id} className="flex justify-between text-xs text-neutral-600">
                <span>{a.action}</span>
                <span>{new Date(a.created_at || a.createdAt || '').toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
