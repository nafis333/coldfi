import type {
  PersonalExpense,
  PersonalCategory,
  IncomeLog,
  SavingsTarget,
} from '../types/personal';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalAmount: number;
  transactionCount: number;
  percentOfTotal: number;
  averageTransaction: number;
}

export interface DailySpending {
  date: string;
  totalAmount: number;
  transactionCount: number;
  categories: { categoryId: string; amount: number }[];
}

export interface SavingsResult {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number | null;
  bySource: { source: string; amount: number }[];
}

export interface SpendingTrend {
  month: string;
  totalSpent: number;
  changeFromPrevious: number | null;
  changePercent: number | null;
}

export interface TopExpense {
  id: string;
  amount: number;
  description: string;
  categoryId: string;
  categoryName: string;
  date: string;
}

export function computeSpendingByCategory(
  expenses: PersonalExpense[],
  categories: PersonalCategory[],
  startDate?: string,
  endDate?: string
): CategorySpending[] {
  const filtered = filterByDateRange(expenses, startDate, endDate);
  // Note: expenses may be in different currencies — aggregation is multi-currency sum
  const totalAmount = filtered.reduce((sum, e) => sum + e.amount, 0);

  const categoryMap = new Map<string, {
    total: number;
    count: number;
  }>();

  for (const expense of filtered) {
    const existing = categoryMap.get(expense.categoryId) || { total: 0, count: 0 };
    existing.total += expense.amount;
    existing.count += 1;
    categoryMap.set(expense.categoryId, existing);
  }

  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  const results: CategorySpending[] = [];

  for (const [categoryId, data] of categoryMap) {
    const cat = categoryLookup.get(categoryId);
    results.push({
      categoryId,
      categoryName: cat?.name || 'Unknown',
      categoryIcon: cat?.icon || '?',
      categoryColor: cat?.color || '#888888',
      totalAmount: roundCents(data.total),
      transactionCount: data.count,
      percentOfTotal: totalAmount > 0 ? roundCents((data.total / totalAmount) * 100) : 0,
      averageTransaction: data.count > 0 ? roundCents(data.total / data.count) : 0,
    });
  }

  return results.sort((a, b) => b.totalAmount - a.totalAmount);
}

export function computeDailySpending(
  expenses: PersonalExpense[],
  startDate: string,
  endDate: string
): DailySpending[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayMap = new Map<string, DailySpending>();

  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]!;
    dayMap.set(dateStr, {
      date: dateStr,
      totalAmount: 0,
      transactionCount: 0,
      categories: [],
    });
    current.setDate(current.getDate() + 1);
  }

  const categoryTotals = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    const expenseDate = new Date(expense.date);
    if (expenseDate < start || expenseDate > end) continue;

    const dateStr = expense.date.split('T')[0]!;
    const day = dayMap.get(dateStr);
    if (!day) continue;

    day.totalAmount += expense.amount;
    day.transactionCount += 1;

    if (!categoryTotals.has(dateStr)) {
      categoryTotals.set(dateStr, new Map());
    }
    const dayCats = categoryTotals.get(dateStr)!;
    dayCats.set(
      expense.categoryId,
      (dayCats.get(expense.categoryId) || 0) + expense.amount
    );
  }

  for (const [dateStr, day] of dayMap) {
    const cats = categoryTotals.get(dateStr);
    if (cats) {
      day.categories = Array.from(cats.entries()).map(([categoryId, amount]) => ({
        categoryId,
        amount: roundCents(amount),
      }));
      day.totalAmount = roundCents(day.totalAmount);
    }
  }

  return Array.from(dayMap.values());
}

export function computeSavings(
  incomeLogs: IncomeLog[],
  expenses: PersonalExpense[],
  startDate?: string,
  endDate?: string
): SavingsResult {
  const filteredExpenses = filterByDateRange(expenses, startDate, endDate);
  const filteredIncome = filterIncomeByDateRange(incomeLogs, startDate, endDate);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalIncome = filteredIncome.reduce((sum, i) => sum + i.amount, 0);
  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0.005
    ? roundCents((netSavings / totalIncome) * 100)
    : null;

  const sourceMap = new Map<string, number>();
  for (const income of filteredIncome) {
    sourceMap.set(income.source, (sourceMap.get(income.source) || 0) + income.amount);
  }

  return {
    totalIncome: roundCents(totalIncome),
    totalExpenses: roundCents(totalExpenses),
    netSavings: roundCents(netSavings),
    savingsRate,
    bySource: Array.from(sourceMap.entries()).map(([source, amount]) => ({
      source,
      amount: roundCents(amount),
    })),
  };
}

export function computeSpendingTrend(
  expenses: PersonalExpense[],
  months: number = 6
): SpendingTrend[] {
  const now = new Date();
  const trends: SpendingTrend[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthStr = monthStart.toISOString().slice(0, 7);

    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date);
      return d >= monthStart && d <= monthEnd;
    });

    const totalSpent = roundCents(
      monthExpenses.reduce((sum, e) => sum + e.amount, 0)
    );

    const previousTotal = trends.length > 0
      ? trends[trends.length - 1]!.totalSpent
      : null;

    const changeFromPrevious = previousTotal !== null ? roundCents(totalSpent - previousTotal) : null;
    const changePercent = previousTotal !== null && previousTotal > 0
      ? roundCents((changeFromPrevious! / previousTotal) * 100)
      : null;

    trends.push({
      month: monthStr,
      totalSpent,
      changeFromPrevious,
      changePercent,
    });
  }

  return trends;
}

export function computeTopExpenses(
  expenses: PersonalExpense[],
  categories: PersonalCategory[],
  limit: number = 10,
  startDate?: string,
  endDate?: string
): TopExpense[] {
  const filtered = filterByDateRange(expenses, startDate, endDate);
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));

  return filtered
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((e) => {
      const cat = categoryLookup.get(e.categoryId);
      return {
        id: e.id,
        amount: e.amount,
        description: e.description,
        categoryId: e.categoryId,
        categoryName: cat?.name || 'Unknown',
        date: e.date,
      };
    });
}

function filterByDateRange(
  expenses: PersonalExpense[],
  startDate?: string,
  endDate?: string
): PersonalExpense[] {
  if (!startDate && !endDate) return expenses;

  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();

  return expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });
}

function filterIncomeByDateRange(
  incomeLogs: IncomeLog[],
  startDate?: string,
  endDate?: string
): IncomeLog[] {
  if (!startDate && !endDate) return incomeLogs;

  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();

  return incomeLogs.filter((i) => {
    const d = new Date(i.date);
    return d >= start && d <= end;
  });
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
