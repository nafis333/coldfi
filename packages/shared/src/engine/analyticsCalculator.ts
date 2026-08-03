import type {
  PersonalExpense,
  PersonalCategory,
  IncomeLog,
} from '../types/personal';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  totalAmount: number;
  currency: string;
  transactionCount: number;
  percentOfTotal: number;
  averageTransaction: number;
}

export interface DailySpending {
  date: string;
  totalAmount: number;
  currency: string;
  transactionCount: number;
  categories: { categoryId: string; amount: number }[];
}

export interface SavingsResult {
  totalIncome: number;
  totalExpenses: number;
  currency: string;
  netSavings: number;
  savingsRate: number | null;
  bySource: { source: string; amount: number }[];
}

export interface SpendingTrend {
  month: string;
  totalSpent: number;
  currency: string;
  changeFromPrevious: number | null;
  changePercent: number | null;
}

export interface TopExpense {
  id: string;
  amount: number;
  currency: string;
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

  const currencyGroups = groupByCurrency(filtered);

  const results: CategorySpending[] = [];

  for (const [currency, currencyExpenses] of currencyGroups) {
    const totalAmount = currencyExpenses.reduce((sum, e) => sum + e.amount, 0);

    const categoryMap = new Map<string, {
      total: number;
      count: number;
    }>();

    for (const expense of currencyExpenses) {
      const existing = categoryMap.get(expense.categoryId) || { total: 0, count: 0 };
      existing.total += expense.amount;
      existing.count += 1;
      categoryMap.set(expense.categoryId, existing);
    }

    const categoryLookup = new Map(categories.map((c) => [c.id, c]));

    for (const [categoryId, data] of categoryMap) {
      const cat = categoryLookup.get(categoryId);
      results.push({
        categoryId,
        categoryName: cat?.name || 'Unknown',
        categoryIcon: cat?.icon || '?',
        categoryColor: cat?.color || '#888888',
        totalAmount: roundCents(data.total),
        currency,
        transactionCount: data.count,
        percentOfTotal: totalAmount > 0 ? roundCents((data.total / totalAmount) * 100) : 0,
        averageTransaction: data.count > 0 ? roundCents(data.total / data.count) : 0,
      });
    }
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
  const allDates = new Set<string>();

  const current = new Date(start);
  while (current <= end) {
    allDates.add(current.toISOString().split('T')[0]!);
    current.setDate(current.getDate() + 1);
  }

  const currencyDateMap = new Map<string, Map<string, { total: number; count: number; cats: Map<string, number> }>>();

  for (const expense of expenses) {
    const expenseDate = new Date(expense.date);
    if (expenseDate < start || expenseDate > end) continue;

    const dateStr = expense.date.split('T')[0]!;
    if (!allDates.has(dateStr)) continue;

    const currency = expense.currency || 'USD';
    if (!currencyDateMap.has(currency)) {
      currencyDateMap.set(currency, new Map());
    }
    const dateMap = currencyDateMap.get(currency)!;
    if (!dateMap.has(dateStr)) {
      dateMap.set(dateStr, { total: 0, count: 0, cats: new Map() });
    }
    const day = dateMap.get(dateStr)!;
    day.total += expense.amount;
    day.count += 1;
    day.cats.set(expense.categoryId, (day.cats.get(expense.categoryId) || 0) + expense.amount);
  }

  const results: DailySpending[] = [];
  const currencies = currencyDateMap.size > 0
    ? Array.from(currencyDateMap.keys())
    : expenses.length > 0 ? [...new Set(expenses.map(e => e.currency || 'USD'))] : ['USD'];

  for (const currency of currencies) {
    const dateMap = currencyDateMap.get(currency) || new Map();
    for (const dateStr of allDates) {
      const day = dateMap.get(dateStr);
      const cats: { categoryId: string; amount: number }[] = day
        ? (() => {
            const result: { categoryId: string; amount: number }[] = [];
            day.cats.forEach((amount: number, categoryId: string) => {
              result.push({ categoryId, amount: roundCents(amount) });
            });
            return result;
          })()
        : [];
      results.push({
        date: dateStr,
        totalAmount: day ? roundCents(day.total) : 0,
        currency,
        transactionCount: day?.count || 0,
        categories: cats,
      });
    }
  }

  return results;
}

export function computeSavings(
  incomeLogs: IncomeLog[],
  expenses: PersonalExpense[],
  startDate?: string,
  endDate?: string
): SavingsResult[] {
  const filteredExpenses = filterByDateRange(expenses, startDate, endDate);
  const filteredIncome = filterIncomeByDateRange(incomeLogs, startDate, endDate);

  const expenseByCurrency = new Map<string, number>();
  for (const e of filteredExpenses) {
    const cur = e.currency || 'USD';
    expenseByCurrency.set(cur, (expenseByCurrency.get(cur) || 0) + e.amount);
  }

  const incomeByCurrency = new Map<string, number>();
  for (const i of filteredIncome) {
    const cur = i.currency || 'USD';
    incomeByCurrency.set(cur, (incomeByCurrency.get(cur) || 0) + i.amount);
  }

  const allCurrencies = new Set([...expenseByCurrency.keys(), ...incomeByCurrency.keys()]);
  const results: SavingsResult[] = [];

  for (const currency of allCurrencies) {
    const totalExpenses = roundCents(expenseByCurrency.get(currency) || 0);
    const totalIncome = roundCents(incomeByCurrency.get(currency) || 0);
    const netSavings = roundCents(totalIncome - totalExpenses);
    const savingsRate = totalIncome > 0.005 ? roundCents((netSavings / totalIncome) * 100) : null;

    const sourceMap = new Map<string, number>();
    for (const income of filteredIncome) {
      if ((income.currency || 'USD') !== currency) continue;
      sourceMap.set(income.source, (sourceMap.get(income.source) || 0) + income.amount);
    }

    results.push({
      totalIncome,
      totalExpenses,
      currency,
      netSavings,
      savingsRate,
      bySource: Array.from(sourceMap.entries()).map(([source, amount]) => ({
        source,
        amount: roundCents(amount),
      })),
    });
  }

  return results;
}

export function computeSpendingTrend(
  expenses: PersonalExpense[],
  months: number = 6
): SpendingTrend[] {
  const now = new Date();
  const currencyGroups = groupByCurrency(expenses);
  const allTrends: SpendingTrend[] = [];

  for (const [currency, currencyExpenses] of currencyGroups) {
    const trends: SpendingTrend[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const monthStr = monthStart.toISOString().slice(0, 7);

      const monthExpenses = currencyExpenses.filter((e) => {
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
        currency,
        changeFromPrevious,
        changePercent,
      });
    }

    allTrends.push(...trends);
  }

  return allTrends;
}

export function computeTopExpenses(
  expenses: PersonalExpense[],
  categories: PersonalCategory[],
  limit: number = 10,
  startDate?: string,
  endDate?: string
): Record<string, TopExpense[]> {
  const filtered = filterByDateRange(expenses, startDate, endDate);
  const categoryLookup = new Map(categories.map((c) => [c.id, c]));
  const currencyGroups = groupByCurrency(filtered);
  const result: Record<string, TopExpense[]> = {};

  for (const [currency, currencyExpenses] of currencyGroups) {
    result[currency] = [...currencyExpenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map((e) => {
        const cat = categoryLookup.get(e.categoryId);
        return {
          id: e.id,
          amount: e.amount,
          currency,
          description: e.description,
          categoryId: e.categoryId,
          categoryName: cat?.name || 'Unknown',
          date: e.date,
        };
      });
  }

  return result;
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

function groupByCurrency(expenses: PersonalExpense[]): Map<string, PersonalExpense[]> {
  const groups = new Map<string, PersonalExpense[]>();
  for (const e of expenses) {
    const cur = e.currency || 'USD';
    if (!groups.has(cur)) groups.set(cur, []);
    groups.get(cur)!.push(e);
  }
  return groups;
}
