import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { useAuthStore } from './authStore';
import { PersonalBlob, Expense, generateId } from '../lib/personalSync';
import { fireBudgetAlerts } from '../lib/budgetAlerts';
import { onLogout } from '../lib/resetStores';

async function checkBudgetAlertsAfterSave(prevStatuses: any[]): Promise<void> {
  const personal = usePersonalStore.getState();
  if (personal.budgetStatuses.length === 0) return;
  const names: Record<string, string> = {};
  for (const c of personal.categories) names[c.id] = c.name;
  await fireBudgetAlerts(personal.budgets, names, prevStatuses, personal.budgetStatuses);
}

interface PersonalExpenseState {
  isLoading: boolean;
  error: string | null;

  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePersonalExpenseStore = create<PersonalExpenseState>((set) => ({
  isLoading: false,
  error: null,

  addExpense: async (expense) => {
    if (typeof expense.amount !== 'number' || isNaN(expense.amount) || expense.amount <= 0) throw new Error('Expense amount must be a positive number');

    const { pek } = useAuthStore.getState();
    if (!pek) throw new Error('Encryption key not loaded. Please log out and log back in.');

    set({ isLoading: true, error: null });

    const personalStore = usePersonalStore.getState();
    if (!personalStore.personalBlob) {
      await personalStore.fetchPersonalBlob();
    }

    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    // Fail closed: saving an empty blob would silently wipe all prior data.
    if (!personalBlob) {
      set({ error: personalStore.error || 'Could not load your data. Check your connection and try again.' });
      throw new Error(personalStore.error || 'Could not load your data. Check your connection and try again.');
    }
    const current = personalBlob;

    let newId = generateId();
    while (current.expenses.some(e => e.id === newId)) {
      newId = generateId();
    }
    const newExpense: Expense = {
      ...expense,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: PersonalBlob = {
      ...current,
      expenses: [newExpense, ...current.expenses],
    };

    try {
      const prevStatuses = usePersonalStore.getState().budgetStatuses;
      await savePersonalBlob(updated);
      await checkBudgetAlertsAfterSave(prevStatuses);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add expense' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateExpense: async (id, updates) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const { pek } = useAuthStore.getState();
    if (!pek) throw new Error('Encryption key not loaded. Please log out and log back in.');

    set({ isLoading: true, error: null });

    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    };

    try {
      const prevStatuses = usePersonalStore.getState().budgetStatuses;
      await savePersonalBlob(updated);
      await checkBudgetAlertsAfterSave(prevStatuses);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update expense' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteExpense: async (id) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const { pek } = useAuthStore.getState();
    if (!pek) throw new Error('Encryption key not loaded. Please log out and log back in.');

    set({ isLoading: true, error: null });

    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.filter((e) => e.id !== id),
    };

    try {
      await savePersonalBlob(updated);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete expense' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  usePersonalExpenseStore.setState({ isLoading: false, error: null });
});
