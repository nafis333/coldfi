import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { formatCurrency } from '@coldfi/shared';
import { useAuthStore } from '../../stores/authStore';

interface Member {
  userId: string; displayName: string; role: 'admin' | 'member';
  balance: number; joinedAt: string; leftAt?: string | null;
}

interface ExpenseData {
  id: string; amount: number; description: string; category: string;
  payerId: string; date: string; createdAt: string;
  splits: { userId: string; amount: number }[];
}

interface GroupCategory { id: string; name: string; icon: string; color: string; }

interface TabContext {
  groupId: string;
  group: {
    name: string; members: Member[]; defaultCurrency: string;
    expenses: ExpenseData[]; groupCategories: GroupCategory[];
    settlements: any[];
  };
  currentUserId: string;
}

function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 6);
}

export default function GroupAnalyticsTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;

  const activeMembers = useMemo(() => group.members.filter((m) => !m.leftAt), [group.members]);
  const activeMemberIds = useMemo(() => activeMembers.map((m) => m.userId), [activeMembers]);

  const expenses = group.expenses || [];
  const allTimeTotal = expenses.reduce((s, e) => s + e.amount, 0);

  const categorySpending = useMemo(() => {
    const map: Record<string, { name: string; icon: string; total: number; count: number }> = {};
    for (const e of expenses) {
      const cat = (group.groupCategories || []).find((c) => c.id === e.category);
      const key = e.category || 'other';
      if (!map[key]) map[key] = { name: cat?.name || key, icon: cat?.icon || '📝', total: 0, count: 0 };
      map[key].total += e.amount;
      map[key].count++;
    }
    const vals = Object.values(map);
    const grandTotal = vals.reduce((s, v) => s + v.total, 0);
    return vals.map((v) => ({ ...v, percentage: grandTotal > 0 ? Math.round((v.total / grandTotal) * 100) : 0 })).sort((a, b) => b.total - a.total);
  }, [expenses, group.groupCategories]);

  const memberPaid = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      if (!activeMemberIds.includes(e.payerId)) continue;
      map[e.payerId] = (map[e.payerId] || 0) + e.amount;
    }
    return activeMembers.map((m) => ({
      userId: m.userId,
      name: m.displayName,
      totalPaid: map[m.userId] || 0,
      percentage: allTimeTotal > 0 ? Math.round(((map[m.userId] || 0) / allTimeTotal) * 100) : 0,
    })).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [expenses, activeMembers, activeMemberIds, allTimeTotal]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const m = (e.date || e.createdAt).slice(0, 7);
      if (!map[m]) map[m] = { total: 0, count: 0 };
      map[m].total += e.amount;
      map[m].count++;
    }
    return Object.entries(map).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month));
  }, [expenses]);

  const avgPerMonth = monthlyTrend.length > 0
    ? Math.round(monthlyTrend.reduce((s, m) => s + m.total, 0) / monthlyTrend.length * 100) / 100
    : 0;

  const topExpenses = useMemo(() =>
    [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [expenses]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">All-Time Spent</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(allTimeTotal, defaultCurrency)}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{expenses.length} expenses</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Monthly Avg</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(avgPerMonth, defaultCurrency)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Categories</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{categorySpending.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-1">Active Members</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{activeMembers.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Spending by Category</h3>
          <div className="space-y-3">
            {categorySpending.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-neutral-700 dark:text-neutral-300">{c.icon} {c.name}</span>
                  <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(c.total, defaultCurrency)}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500 dark:bg-primary-400 transition-all" style={{ width: `${c.percentage}%` }} />
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">{c.count} expense{c.count !== 1 ? 's' : ''} · {c.percentage}%</p>
              </div>
            ))}
            {categorySpending.length === 0 && <p className="text-sm text-neutral-400">No expenses yet</p>}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Spending by Member</h3>
          <div className="space-y-3">
            {memberPaid.map((m) => (
              <div key={m.userId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {m.name}
                    {m.userId === currentUserId && <span className="text-xs text-neutral-400 ml-1">(you)</span>}
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(m.totalPaid, defaultCurrency)}</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                  <div className="h-full rounded-full bg-success-500 dark:bg-success-400 transition-all" style={{ width: `${m.percentage}%` }} />
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">{m.percentage}% of total</p>
              </div>
            ))}
            {memberPaid.length === 0 && <p className="text-sm text-neutral-400">No expenses yet</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Monthly Trend</h3>
        {monthlyTrend.length > 0 ? (
          <div className="space-y-2">
            {monthlyTrend.map((m) => {
              const maxTotal = Math.max(...monthlyTrend.map((x) => x.total));
              const barWidth = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0;
              return (
                <div key={m.month}>
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                    <span className="font-medium">{new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white">{formatCurrency(m.total, defaultCurrency)}</span>
                      <span className="ml-1.5 text-neutral-400">({m.count})</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 transition-all" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No expenses yet</p>
        )}
      </div>

      {topExpenses.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Top 5 Expenses</h3>
          <div className="space-y-2">
            {topExpenses.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-700/50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-neutral-100 text-neutral-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-neutral-50 text-neutral-400'
                  }`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{e.description}</p>
                    <p className="text-xs text-neutral-400">{memberName(group.members, e.payerId)} · {new Date(e.date || e.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-danger-600 dark:text-danger-400 shrink-0">{formatCurrency(e.amount, defaultCurrency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
