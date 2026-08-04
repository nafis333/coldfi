import { create } from 'zustand';
import { usePersonalStore } from './personalStore';
import { useAuthStore } from './authStore';
import { PersonalBlob, IncomeLog, SavingsTarget, generateId } from '../lib/personalSync';
import { onLogout } from '../lib/resetStores';

interface PersonalIncomeState {
  isLoading: boolean;
  error: string | null;

  addIncome: (income: { source: string; amount: number; currency: string; date: string; note?: string }) => Promise<void>;
  updateIncome: (id: string, updates: Partial<IncomeLog>) => Promise<void>;
  deleteIncome: (id: string) => Promise<void>;
  addSavingsTarget: (target: { name: string; targetAmount: number; currentAmount: number; currency: string }) => Promise<void>;
  updateSavingsTarget: (id: string, updates: Partial<SavingsTarget>) => Promise<void>;
  deleteSavingsTarget: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePersonalIncomeStore = create<PersonalIncomeState>((set) => ({
  isLoading: false,
  error: null,

  addIncome: async (income) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    const current = personalBlob || { expenses: [], budgets: [], categories: [], incomeLogs: [], savingsTargets: [] };

    const newIncome: IncomeLog = {
      ...income,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: PersonalBlob = {
      ...current,
      incomeLogs: [newIncome, ...(current.incomeLogs || [])],
    };

    usePersonalStore.setState({
      personalBlob: updated,
      incomeLogs: updated.incomeLogs || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: current as PersonalBlob, incomeLogs: current.incomeLogs || [] });
      throw err;
    }
  },

  updateIncome: async (id, updates) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      incomeLogs: (personalBlob.incomeLogs || []).map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
      ),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      incomeLogs: updated.incomeLogs || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, incomeLogs: previousBlob.incomeLogs || [] });
      throw err;
    }
  },

  deleteIncome: async (id) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      incomeLogs: (personalBlob.incomeLogs || []).filter((i) => i.id !== id),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      incomeLogs: updated.incomeLogs || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, incomeLogs: previousBlob.incomeLogs || [] });
      throw err;
    }
  },

  addSavingsTarget: async (target) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    const current = personalBlob || { expenses: [], budgets: [], categories: [], incomeLogs: [], savingsTargets: [] };

    const newTarget: SavingsTarget = {
      ...target,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: PersonalBlob = {
      ...current,
      savingsTargets: [...(current.savingsTargets || []), newTarget],
    };

    usePersonalStore.setState({
      personalBlob: updated,
      savingsTargets: updated.savingsTargets || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: current as PersonalBlob, savingsTargets: current.savingsTargets || [] });
      throw err;
    }
  },

  updateSavingsTarget: async (id, updates) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      savingsTargets: (personalBlob.savingsTargets || []).map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
      ),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      savingsTargets: updated.savingsTargets || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, savingsTargets: previousBlob.savingsTargets || [] });
      throw err;
    }
  },

  deleteSavingsTarget: async (id) => {
    const { personalBlob, savePersonalBlob } = usePersonalStore.getState();
    if (!personalBlob) throw new Error('No data loaded');

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      savingsTargets: (personalBlob.savingsTargets || []).filter((t) => t.id !== id),
    };

    usePersonalStore.setState({
      personalBlob: updated,
      savingsTargets: updated.savingsTargets || [],
    });

    try {
      const { pek } = useAuthStore.getState();
      if (!pek) {
        throw new Error('No encryption key loaded');
      }
      await savePersonalBlob(updated);
    } catch (err) {
      usePersonalStore.setState({ personalBlob: previousBlob, savingsTargets: previousBlob.savingsTargets || [] });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  usePersonalIncomeStore.setState({ isLoading: false, error: null });
});
