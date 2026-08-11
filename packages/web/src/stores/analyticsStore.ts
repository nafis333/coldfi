import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { useAuthStore } from './authStore';
import { useGroupStore } from './groupStore';
import { useGroupExpenseStore } from './groupExpenseStore';
import { silentCatch } from '../lib/errorHandler';
import { onLogout } from '../lib/resetStores';
import { parseLocalDate } from '@coldfi/shared';

interface CategorySummary {
  id: string;
  name: string;
  amount: number;
  percentage: number;
}

interface IncomeSource {
  source: string;
  amount: number;
}

interface BudgetProgress {
  name: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

interface MonthlyRecap {
  month: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  expenseCount: number;
  dailyAverage: number;
  averageTransaction: number;
  topCategory: { name: string; amount: number };
  biggestExpense: { description: string; amount: number };
  topSpendingDay: { day: number; total: number };
  weekdayTotal: number;
  weekendTotal: number;
  personalTopExpenses: { description: string; amount: number; date: string }[];
  groupTopExpenses: { groupName: string; description: string; amount: number; date: string }[];
  savingsRate: number;
  categories: CategorySummary[];
  incomeSources: IncomeSource[];
  budgets: BudgetProgress[];
}

interface AnalyticsState {
  recaps: MonthlyRecap[];
  isLoading: boolean;
  error: string | null;
  fetchRecap: (month: string) => Promise<void>;
  clearRecaps: () => void;
}

function monthBoundaries(month: string) {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
  return { start, end, daysInMonth: new Date(Date.UTC(year, m, 0)).getUTCDate() };
}

// Days to divide daily-average math by: full month for past months, days
// elapsed so far (including today) for the current month.
export function activeDaysInMonth(month: string): number {
  const { daysInMonth } = monthBoundaries(month);
  const [year, m] = month.split('-').map(Number);
  const now = new Date();
  const currentIndex = now.getFullYear() * 12 + now.getMonth();
  const monthIndex = year * 12 + (m - 1);
  if (monthIndex === currentIndex) return Math.max(1, now.getDate());
  if (monthIndex < currentIndex) return daysInMonth;
  return daysInMonth;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  recaps: [],
  isLoading: false,
  error: null,

  fetchRecap: async (month: string) => {
    set({ isLoading: true, error: null });

    try {
      const { expenses, budgets, fetchPersonalBlob } = usePersonalStore.getState();

      if (expenses.length === 0 && budgets.length === 0) {
        await fetchPersonalBlob();
        // fetchPersonalBlob swallows failures (sets store.error) — abort here
        // so a transient failure cannot replace a good recap with zeros.
        const fetchError = usePersonalStore.getState().error;
        if (fetchError) {
          throw new Error(fetchError);
        }
      }

      const state = usePersonalStore.getState();
      const allExpenses = state.expenses;
      const allBudgets = state.budgets;
      const allCategories = state.categories;
      const allIncomeLogs = state.incomeLogs || [];
      const defaultCurrency = useAuthStore.getState().defaultCurrency || 'BDT';

      const monthExpenses = allExpenses.filter((e) => {
        const d = parseLocalDate(e.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === month;
      });

      const monthIncome = allIncomeLogs.filter((i) => {
        const d = parseLocalDate(i.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === month;
      });

      // Recap numbers are rendered with a single currency label — restrict the
      // aggregates to the user's default currency so they are never mixed.
      const defaultMonthExpenses = monthExpenses.filter((e) => (e.currency || defaultCurrency) === defaultCurrency);
      const defaultMonthIncome = monthIncome.filter((i) => (i.currency || defaultCurrency) === defaultCurrency);

      const totalSpent = defaultMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalIncome = defaultMonthIncome.reduce((sum, i) => sum + i.amount, 0);
      const netSavings = totalIncome - totalSpent;
      const expenseCount = defaultMonthExpenses.length;
      const dailyAverage = activeDaysInMonth(month) > 0 ? totalSpent / activeDaysInMonth(month) : 0;
      const averageTransaction = expenseCount > 0 ? totalSpent / expenseCount : 0;

      // Top spending day of the month
      const dayTotals: Record<number, number> = {};
      for (const e of defaultMonthExpenses) {
        const day = parseLocalDate(e.date).getDate();
        dayTotals[day] = (dayTotals[day] || 0) + e.amount;
      }
      let topSpendingDay = { day: 1, total: 0 };
      for (const [day, total] of Object.entries(dayTotals)) {
        if (total > topSpendingDay.total) {
          topSpendingDay = { day: Number(day), total };
        }
      }

      // Weekday vs weekend spending
      let weekdayTotal = 0;
      let weekendTotal = 0;
      for (const e of defaultMonthExpenses) {
        const d = parseLocalDate(e.date).getDay();
        if (d === 0 || d === 6) weekendTotal += e.amount;
        else weekdayTotal += e.amount;
      }

      // Top 5 personal expenses (individual items)
      const sortedExpenses = [...defaultMonthExpenses].sort((a, b) => b.amount - a.amount);
      const personalTopExpenses = sortedExpenses.slice(0, 5).map((e) => ({
        description: e.note || e.payee || 'Expense',
        amount: e.amount,
        date: e.date,
      }));

      // Top 5 group expense sheets (whole sheets from any group)
      const groupExpenseState = useGroupExpenseStore.getState();
      let groupTopExpenses: { groupName: string; description: string; amount: number; date: string }[] = [];
      try {
        if (Object.keys(groupExpenseState.groupExpensesCache).length === 0) {
          await groupExpenseState.fetchAllGroupExpenses();
        }
        const updatedGroupExpenseState = useGroupExpenseStore.getState();
        const cache = updatedGroupExpenseState.groupExpensesCache;
        const allGroupSheets: { groupName: string; description: string; amount: number; date: string }[] = [];
        for (const [gid, entry] of Object.entries(cache)) {
          for (const exp of entry.expenses) {
            const d = parseLocalDate(exp.date || exp.createdAt);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (ym === month) {
              allGroupSheets.push({
                groupName: entry.name,
                description: exp.description || 'Expense',
                amount: exp.amount,
                date: exp.date || exp.createdAt,
              });
            }
          }
        }
        groupTopExpenses = allGroupSheets.sort((a, b) => b.amount - a.amount).slice(0, 5);
      } catch (err) {
        silentCatch('analyticsStore.groupData', err);
      }

      // Category breakdown
      const categoryTotals: Record<string, number> = {};
      for (const e of defaultMonthExpenses) {
        categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
      }

      const categoryEntries = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
      const catSummary: CategorySummary[] = categoryEntries.map(([catId, amount]) => {
        const cat = allCategories.find((c) => c.id === catId);
        return {
          id: catId,
          name: cat?.name || catId.slice(0, 8),
          amount,
          percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
        };
      });

      let topCategory = { name: 'None', amount: 0 };
      if (catSummary.length > 0) {
        const top = catSummary[0];
        topCategory = { name: top.name, amount: top.amount };
      }

      // Biggest single expense
      let biggestExpense = { description: 'None', amount: 0 };
      let maxAmount = 0;
      for (const e of defaultMonthExpenses) {
        if (e.amount > maxAmount) {
          maxAmount = e.amount;
          biggestExpense = {
            description: e.note || e.payee || 'Expense',
            amount: e.amount,
          };
        }
      }

      // Income sources
      const sourceTotals: Record<string, number> = {};
      for (const i of defaultMonthIncome) {
        sourceTotals[i.source] = (sourceTotals[i.source] || 0) + i.amount;
      }
      const incomeSources: IncomeSource[] = Object.entries(sourceTotals)
        .sort(([, a], [, b]) => b - a)
        .map(([source, amount]) => ({ source, amount }));

      // Budget progress
      const monthBudgets = allBudgets.filter((b) => {
        if ((b.currency || defaultCurrency) !== defaultCurrency) return false;
        const start = parseLocalDate(b.periodStart);
        const end = parseLocalDate(b.periodEnd);
        const ymStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        const ymEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
        return ymStart <= month && ymEnd >= month;
      });

      const savingsRate = totalIncome > 0
        ? Math.max(0, ((totalIncome - totalSpent) / totalIncome) * 100)
        : 0;

      // Per-budget breakdown
      const budgetProgress: BudgetProgress[] = monthBudgets.map((b) => {
        const budgetCategories = defaultMonthExpenses.filter((e) => {
          if (b.categoryId === '__all__') return true;
          return e.categoryId === b.categoryId;
        });
        const spent = budgetCategories.reduce((s, e) => s + e.amount, 0);
        const remaining = Math.max(0, b.amount - spent);
        return {
          name: b.categoryId === '__all__'
            ? 'All categories'
            : (allCategories.find((c) => c.id === b.categoryId)?.name ?? b.categoryId),
          budgeted: b.amount,
          spent,
          remaining,
          percentage: b.amount > 0 ? Math.min(100, Math.round((spent / b.amount) * 100)) : 0,
        };
      });

      const recap: MonthlyRecap = {
        month,
        totalSpent,
        totalIncome,
        netSavings,
        expenseCount,
        dailyAverage,
        averageTransaction,
        topCategory,
        biggestExpense,
        topSpendingDay,
        weekdayTotal,
        weekendTotal,
        personalTopExpenses,
        groupTopExpenses,
        savingsRate,
        categories: catSummary,
        incomeSources,
        budgets: budgetProgress,
      };

      set((prev) => {
        const existing = prev.recaps.findIndex((r) => r.month === month);
        const recaps = existing >= 0
          ? prev.recaps.map((r, i) => (i === existing ? recap : r))
          : [...prev.recaps, recap];
        return { recaps, isLoading: false };
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recap',
      });
    }
  },

  clearRecaps: () => set({ recaps: [], error: null }),
}));

onLogout(() => {
  useAnalyticsStore.setState({
    recaps: [],
    isLoading: false,
    error: null,
  });
});
