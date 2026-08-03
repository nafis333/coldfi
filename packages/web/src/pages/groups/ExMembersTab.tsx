import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { computeNetBalances, formatCurrency, SettlementStatus } from '@coldfi/shared';
import { useAuthStore } from '../../stores/authStore';

interface Member {
  userId: string; displayName: string; role: 'admin' | 'member';
  balance: number; joinedAt: string; leftAt?: string | null;
}

interface ExpenseData {
  id: string; amount: number; description: string; categoryId: string;
  paidBy: string; date: string; createdAt: string;
  splits: { userId: string; amount: number }[];
  category?: string; payerId?: string;
}

interface TabContext {
  groupId: string;
  group: {
    name: string; members: Member[]; defaultCurrency: string;
    expenses: ExpenseData[]; settlements: any[]; groupCategories: any[];
    balances?: any[];
  };
  currentUserId: string;
}

export default function ExMembersTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;

  const activeMemberIds = useMemo(() =>
    group.members.filter((m) => !m.leftAt).map((m) => m.userId),
    [group.members]
  );
  const exMembers = useMemo(() => group.members.filter((m) => m.leftAt), [group.members]);

  const allBalances = useMemo(() => {
    const allMemberIds = group.members.map((m) => m.userId);
    const engineExpenses = (group.expenses || []).map((e) => ({
      id: e.id, groupId, amount: e.amount, currency: defaultCurrency, categoryId: e.categoryId || e.category || '',
      description: e.description, date: e.date || e.createdAt, paidBy: e.paidBy || e.payerId || '',
      paymentMethod: 'cash' as const, splitMode: 'ratio' as const,
      splits: (e.splits || []).map((s) => ({
        memberId: s.userId, ratio: e.amount > 0 ? s.amount / e.amount : 0, isPaid: false, fixedAmount: s.amount,
      })),
      status: 'unsettled' as const, isRecurring: false, createdAt: e.createdAt, updatedAt: e.createdAt, createdBy: e.paidBy || e.payerId || '',
    }));
    const engineSettlements = (group.settlements || []).map((s: any) => ({
      id: s.id, groupId, fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount,
      currency: defaultCurrency, status: s.status, proposedAt: s.proposedAt,
      relatedExpenseIds: [], createdAt: s.createdAt, updatedAt: s.createdAt,
    }));
    return computeNetBalances(engineExpenses as any, engineSettlements as any, allMemberIds);
  }, [group.expenses, group.settlements, group.members, groupId, defaultCurrency]);

  function exMemberName(m: Member) {
    return m.displayName || m.userId.slice(0, 6);
  }

  function memberName(userId: string) {
    return group.members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 6);
  }

  function exMemberDebts(exUser: Member) {
    const bal = allBalances.find((b) => b.userId === exUser.userId);
    if (!bal) return null;
    const owesToActive: { name: string; amt: number }[] = [];
    const owedByActive: { name: string; amt: number }[] = [];
    const owesToEx: { name: string; amt: number }[] = [];
    const owedByEx: { name: string; amt: number }[] = [];

    for (const [otherId, amt] of Object.entries(bal.owesTo)) {
      const isActive = activeMemberIds.includes(otherId);
      const name = memberName(otherId);
      (isActive ? owesToActive : owesToEx).push({ name, amt });
    }
    for (const [otherId, amt] of Object.entries(bal.owedBy)) {
      const isActive = activeMemberIds.includes(otherId);
      const name = memberName(otherId);
      (isActive ? owedByActive : owedByEx).push({ name, amt });
    }
    return { owesToActive, owedByActive, owesToEx, owedByEx, net: bal.net };
  }

  function activeMemberExposure(activeUser: Member) {
    const bal = allBalances.find((b) => b.userId === activeUser.userId);
    if (!bal) return null;
    const owedByEx: { name: string; amt: number }[] = [];
    const owesToEx: { name: string; amt: number }[] = [];
    for (const [otherId, amt] of Object.entries(bal.owedBy)) {
      if (!activeMemberIds.includes(otherId)) {
        owedByEx.push({ name: memberName(otherId), amt });
      }
    }
    for (const [otherId, amt] of Object.entries(bal.owesTo)) {
      if (!activeMemberIds.includes(otherId)) {
        owesToEx.push({ name: memberName(otherId), amt });
      }
    }
    return { owedByEx, owesToEx };
  }

  if (exMembers.length === 0) {
    return (
      <div className="card p-10 text-center">
        <svg className="mx-auto h-10 w-10 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="mt-3 text-sm font-medium text-neutral-500">No former members</p>
        <p className="mt-1 text-xs text-neutral-400">Former members and their outstanding balances will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">
          Former Members ({exMembers.length})
        </h2>
        <div className="space-y-4">
          {exMembers.map((ex) => {
            const debts = exMemberDebts(ex);
            return (
              <div key={ex.userId} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-sm font-bold text-neutral-500">
                    {ex.displayName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{exMemberName(ex)}</p>
                    <p className="text-xs text-neutral-400">Left {ex.leftAt ? new Date(ex.leftAt).toLocaleDateString() : 'unknown'}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className={`text-sm font-bold ${(debts?.net || 0) >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                      {(debts?.net || 0) >= 0 ? '+' : ''}{formatCurrency(Math.abs(debts?.net || 0), defaultCurrency)}
                    </p>
                    <p className="text-xs text-neutral-400">net</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {debts?.owesToActive.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-danger-600 dark:text-danger-400">
                      <span>Owes <span className="font-medium">{d.name}</span></span>
                      <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span>
                    </div>
                  ))}
                  {debts?.owedByActive.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-success-600 dark:text-success-400">
                      <span>Owed by <span className="font-medium">{d.name}</span></span>
                      <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span>
                    </div>
                  ))}
                  {debts?.owesToEx.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-neutral-400 italic">
                      <span>Owes <span className="font-medium">{d.name}</span> <span className="text-xs">(former)</span></span>
                      <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span>
                    </div>
                  ))}
                  {debts?.owedByEx.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-neutral-400 italic">
                      <span>Owed by <span className="font-medium">{d.name}</span> <span className="text-xs">(former)</span></span>
                      <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span>
                    </div>
                  ))}
                  {!debts?.owesToActive.length && !debts?.owedByActive.length && !debts?.owesToEx.length && !debts?.owedByEx.length && (
                    <p className="text-xs text-neutral-400 italic">No outstanding balances</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {activeMemberIds.length > 0 && exMembers.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">
            Active Members — Ex-Member Exposure
          </h2>
          <p className="text-xs text-neutral-400 mb-4">
            What each active member is owed or owes to former members. These balances are excluded from group overview/settlement stats.
          </p>
          <div className="space-y-3">
            {group.members.filter((m) => !m.leftAt).map((m) => {
              const exp = activeMemberExposure(m);
              return (
                <div key={m.userId} className="flex items-center justify-between rounded-lg border border-neutral-100 dark:border-neutral-700/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {m.displayName}
                      {m.userId === currentUserId && <span className="ml-1.5 text-xs text-neutral-400">(you)</span>}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {exp?.owedByEx.map((d, i) => (
                      <p key={i} className="text-success-600 dark:text-success-400">
                        Owed <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span> by {d.name}
                      </p>
                    ))}
                    {exp?.owesToEx.map((d, i) => (
                      <p key={i} className="text-danger-500 dark:text-danger-400">
                        Owes <span className="font-semibold">{formatCurrency(d.amt, defaultCurrency)}</span> to {d.name}
                      </p>
                    ))}
                    {!exp?.owedByEx.length && !exp?.owesToEx.length && (
                      <p className="text-xs text-neutral-400">No ex-member exposure</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
