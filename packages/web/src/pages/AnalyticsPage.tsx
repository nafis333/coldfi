import { useEffect, useMemo, useRef, useState } from 'react';
import { usePersonalStore } from '../stores/personalStore';
import { useGroupStore } from '../stores/groupStore';
import { useGroupExpenseStore } from '../stores/groupExpenseStore';
import { useAuthStore } from '../stores/authStore';
import { useAnalyticsStore } from '../stores/analyticsStore';
import {
  computeSpendingByCategory,
  computeTopExpenses,
  computeSavings,
  detectUnusualSpending,
  type PersonalExpense,
  type PersonalCategory,
} from '@coldfi/shared';
import type { ExpenseItem } from '../lib/personalSync';
import SpendingTrendIndicator from './analytics/SpendingTrendIndicator';
import SavingsOverview from './analytics/SavingsOverview';
import DailySpendingChart from './analytics/DailySpendingChart';
import SpendingByCategoryChart from './analytics/SpendingByCategoryChart';
import TopExpensesList from './analytics/TopExpensesList';
import AnalyticsSkeleton from './analytics/AnalyticsSkeleton';
import FilterBar, { type Source, type Period } from './analytics/FilterBar';
import StatCards from './analytics/StatCards';
import MonthlyRecapSection from './analytics/MonthlyRecapSection';
import SpendingAlertsSection from './analytics/SpendingAlertsSection';
import BudgetComparisonSection from './analytics/BudgetComparisonSection';
import EmptyAnalyticsState from './analytics/EmptyAnalyticsState';
import GroupDataWarning from './analytics/GroupDataWarning';

interface StoreExpense {
  id: string; amount: number; currency: string; categoryId: string;
  date: string; payee: string | null; note: string | null;
  paymentMethod: string | null; receiptUri: string | null;
  isRecurring: boolean; items?: ExpenseItem[];
  createdAt: string; updatedAt: string;
}
interface StoreCategory { id: string; name: string; icon: string; color: string; }

function toEngineExpenses(storeExpenses: StoreExpense[]): PersonalExpense[] {
  return storeExpenses.map((e) => ({
    id: e.id, amount: e.amount, currency: e.currency, categoryId: e.categoryId,
    description: e.items?.length ? e.items.map((i) => i.name).join(', ') : (e.note || e.payee || 'Expense'),
    date: e.date,
    paymentMethod: e.paymentMethod ?? '', isRecurring: e.isRecurring,
    tags: [], createdAt: e.createdAt, updatedAt: e.updatedAt,
  }));
}

function toEngineCategories(storeCats: StoreCategory[]): PersonalCategory[] {
  return storeCats.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, isDefault: false, sortOrder: 0, createdAt: '' }));
}

const CHART_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#A855F7', '#D946EF',
];

function toStartOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function AnalyticsPage() {
  const { expenses, categories, budgetStatuses, incomeLogs, fetchPersonalBlob, isLoading } = usePersonalStore();
  const { groups, fetchGroups } = useGroupStore();
  const { groupExpensesCache, fetchAllGroupExpenses } = useGroupExpenseStore();
  const { recaps, fetchRecap } = useAnalyticsStore();
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency);
  const [period, setPeriod] = useState<Period>('1m');
  const [source, setSource] = useState<Source>('personal');
  const [groupsFetched, setGroupsFetched] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const lastNonGroupSource = useRef<Source>('personal');

  useEffect(() => { fetchPersonalBlob(); }, [fetchPersonalBlob]);

  useEffect(() => {
    if (!groupsFetched) {
      setGroupsFetched(true);
      fetchGroups();
    }
  }, [groupsFetched, fetchGroups]);

  useEffect(() => {
    if ((source === 'groups' || source === 'all') && !groupsLoaded) {
      setGroupsLoaded(true);
      fetchAllGroupExpenses();
    }
  }, [source, groupsLoaded, fetchAllGroupExpenses]);

  useEffect(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fetchRecap(ym);
  }, [fetchRecap]);

  const categoryLookup = useMemo(() => {
    const m: Record<string, { name: string; icon: string; color: string }> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const categoryNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  const periodRange = useMemo(() => {
    const now = toStartOfDay(new Date());
    let start: Date;
    switch (period) {
      case '7d': start = new Date(now); start.setDate(start.getDate() - 7); break;
      case '3m': start = new Date(now); start.setMonth(start.getMonth() - 3); break;
      case '6m': start = new Date(now); start.setMonth(start.getMonth() - 6); break;
      case '1y': start = new Date(now); start.setFullYear(start.getFullYear() - 1); break;
      default: start = new Date(now); start.setMonth(start.getMonth() - 1); break;
    }
    return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }, [period]);

  const prevRange = useMemo(() => {
    const now = toStartOfDay(new Date());
    const durationMs = new Date(periodRange.end).getTime() - new Date(periodRange.start).getTime();
    const prevEnd = new Date(new Date(periodRange.start).getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
  }, [periodRange]);

  const groupExpensesFlat: StoreExpense[] = useMemo(() => {
    const result: StoreExpense[] = [];
    for (const gid of Object.keys(groupExpensesCache)) {
      const g = groupExpensesCache[gid]!;
      for (const e of g.expenses) {
        result.push({
          id: `group_${gid}_${e.id}`, amount: e.amount, currency: g.currency || defaultCurrency,
          categoryId: e.category, date: e.date, payee: e.description,
          note: `[${g.name}] ${e.description}`, paymentMethod: null, receiptUri: null,
          isRecurring: false, createdAt: e.createdAt, updatedAt: e.createdAt,
        });
      }
    }
    return result;
  }, [groupExpensesCache, defaultCurrency]);

  const allExpenses = useMemo(() => {
    if (source === 'personal') return expenses;
    if (source === 'groups') return groupExpensesFlat;
    return [...expenses, ...groupExpensesFlat];
  }, [source, expenses, groupExpensesFlat]);

  const filtered = useMemo(
    () => allExpenses.filter((e) => e.date >= periodRange.start && e.date <= periodRange.end),
    [allExpenses, periodRange]
  );

  const engineCategories = useMemo(() => toEngineCategories(categories), [categories]);
  const engineExpenses = useMemo(() => toEngineExpenses(filtered), [filtered]);
  const engineAllExpenses = useMemo(() => toEngineExpenses(allExpenses), [allExpenses]);

  const previousPeriod = useMemo(
    () => allExpenses.filter((e) => e.date >= prevRange.start && e.date <= prevRange.end),
    [allExpenses, prevRange]
  );

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const prevTotalSpent = useMemo(() => previousPeriod.reduce((s, e) => s + e.amount, 0), [previousPeriod]);

  const trendPercent = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : 0;
  const isTrendUp = totalSpent > prevTotalSpent;

  const txCount = filtered.length;
  const prevTxCount = previousPeriod.length;

  const dailyAvg = useMemo(() => {
    const days = Math.max(1, Math.ceil((new Date(periodRange.end).getTime() - new Date(periodRange.start).getTime()) / 86400000));
    return totalSpent / days;
  }, [totalSpent, periodRange]);

  const biggestDay = useMemo(() => {
    if (filtered.length === 0) return null;
    const byDate: Record<string, number> = {};
    for (const e of filtered) byDate[e.date] = (byDate[e.date] || 0) + e.amount;
    const [date, amount] = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
    return { date, amount };
  }, [filtered]);

  const categorySpending = useMemo(() => {
    if (filtered.length === 0) return [];
    return computeSpendingByCategory(engineExpenses, engineCategories, periodRange.start, periodRange.end);
  }, [filtered, categories, periodRange]);

  const pieData = useMemo(() => {
    const sorted = categorySpending.map((cs) => ({
      name: cs.categoryIcon ? `${cs.categoryIcon} ${cs.categoryName}` : cs.categoryName,
      value: cs.totalAmount, fill: cs.categoryColor || CHART_COLORS[0], categoryId: cs.categoryId,
    }));
    const OTHER_THRESHOLD = 0.03;
    const total = sorted.reduce((s, i) => s + i.value, 0);
    const main = sorted.filter((i) => i.value / total >= OTHER_THRESHOLD);
    const others = sorted.filter((i) => i.value / total < OTHER_THRESHOLD);
    if (others.length > 0) {
      main.push({ name: '\uD83D\uDCE6 Other', value: others.reduce((s, i) => s + i.value, 0), fill: '#CBD5E1', categoryId: '__other' });
    }
    return main;
  }, [categorySpending]);

  const barData = useMemo(() => {
    const now = new Date();
    const isMonthly = period === '1y' || period === '6m' || period === '3m';
    if (isMonthly) {
      const monthsToShow = period === '1y' ? 12 : period === '6m' ? 6 : 3;
      const monthly: { label: string; amount: number }[] = [];
      for (let i = monthsToShow - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStart = d.toISOString().split('T')[0];
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        const total = filtered.filter((e) => e.date >= mStart && e.date <= mEnd).reduce((s, e) => s + e.amount, 0);
        monthly.push({ label: d.toLocaleDateString('en', { month: 'short' }), amount: total });
      }
      return monthly;
    }
    const days = period === '7d' ? 7 : 30;
    const points: { label: string; amount: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const total = filtered.filter((e) => e.date === ds).reduce((s, e) => s + e.amount, 0);
      points.push({
        label: period === '7d' ? d.toLocaleDateString('en', { weekday: 'short' }) : String(d.getDate()),
        amount: total,
      });
    }
    return points;
  }, [filtered, period]);

  const maxBarValue = Math.max(...barData.map((d) => d.amount), 1);

  const topExpenses = useMemo(() => {
    if (filtered.length === 0) return [];
    return computeTopExpenses(engineExpenses, engineCategories, 5, periodRange.start, periodRange.end);
  }, [filtered, categories, periodRange]);

  const topCategory = useMemo(() => pieData[0] || null, [pieData]);

  const budgetComparison = useMemo(() => {
    return budgetStatuses.map((b) => ({
      name: categoryLookup[b.categoryId]?.icon
        ? `${categoryLookup[b.categoryId].icon} ${categoryLookup[b.categoryId].name}` : b.categoryId,
      budget: b.budgetAmount, spent: b.spent,
    }));
  }, [budgetStatuses, categoryLookup]);

  const spendingAlerts = useMemo(() => {
    if (allExpenses.length === 0) return [];
    return detectUnusualSpending(engineAllExpenses, categoryNames, {
      lookbackPeriods: 3, periodDays: 30, lowThreshold: 1.2, mediumThreshold: 1.5, highThreshold: 2.0,
    });
  }, [allExpenses, categoryNames]);

  const monthDays = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }, []);

  const dailyAvgThisMonth = useMemo(() => {
    const d = new Date();
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
    const monthExps = allExpenses.filter((e) => e.date >= monthStart && e.date <= monthEnd);
    const total = monthExps.reduce((s, e) => s + e.amount, 0);
    return total / Math.max(1, d.getDate());
  }, [allExpenses]);

  const projectedThisMonth = dailyAvgThisMonth * monthDays;

  const savingsData = useMemo(() => {
    if (source === 'groups') return null;
    const savingsExpenses = source === 'all' ? expenses : filtered;
    return computeSavings(
      incomeLogs.map((i) => ({
        id: i.id, source: i.source, amount: i.amount,
        currency: i.currency || defaultCurrency, date: i.date,
        isRecurring: false, notes: i.note, createdAt: i.createdAt, updatedAt: i.updatedAt,
      })),
      toEngineExpenses(savingsExpenses),
      periodRange.start, periodRange.end
    );
  }, [incomeLogs, expenses, filtered, source, periodRange, defaultCurrency]);

  const currentRecap = useMemo(() => {
    const d = new Date();
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return recaps.find((r) => r.month === ym) || null;
  }, [recaps]);

  function handleSourceChange(newSource: Source) {
    setSource(newSource);
    if ((newSource === 'groups' || newSource === 'all') && lastNonGroupSource.current !== newSource) {
      setGroupsLoaded(false);
    }
    lastNonGroupSource.current = newSource;
  }

  if (isLoading && expenses.length === 0) return <AnalyticsSkeleton />;

  const isEmpty = filtered.length === 0 && source !== 'groups';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Analytics</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {new Date(periodRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} &ndash; {new Date(periodRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <FilterBar source={source} period={period} onSourceChange={handleSourceChange} onPeriodChange={setPeriod} />
      </div>

      {source !== 'personal' && groupExpensesFlat.length === 0 && (
        <GroupDataWarning groupsLength={groups.length} />
      )}

      <StatCards
        totalSpent={totalSpent} prevTotalSpent={prevTotalSpent}
        dailyAvg={dailyAvg} txCount={txCount} prevTxCount={prevTxCount}
        biggestDay={biggestDay} isEmpty={isEmpty}
        trendPercent={trendPercent} isTrendUp={isTrendUp}
        defaultCurrency={defaultCurrency}
      />

      {savingsData && (
        <SavingsOverview savingsData={savingsData} defaultCurrency={defaultCurrency} />
      )}

      <MonthlyRecapSection currentRecap={currentRecap} defaultCurrency={defaultCurrency} />

      <SpendingAlertsSection spendingAlerts={spendingAlerts} defaultCurrency={defaultCurrency} source={source} />

      <SpendingTrendIndicator
        totalSpent={totalSpent} prevTotalSpent={prevTotalSpent} trendPercent={trendPercent}
        period={period} dailyAvg={dailyAvg} topCategory={topCategory}
        txCount={txCount} projectedThisMonth={projectedThisMonth} defaultCurrency={defaultCurrency}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DailySpendingChart
          barData={barData} maxBarValue={maxBarValue}
          isEmpty={filtered.length === 0} period={period} defaultCurrency={defaultCurrency}
        />
        <SpendingByCategoryChart
          pieData={pieData} totalSpent={totalSpent}
          isEmpty={filtered.length === 0} defaultCurrency={defaultCurrency}
        />
      </div>

      <BudgetComparisonSection
        budgetComparison={budgetComparison} isEmpty={filtered.length === 0}
        defaultCurrency={defaultCurrency} source={source}
      />

      <TopExpensesList topExpenses={topExpenses} categoryLookup={categoryLookup} defaultCurrency={defaultCurrency} />

      {isEmpty && <EmptyAnalyticsState />}
    </div>
  );
}
