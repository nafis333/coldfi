import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import CreateGroupModal from './CreateGroupModal';
import JoinGroupModal from './JoinGroupModal';

interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
}

function GroupCard({ group, onSelect }: { group: GroupSummary; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="flex w-full items-center rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:border-primary-300 hover:shadow-sm"
    >
      <div className="mr-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100">
        <span className="text-xl font-bold text-primary-600">
          {group.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-neutral-900">{group.name}</p>
        <p className="text-sm text-neutral-500">
          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="ml-3 text-right">
        <p className={`text-base font-bold ${group.yourBalance >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
          {group.yourBalance >= 0 ? '+' : ''}${Math.abs(group.yourBalance).toFixed(2)}
        </p>
      </div>
    </button>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();
  const { groups, fetchGroups, isLoading } = useGroupStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  if (isLoading && groups.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Groups</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Shared expense groups with friends
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowJoin(true)} className="btn-secondary">
            Join Group
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            + Create Group
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card px-5 py-12 text-center">
          <p className="text-sm font-medium text-neutral-500">No groups yet</p>
          <p className="mt-1 text-xs text-neutral-400">
            Create a group to start splitting expenses
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
            Create your first group
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              onSelect={() => navigate(`/groups/${g.id}`)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} />}
    </div>
  );
}
