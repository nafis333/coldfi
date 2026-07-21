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
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Groups</h2>
      <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Groups you have joined.</p>
      {groups.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">You haven't joined any groups yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(groups as Array<{ id: string; name: string; memberCount: number }>).map((g) => (
            <div key={g.id} className="card flex items-center justify-between p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{g.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{g.memberCount} members</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => navigate(`/groups/${g.id}`)}
                  className="rounded-lg bg-primary-50 dark:bg-primary-900/30 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => handleLeave(g.id)}
                  disabled={leaving === g.id}
                  className="rounded-lg bg-danger-50 dark:bg-danger-900/20 px-3 py-1.5 text-xs font-semibold text-danger-600 dark:text-danger-400 hover:bg-danger-100 dark:hover:bg-danger-900/40 disabled:opacity-60 transition-colors"
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