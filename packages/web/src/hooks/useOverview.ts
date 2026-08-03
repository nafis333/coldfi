import { useMemo } from 'react';
import { usePersonalStore } from '../stores/personalStore';
import { useAuthStore } from '../stores/authStore';
import type { BudgetStatusResult } from '@coldfi/shared';

export interface OverviewData {
  greeting: string;
  displayName: string | null;
  defaultCurrency: string;
  monthStart: string;
  monthEnd: string;
  thisMonthExpenses: any[];
  totalSpent: number;
  totalBudget: number;
  totalBudgetedSpent: number;
  budgetPercent: number;
  remaining: number;
  recentExpenses: any[];
  categoryMap: Record<string, { name: string; icon: string; color: string }>;
  topCategory: { id: string; total: number } | null;
  dailySpending: { date: string; total: number; label: string }[];
  maxDaily: number;
  budgetStatuses: BudgetStatusResult[];
  thisMonthIncome: any[];
  totalIncome: number;
  netSavings: number;
  savingsTargets: any[];
}

export function useOverview(): OverviewData {
  const { expenses, budgetStatuses, categories, budgets, incomeLogs, savingsTargets } = usePersonalStore();
  const displayName = useAuthStore((s) => s.displayName);
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const thisMonthExpenses = useMemo(
    () => expenses.filter((e: any) => e.date >= monthStart && e.date <= monthEnd),
    [expenses, monthStart, monthEnd]
  );

  // Money sums are only meaningful within one currency — totals/categories/charts
  // below use expenses in the user's default currency only (same rule as budgets).
  const defaultCurrencyExpenses = useMemo(
    () => thisMonthExpenses.filter((e: any) => e.currency === defaultCurrency),
    [thisMonthExpenses, defaultCurrency]
  );

  const totalSpent = useMemo(() => defaultCurrencyExpenses.reduce((s: number, e: any) => s + e.amount, 0), [defaultCurrencyExpenses]);
  const matchingBudgetStatuses = useMemo(() => {
    const budgetCurrencyMap = new Map(budgets.map((b: any) => [b.id, b.currency]));
    return budgetStatuses.filter((bs) => {
      const currency = budgetCurrencyMap.get(bs.budgetId);
      return !currency || currency === defaultCurrency;
    });
  }, [budgetStatuses, budgets, defaultCurrency]);

  const totalBudget = useMemo(() => matchingBudgetStatuses.reduce((s, b) => s + b.budgetAmount, 0), [matchingBudgetStatuses]);
  const totalBudgetedSpent = useMemo(() => matchingBudgetStatuses.reduce((s, b) => s + b.spent, 0), [matchingBudgetStatuses]);
  const budgetPercent = totalBudget > 0 ? (totalBudgetedSpent / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalBudgetedSpent;

  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [expenses]
  );

  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    for (const cat of categories) map[cat.id] = cat;
    return map;
  }, [categories]);

  const topCategory = useMemo(() => {
    if (defaultCurrencyExpenses.length === 0) return null;
    const catTotals: Record<string, number> = {};
    for (const e of defaultCurrencyExpenses) {
      catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + e.amount;
    }
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    return { id: sorted[0][0], total: sorted[0][1] };
  }, [defaultCurrencyExpenses]);

  const dailySpending = useMemo(() => {
    const n = new Date();
    const last7: { date: string; total: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(n);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const total = defaultCurrencyExpenses.filter((e: any) => e.date === dateStr).reduce((s: number, e: any) => s + e.amount, 0);
      last7.push({ date: dateStr, total, label: d.toLocaleDateString('en', { weekday: 'short' }) });
    }
    return last7;
  }, [defaultCurrencyExpenses]);

  const maxDaily = Math.max(...dailySpending.map((d) => d.total), 1);

  const thisMonthIncome = useMemo(
    () => incomeLogs.filter((i: any) => i.date >= monthStart && i.date <= monthEnd),
    [incomeLogs, monthStart, monthEnd]
  );

  const totalIncome = useMemo(
    () => thisMonthIncome.filter((i: any) => i.currency === defaultCurrency).reduce((s: number, i: any) => s + i.amount, 0),
    [thisMonthIncome, defaultCurrency]
  );

  const netSavings = totalIncome - totalSpent;

  return {
    greeting, displayName, defaultCurrency,
    monthStart, monthEnd,
    thisMonthExpenses, totalSpent,
    totalBudget, totalBudgetedSpent, budgetPercent, remaining,
    recentExpenses, categoryMap, topCategory,
    dailySpending, maxDaily,
    budgetStatuses,
    thisMonthIncome, totalIncome, netSavings,
    savingsTargets,
  };
}
