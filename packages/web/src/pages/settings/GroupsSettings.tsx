import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';

export default function GroupsSettings() {
  const navigate = useNavigate();
  const { groups, fetchGroups, leaveGroup } = useGroupStore();
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleLeave = async (groupId: string) => {
    setLeaving(groupId);
    try {
      await leaveGroup(groupId);
    } catch {
      // Error handled by store
    } finally {
      setLeaving(null);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900">Groups</h2>
      <p className="mb-4 text-sm text-neutral-500">Groups you have joined.</p>
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-400">You haven't joined any groups yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(groups as Array<{ id: string; name: string; memberCount: number }>).map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{g.name}</p>
                <p className="text-xs text-neutral-500">{g.memberCount} members</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => navigate(`/groups/${g.id}`)}
                  className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-100"
                >
                  View
                </button>
                <button
                  onClick={() => handleLeave(g.id)}
                  disabled={leaving === g.id}
                  className="rounded-lg bg-danger-50 px-3 py-1.5 text-xs font-semibold text-danger-600 hover:bg-danger-100 disabled:opacity-60"
                >
                  {leaving === g.id ? 'Leaving...' : 'Leave'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
