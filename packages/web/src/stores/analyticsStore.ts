import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { onLogout } from '../lib/resetStores';

interface MonthlyRecap {
  month: string;
  totalSpent: number;
  topCategory: { name: string; amount: number };
  biggestExpense: { description: string; amount: number };
  savingsRate: number;
}

interface AnalyticsState {
  recaps: MonthlyRecap[];
  isLoading: boolean;
  error: string | null;
  fetchRecap: (month: string) => Promise<void>;
  clearRecaps: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  recaps: [],
  isLoading: false,
  error: null,

  fetchRecap: async (month: string) => {
    set({ isLoading: true, error: null });

    try {
      const { expenses, budgets, categories, fetchPersonalBlob } = usePersonalStore.getState();

      // Ensure personal data is loaded
      if (expenses.length === 0 && budgets.length === 0) {
        await fetchPersonalBlob();
      }

      const state = usePersonalStore.getState();
      const allExpenses = state.expenses;
      const allBudgets = state.budgets;
      const allCategories = state.categories;

      // Filter expenses for the selected month
      const monthExpenses = allExpenses.filter((e) => {
        const d = new Date(e.date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return ym === month;
      });

      const totalSpent = monthExpenses.reduce((sum, e) => sum + e.amount, 0);

      // Top category by total
      const categoryTotals: Record<string, number> = {};
      for (const e of monthExpenses) {
        categoryTotals[e.categoryId] = (categoryTotals[e.categoryId] || 0) + e.amount;
      }

      let topCategory = { name: 'None', amount: 0 };
      let topCatAmount = 0;
      for (const [catId, total] of Object.entries(categoryTotals)) {
        if (total > topCatAmount) {
          topCatAmount = total;
          const cat = allCategories.find((c) => c.id === catId);
          topCategory = { name: cat?.name || catId, amount: total };
        }
      }

      // Biggest single expense
      let biggestExpense = { description: 'None', amount: 0 };
      let maxAmount = 0;
      for (const e of monthExpenses) {
        if (e.amount > maxAmount) {
          maxAmount = e.amount;
          biggestExpense = {
            description: e.note || e.payee || 'Expense',
            amount: e.amount,
          };
        }
      }

      // Savings rate: 1 - (spent / budgeted)
      const monthBudgets = allBudgets.filter((b) => {
        const start = new Date(b.periodStart);
        const end = new Date(b.periodEnd);
        const ymStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
        const ymEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;
        return ymStart <= month && ymEnd >= month;
      });
      const totalBudgeted = monthBudgets.reduce((sum, b) => sum + b.amount, 0);
      const savingsRate = totalBudgeted > 0
        ? Math.max(0, ((totalBudgeted - totalSpent) / totalBudgeted) * 100)
        : 0;

      const recap: MonthlyRecap = {
        month,
        totalSpent,
        topCategory,
        biggestExpense,
        savingsRate,
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
