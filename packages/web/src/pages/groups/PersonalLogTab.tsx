import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { buildPersonalLog, SplitMode, ExpenseStatus, PaymentMethod, formatCurrency, parseLocalDate } from '@coldfi/shared';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';

interface SettleData {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  note?: string;
  status: string;
  proposedAt: string;
  markedPaidAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  relatedExpenseIds: string[];
  supersededBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface Member {
  userId: string;
  displayName: string;
}

interface TabContext {
  groupId: string;
  group: {
    members: Member[];
    defaultCurrency: string;
    settlements: SettleData[];
    expenses: {
      id: string;
      amount: number;
      description: string;
      category: string;
      payerId: string;
      splits: { userId: string; amount: number }[];
      itemized?: { name: string; amount: number }[];
      createdAt: string;
    }[];
  };
  currentUserId: string;
}

export default function PersonalLogTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const store = useGroupStore.getState();
  const currentGroup = store.currentGroup;
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;

  const log = useMemo(() => {
    if (!currentGroup || !currentGroup.balances) return null;

    const memberIds = currentGroup.members.map((m: Member) => m.userId);
    const displayNames: Record<string, string> = {};
    for (const m of currentGroup.members) {
      displayNames[m.userId] = m.displayName;
    }

    const engineExpenses = currentGroup.expenses.map((e) => ({
      id: e.id,
      groupId,
      amount: e.amount,
      currency: defaultCurrency,
      categoryId: e.categoryId || e.category || '',
      description: e.description,
      date: e.createdAt,
      paidBy: e.paidBy || e.payerId || '',
      paymentMethod: PaymentMethod.CASH,
      splitMode: SplitMode.FIXED,
      splits: e.splits.map((s) => ({
        memberId: s.userId,
        ratio: e.amount > 0 ? s.amount / e.amount : 0,
        fixedAmount: s.amount,
        isPaid: false,
      })),
      itemizedItems: e.itemized?.map((i) => ({
        id: `item_${i.name}`,
        name: i.name,
        amount: i.amount,
        assignedTo: e.splits.map((sp) => sp.userId),
      })),
      status: ExpenseStatus.UNSETTLED,
      isRecurring: false,
      createdAt: e.createdAt,
      updatedAt: e.createdAt,
      createdBy: e.paidBy || e.payerId || '',
    }));

    const engineSettlements = currentGroup.settlements.map((s) => ({
      id: s.id,
      groupId: s.groupId,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount,
      currency: s.currency,
      status: s.status,
      proposedAt: s.proposedAt,
      markedPaidAt: s.markedPaidAt,
      approvedAt: s.approvedAt,
      rejectedAt: s.rejectedAt,
      cancelledAt: s.cancelledAt,
      note: s.note,
      relatedExpenseIds: s.relatedExpenseIds,
      supersededBy: s.supersededBy,
      paidAmount: s.paidAmount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return buildPersonalLog(currentUserId, engineExpenses, engineSettlements, memberIds, displayNames);
  }, [currentGroup, currentUserId, groupId]);

  if (!log) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-sm text-neutral-500">Loading statement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Your Statement</h2>
        <span className={`text-sm font-semibold ${log.finalBalance.net >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
          Net: {formatCurrency(log.finalBalance.net, defaultCurrency)}
        </span>
      </div>

      {log.entries.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-800/50">
          <p className="text-neutral-500 dark:text-neutral-400">No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {log.entries.map((entry) => (
            <div key={entry.id} className="card p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">{entry.description}</p>
                  <p className="text-xs text-neutral-400">{parseLocalDate(entry.date).toLocaleDateString()}</p>
                  {entry.counterparty && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{entry.counterparty}</p>
                  )}
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className={`text-sm font-semibold ${entry.share >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-500 dark:text-danger-400'}`}>
                    {entry.share >= 0 ? '+' : ''}{formatCurrency(entry.share, defaultCurrency)}
                  </p>
                  <p className="text-xs text-neutral-400">
                    Bal: {formatCurrency(entry.runningBalance, defaultCurrency)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
