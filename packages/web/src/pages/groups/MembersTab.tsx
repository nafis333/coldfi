import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { silentCatch } from '../../lib/errorHandler';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';

interface Member {
  userId: string;
  displayName: string;
  role: 'admin' | 'member';
  balance: number;
  joinedAt: string;
  leftAt?: string | null;
}

interface TabContext {
  groupId: string;
  group: {
    members: Member[];
    defaultCurrency: string;
    balances: { userId: string; net: number; owesTo: Record<string, number>; owedBy: Record<string, number> }[];
  };
  currentUserId: string;
}

export default function MembersTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const { leaveGroup, removeMember, updateMemberRole } = useGroupStore();
  const navigate = useNavigate();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const activeMembers = group.members.filter((m) => !m.leftAt);
  const formerMembers = group.members.filter((m) => m.leftAt);
  const currentUserIsAdmin = activeMembers.find((m) => m.userId === currentUserId)?.role === 'admin';

  const balances = group.balances ?? [];
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;

  function memberBalance(userId: string) {
    return balances.find((b) => b.userId === userId);
  }

  function balanceLabel(userId: string): { text: string; className: string } {
    const bal = memberBalance(userId);
    if (!bal) return { text: formatCurrency(0, defaultCurrency), className: 'text-neutral-500' };
    if (bal.net > 0) return { text: `+${formatCurrency(bal.net, defaultCurrency) || '0'}`, className: 'text-success-600 dark:text-success-400' };
    if (bal.net < 0) return { text: `-${formatCurrency(Math.abs(bal.net), defaultCurrency)}`, className: 'text-danger-500 dark:text-danger-400' };
    return { text: formatCurrency(0, defaultCurrency), className: 'text-neutral-500' };
  }

  function breakdownText(userId: string): string {
    const bal = memberBalance(userId);
    if (!bal) return '';
    const owes = Object.entries(bal.owesTo);
    const owed = Object.entries(bal.owedBy);
    const allMembers = group.members;
    const parts: string[] = [];
    if (owes.length > 0) {
      for (const [other, amt] of owes) {
        const name = allMembers.find((m) => m.userId === other)?.displayName || other.slice(0, 6);
        parts.push(`owes ${name} ${formatCurrency(amt, defaultCurrency)}`);
      }
    }
    if (owed.length > 0) {
      for (const [other, amt] of owed) {
        const name = allMembers.find((m) => m.userId === other)?.displayName || other.slice(0, 6);
        parts.push(`owed by ${name} ${formatCurrency(amt, defaultCurrency)}`);
      }
    }
    return parts.join(', ');
  }

  async function handleLeave() {
    try {
      await leaveGroup(groupId);
      navigate('/groups', { replace: true });
    } catch (e) {
      silentCatch('MembersTab.leave', e);
    }
  }

  async function handleRemove(targetUserId: string) {
    if (!window.confirm('Remove this member? Their past splits stay in expenses but they will no longer have access.')) return;
    setRemovingUserId(targetUserId);
    try {
      await removeMember(groupId, targetUserId);
    } catch (e) {
      silentCatch('MembersTab.remove', e);
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: 'admin' | 'member') {
    try {
      await updateMemberRole(groupId, targetUserId, newRole);
    } catch (e) {
      silentCatch('MembersTab.role', e);
    }
  }

  function MemberCard({ member, isFormer }: { member: Member; isFormer?: boolean }) {
    const bLabel = balanceLabel(member.userId);
    const isSelf = member.userId === currentUserId;
    const isRemoving = removingUserId === member.userId;
    return (
      <div key={member.userId} className={`card flex items-center gap-4 p-4 ${isFormer ? 'opacity-60' : ''}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${isFormer ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400' : 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-300'}`}>
          {member.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 dark:text-white">
            {member.displayName}
            {isSelf && <span className="ml-2 text-xs text-neutral-400">(you)</span>}
            {isFormer && <span className="ml-2 text-xs text-neutral-500 italic">(left)</span>}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {member.role === 'admin' && !isFormer && (
              <span className="inline-block rounded bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">Admin</span>
            )}
            {isFormer && member.leftAt && (
              <span className="text-xs text-neutral-400">
                Left {new Date(member.leftAt).toLocaleDateString()}
              </span>
            )}
            {!isFormer && currentUserIsAdmin && !isSelf && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRoleChange(member.userId, member.role === 'admin' ? 'member' : 'admin')}
                  className="btn-ghost text-xs py-0.5 px-1.5"
                  title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                >
                  {member.role === 'admin' ? 'Demote' : 'Promote'}
                </button>
                <button
                  onClick={() => handleRemove(member.userId)}
                  disabled={isRemoving}
                  className="btn-ghost text-xs py-0.5 px-1.5 text-danger-500 hover:text-danger-600"
                >
                  {isRemoving ? '...' : 'Remove'}
                </button>
              </div>
            )}
          </div>
          {!isFormer && breakdownText(member.userId) && (
            <p className="mt-1 text-xs text-neutral-400 truncate">{breakdownText(member.userId)}</p>
          )}
        </div>
        {!isFormer && (
          <div className="text-right shrink-0">
            <p className={`text-sm font-semibold ${bLabel.className}`}>{bLabel.text}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Active Members ({activeMembers.length})</h3>
        {activeMembers.map((member: Member) => <MemberCard key={member.userId} member={member} />)}
      </div>

      {formerMembers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">Former Members ({formerMembers.length})</h3>
          {formerMembers.map((member: Member) => <MemberCard key={member.userId} member={member} isFormer />)}
        </div>
      )}

      {!confirmLeave ? (
        <button onClick={() => setConfirmLeave(true)} className="btn-danger w-full mt-4">Leave Group</button>
      ) : (
        <div className="rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 p-4 mt-4">
          <p className="text-sm font-medium text-danger-700 dark:text-danger-300 mb-3">Are you sure you want to leave this group?</p>
          <div className="flex gap-2">
            <button onClick={handleLeave} className="btn-danger flex-1">Confirm Leave</button>
            <button onClick={() => setConfirmLeave(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
