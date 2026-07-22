import { create } from 'zustand';
import { encryptData, decryptData } from '../lib/crypto';
import { apiClient } from '../lib/apiClient';
import { useAuthStore } from './authStore';
import { migratePersonalBlob } from '@coldfi/shared';
import { onLogout } from '../lib/resetStores';
import {
  PersonalBlob,
  Expense,
  Budget,
  Category,
  IncomeLog,
  SavingsTarget,
  computeBudgetStatuses,
} from '../lib/personalSync';

export type { RecurringBill, Frequency } from '../lib/personalSync';

interface PersonalState {
  personalBlob: PersonalBlob | null;
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  budgetStatuses: any[];
  incomeLogs: IncomeLog[];
  savingsTargets: SavingsTarget[];
  isLoading: boolean;
  error: string | null;

  fetchPersonalBlob: () => Promise<void>;
  savePersonalBlob: (blob: PersonalBlob) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePersonalStore = create<PersonalState>((set, get) => ({
  personalBlob: null,
  expenses: [],
  budgets: [],
  categories: [],
  budgetStatuses: [],
  incomeLogs: [],
  savingsTargets: [],
  isLoading: false,
  error: null,

  fetchPersonalBlob: async () => {
    const { accessToken, pek, isGoogleUser } = useAuthStore.getState();
    if (!accessToken || (!pek && !isGoogleUser)) {
      set({ error: 'Not authenticated' });
      return;
    }

    if (!pek) {
      set({ isLoading: false, personalBlob: null, expenses: [], budgets: [], categories: [], budgetStatuses: [], incomeLogs: [], savingsTargets: [] });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await apiClient('/api/personal/sync');

      if (res.status === 404) {
        set({ isLoading: false, personalBlob: null, expenses: [], budgets: [], categories: [], budgetStatuses: [], incomeLogs: [], savingsTargets: [] });
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (!data.encryptedBlob) {
        set({ isLoading: false, personalBlob: null, expenses: [], budgets: [], categories: [], budgetStatuses: [], incomeLogs: [], savingsTargets: [] });
        return;
      }

      const decrypted = await decryptData(pek, data.encryptedBlob);
      let blob: PersonalBlob = JSON.parse(decrypted);
      blob = migratePersonalBlob(blob as unknown as Record<string, unknown>) as unknown as PersonalBlob;

      const { statuses: budgetStatuses, updatedBudgets } = computeBudgetStatuses(blob.budgets, blob.expenses);
      blob.budgets = updatedBudgets;

      set({
        personalBlob: blob,
        expenses: blob.expenses,
        budgets: updatedBudgets,
        categories: blob.categories,
        budgetStatuses,
        incomeLogs: blob.incomeLogs || [],
        savingsTargets: blob.savingsTargets || [],
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch personal data',
      });
    }
  },

  savePersonalBlob: async (blob: PersonalBlob) => {
    const { accessToken, pek, isGoogleUser } = useAuthStore.getState();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    if (!pek) {
      if (isGoogleUser) return;
      throw new Error('No encryption key loaded');
    }

    const plaintext = JSON.stringify(blob);
    const encryptedBlob = await encryptData(pek, plaintext);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const vectorClock = Date.now();

      const res = await apiClient('/api/personal/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedBlob, vectorClock }),
      });

      if (res.ok) {
        const { statuses: budgetStatuses, updatedBudgets } = computeBudgetStatuses(blob.budgets, blob.expenses);

        set({
          personalBlob: { ...blob, budgets: updatedBudgets },
          expenses: blob.expenses,
          budgets: updatedBudgets,
          categories: blob.categories,
          budgetStatuses,
          incomeLogs: blob.incomeLogs || [],
          savingsTargets: blob.savingsTargets || [],
        });
        return;
      }

      if (res.status === 409 && attempt < 2) {
        lastError = new Error('Data conflict. Retrying...');
        continue;
      }

      throw new Error(`Failed to save: ${res.status}`);
    }

    throw lastError || new Error('Failed to save personal data');
  },

  addCategory: async (category) => {
    const previous = get();
    const prevBlob = previous.personalBlob;
    const current = prevBlob || { expenses: [], budgets: [], categories: [], incomeLogs: [], savingsTargets: [] };

    const { generateId } = await import('../lib/personalSync');
    const newCategory: Category = {
      ...category,
      id: generateId(),
    };

    const updated: PersonalBlob = {
      ...current,
      categories: [...(current.categories || []), newCategory],
    };

    set({
      personalBlob: updated,
      categories: updated.categories,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await get().savePersonalBlob(updated);
      }
    } catch (err) {
      set({
        personalBlob: prevBlob,
        categories: prevBlob?.categories || [],
        budgetStatuses: previous.budgetStatuses,
        incomeLogs: previous.incomeLogs,
        savingsTargets: previous.savingsTargets,
      });
      throw err;
    }
  },

  deleteCategory: async (id: string) => {
    const { personalBlob } = get();
    if (!personalBlob) return;

    const previousBlob = personalBlob;
    const updated: PersonalBlob = {
      ...personalBlob,
      categories: personalBlob.categories.filter((c) => c.id !== id),
    };

    set({
      personalBlob: updated,
      categories: updated.categories,
    });

    try {
      const { pek } = useAuthStore.getState();
      if (pek) {
        await get().savePersonalBlob(updated);
      }
    } catch (err) {
      set({ personalBlob: previousBlob, categories: previousBlob.categories });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  usePersonalStore.setState({
    personalBlob: null,
    expenses: [],
    budgets: [],
    categories: [],
    budgetStatuses: [],
    incomeLogs: [],
    savingsTargets: [],
    isLoading: false,
    error: null,
  });
});
