import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';

interface Member {
  userId: string;
  displayName: string;
  role: 'admin' | 'member';
  balance: number;
  joinedAt: string;
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
  const { leaveGroup } = useGroupStore();
  const navigate = useNavigate();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const balances = group.balances ?? [];
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;

  function memberBalance(userId: string) {
    return balances.find((b) => b.userId === userId);
  }

  function balanceLabel(userId: string): { text: string; className: string } {
    const bal = memberBalance(userId);
    if (!bal) return { text: formatCurrency(0, defaultCurrency), className: 'text-neutral-500' };
    if (bal.net > 0) return { text: `+${formatCurrency(bal.net, defaultCurrency)}`, className: 'text-success-600 dark:text-success-400' };
    if (bal.net < 0) return { text: `-${formatCurrency(Math.abs(bal.net), defaultCurrency)}`, className: 'text-danger-500 dark:text-danger-400' };
    return { text: formatCurrency(0, defaultCurrency), className: 'text-neutral-500' };
  }

  function breakdownText(userId: string): string {
    const bal = memberBalance(userId);
    if (!bal) return '';
    const owes = Object.entries(bal.owesTo);
    const owed = Object.entries(bal.owedBy);
    const parts: string[] = [];
    if (owes.length > 0) {
      for (const [other, amt] of owes) {
        const name = group.members.find((m) => m.userId === other)?.displayName || other.slice(0, 6);
        parts.push(`owes ${name} ${formatCurrency(amt, defaultCurrency)}`);
      }
    }
    if (owed.length > 0) {
      for (const [other, amt] of owed) {
        const name = group.members.find((m) => m.userId === other)?.displayName || other.slice(0, 6);
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
      console.error('Failed to leave group:', e);
    }
  }

  return (
    <div className="space-y-3">
      {group.members?.map((member: Member) => {
        const bLabel = balanceLabel(member.userId);
        return (
          <div key={member.userId} className="card flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50 text-sm font-bold text-primary-600 dark:text-primary-300">
              {member.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {member.displayName}
                {member.userId === currentUserId && (
                  <span className="ml-2 text-xs text-neutral-400">(you)</span>
                )}
              </p>
              {member.role === 'admin' && (
                <span className="inline-block rounded bg-primary-100 dark:bg-primary-900/30 px-2 py-0.5 text-xs font-medium text-primary-700 dark:text-primary-300">
                  Admin
                </span>
              )}
              {breakdownText(member.userId) && (
                <p className="mt-1 text-xs text-neutral-400 truncate">{breakdownText(member.userId)}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${bLabel.className}`}>
                {bLabel.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

