import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { useAuthStore } from './authStore';
import { PersonalBlob, Budget, generateId } from '../lib/personalSync';
import { onLogout } from '../lib/resetStores';

interface PersonalBudgetState {
  isLoading: boolean;
  error: string | null;

  addBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePersonalBudgetStore = create<PersonalBudgetState>((set) => ({
  isLoading: false,
  error: null,

  addBudget: async (budget) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    const current = personalBlob || { expenses: [], budgets: [], categories: [] };

    const newBudget: Budget = {
      ...budget,
      id: generateId(),
    };

    const updated: PersonalBlob = {
      ...current,
      budgets: [...(current.budgets || []), newBudget],
    };

    usePersonalStore.setState({
      personalBlob: updated,
      budgets: updated.budgets,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: current as PersonalBlob, budgets: current.budgets || [] });
      throw err;
    }
  },

  updateBudget: async (id, updates) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      budgets: personalBlob.budgets.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      budgets: updated.budgets,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, budgets: previousBlob.budgets });
      throw err;
    }
  },

  deleteBudget: async (id) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      budgets: personalBlob.budgets.filter((b) => b.id !== id),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      budgets: updated.budgets,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await savePersonalBlob(updated);
      }
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, budgets: previousBlob.budgets });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  usePersonalBudgetStore.setState({ isLoading: false, error: null });
});
