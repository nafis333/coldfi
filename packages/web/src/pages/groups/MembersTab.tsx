import { useOutletContext } from 'react-router-dom';

interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  balance: number;
  joinedAt: string;
}

interface TabContext {
  groupId: string;
  group: { members: Member[] };
  currentUserId: string;
}

export default function MembersTab() {
  const { group, currentUserId } = useOutletContext<TabContext>();

  return (
    <div className="space-y-3">
      {group.members?.map((member: Member) => (
        <div key={member.userId} className="card flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600">
            {member.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-neutral-900">
              {member.displayName}
              {member.userId === currentUserId && (
                <span className="ml-2 text-xs text-neutral-400">(you)</span>
              )}
            </p>
            <p className="text-xs text-neutral-500">{member.email}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${member.balance >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
              {member.balance >= 0 ? '+' : ''}${member.balance.toFixed(2)}
            </p>
            {member.role === 'admin' && (
              <span className="inline-block rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                Admin
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
