import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';
import { SettlementStatus, computeNetBalances } from '@coldfi/shared';
import GroupOverviewCards from './GroupOverviewCards';
import GroupSpendingCharts from './GroupSpendingCharts';
import GroupMonthlyTrend from './GroupMonthlyTrend';
import GroupRecentActivity from './GroupRecentActivity';
import TimeRangeFilter from './TimeRangeFilter';

interface Member {
  userId: string;
  displayName: string;
  balance: number;
}

interface SettlementData {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: SettlementStatus;
  note?: string;
  proposedAt: string;
  createdAt: string;
}

interface GroupExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  payerId: string;
  splits: { userId: string; amount: number }[];
  date: string;
  createdAt: string;
  displayId?: string;
}

interface GroupCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface TabContext {
  groupId: string;
  group: {
    members: Member[];
    defaultCurrency: string;
    expenses: GroupExpenseData[];
    settlements: SettlementData[];
    groupCategories: GroupCategory[];
    myBalance?: number;
    balances?: any[];
  };
  currentUserId: string;
}

function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 8);
}

export default function GroupOverviewTab() {
  const { groupId, group } = useOutletContext<TabContext>();
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const defaultCurrency = group.defaultCurrency || useAuthStore((s) => s.defaultCurrency);
  const [rangeDays, setRangeDays] = useState(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const filteredExpenses = useMemo(() => {
    if (!currentGroup) return [];
    const cutoff = rangeDays > 0 ? new Date(now - rangeDays * 86400000).toISOString() : null;
    const customStartMs = customStart ? new Date(customStart).getTime() : 0;
    const customEndMs = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Infinity;

    return (currentGroup.expenses || []).filter((e) => {
      const d = new Date(e.date || e.createdAt).getTime();
      if (cutoff && d < new Date(cutoff).getTime()) return false;
      if (customStart && d < customStartMs) return false;
      if (customEnd && d > customEndMs) return false;
      return true;
    });
  }, [currentGroup, rangeDays, customStart, customEnd, now]);

  const overview = useMemo(() => {
    if (!currentGroup) return null;
    const expenses = filteredExpenses;
    const settlements = currentGroup.settlements || [];
    const members = currentGroup.members || [];
    const categories = currentGroup.groupCategories || [];

    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
    const settledAmount = settlements
      .filter((s) => s.status === SettlementStatus.APPROVED)
      .reduce((s, st) => s + st.amount, 0);
    const outstandingDebt = Math.max(0, totalSpent - settledAmount);
    const memberIds = members.map((m) => m.userId);

    const engineExpenses = expenses.map((e) => ({
      id: e.id, groupId, amount: e.amount, currency: defaultCurrency, categoryId: e.category,
      description: e.description, date: e.date || e.createdAt, paidBy: e.payerId,
      paymentMethod: 'cash' as const, splitMode: 'ratio' as const,
      splits: (e.splits || []).map((s) => ({ memberId: s.userId, ratio: e.amount > 0 ? s.amount / e.amount : 0, isPaid: false, fixedAmount: s.amount })),
      status: 'unsettled' as const, isRecurring: false, createdAt: e.createdAt, updatedAt: e.createdAt, createdBy: e.payerId,
    }));
    const engineSettlements = settlements.map((s) => ({
      id: s.id, groupId, fromUserId: s.fromUserId, toUserId: s.toUserId, amount: s.amount,
      currency: defaultCurrency, status: s.status as any, proposedAt: s.proposedAt,
      relatedExpenseIds: [], createdAt: s.createdAt, updatedAt: s.createdAt,
    }));
    computeNetBalances(engineExpenses as any, engineSettlements as any, memberIds);

    const categorySpending: Record<string, { name: string; icon: string; total: number }> = {};
    for (const e of expenses) {
      const cat = categories.find((c) => c.id === e.category);
      const key = e.category || 'other';
      if (!categorySpending[key]) categorySpending[key] = { name: cat?.name || key, icon: cat?.icon || '📝', total: 0 };
      categorySpending[key].total += e.amount;
    }
    const categoryBreakdown = Object.values(categorySpending)
      .map((c) => ({ ...c, percentage: totalSpent > 0 ? Math.round((c.total / totalSpent) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    const memberExpenses: Record<string, number> = {};
    for (const e of expenses) memberExpenses[e.payerId] = (memberExpenses[e.payerId] || 0) + e.amount;
    const memberSpending = members.map((m) => ({
      userId: m.userId, displayName: m.displayName || m.userId.slice(0, 8),
      totalPaid: memberExpenses[m.userId] || 0,
      percentage: totalSpent > 0 ? Math.round(((memberExpenses[m.userId] || 0) / totalSpent) * 100) : 0,
    })).sort((a, b) => b.totalPaid - a.totalPaid);

    const monthlyMap: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const month = (e.date || e.createdAt).slice(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { total: 0, count: 0 };
      monthlyMap[month].total += e.amount;
      monthlyMap[month].count++;
    }
    const monthlyTrend = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month));

    const recentActivity = expenses.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10).map((e) => ({
      type: 'expense' as const, id: e.id, actorName: memberName(members, e.payerId),
      description: e.description || 'added expense', date: e.createdAt, amount: e.amount,
    }));

    return { totalSpent, expenseCount: expenses.length, totalSettled: settledAmount, outstandingDebt, memberCount: members.length, categoryBreakdown, memberSpending, monthlyTrend, recentActivity };
  }, [currentGroup, groupId, defaultCurrency, filteredExpenses]);

  if (!overview) {
    return <div className="flex justify-center py-12"><p className="text-sm text-neutral-500">Loading overview...</p></div>;
  }

  return (
    <div className="space-y-6">
      <TimeRangeFilter
        rangeDays={rangeDays} showCustom={showCustom}
        onPreset={(d) => { setRangeDays(d); setShowCustom(false); setCustomStart(''); setCustomEnd(''); }}
        onCustomStart={(v) => { setCustomStart(v); setRangeDays(0); }}
        onCustomEnd={(v) => { setCustomEnd(v); setRangeDays(0); }}
        onToggleCustom={() => setShowCustom(!showCustom)}
        compact
      />

      <GroupOverviewCards
        totalSpent={overview.totalSpent} expenseCount={overview.expenseCount}
        totalSettled={overview.totalSettled} outstandingDebt={overview.outstandingDebt}
        memberCount={overview.memberCount} defaultCurrency={defaultCurrency}
      />

      <GroupSpendingCharts
        categoryBreakdown={overview.categoryBreakdown}
        memberSpending={overview.memberSpending}
        defaultCurrency={defaultCurrency}
      />

      <GroupMonthlyTrend monthlyTrend={overview.monthlyTrend} defaultCurrency={defaultCurrency} />
      <GroupRecentActivity recentActivity={overview.recentActivity} defaultCurrency={defaultCurrency} />

      {overview.totalSpent === 0 && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-8 text-center">
          <p className="text-neutral-500 dark:text-neutral-400">No activity yet in this group.</p>
          <Link to={`/groups/${groupId}/expenses/new`} className="btn-primary mt-4 inline-block">Add the first expense</Link>
        </div>
      )}
    </div>
  );
}
