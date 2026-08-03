import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { useAuthStore } from './authStore';
import { PersonalBlob, Expense, generateId } from '../lib/personalSync';
import { onLogout } from '../lib/resetStores';

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

    const { pek, isGoogleUser } = useAuthStore.getState();
    if (isGoogleUser) throw new Error('Personal data is not available with Google sign-in');
    if (!pek) throw new Error('Encryption key not loaded. Please log out and log back in.');

    set({ isLoading: true, error: null });

    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    const current = personalBlob || { expenses: [], budgets: [], categories: [], incomeLogs: [], savingsTargets: [] };

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
      await savePersonalBlob(updated);
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

    const { pek, isGoogleUser } = useAuthStore.getState();
    if (isGoogleUser) throw new Error('Personal data is not available with Google sign-in');
    if (!pek) throw new Error('Encryption key not loaded. Please log out and log back in.');

    set({ isLoading: true, error: null });

    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    };

    try {
      await savePersonalBlob(updated);
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

    const { pek, isGoogleUser } = useAuthStore.getState();
    if (isGoogleUser) throw new Error('Personal data is not available with Google sign-in');
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
