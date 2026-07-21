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

    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    const current = personalBlob || { expenses: [], budgets: [], categories: [] };

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

    usePersonalStore.setState({
      personalBlob: updated,
      expenses: updated.expenses,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: current as PersonalBlob, expenses: current.expenses });
      throw err;
    }
  },

  updateExpense: async (id, updates) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      expenses: updated.expenses,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, expenses: previousBlob.expenses });
      throw err;
    }
  },

  deleteExpense: async (id) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.filter((e) => e.id !== id),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      expenses: updated.expenses,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, expenses: previousBlob.expenses });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  usePersonalExpenseStore.setState({ isLoading: false, error: null });
});
