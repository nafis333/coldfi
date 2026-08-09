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

let personalVectorClock = Date.now();

function setLastVectorClock(clock: number): void {
  personalVectorClock = Math.max(personalVectorClock, clock);
}

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
    const { accessToken, pek } = useAuthStore.getState();
    if (!accessToken || !pek) {
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
    const { accessToken, pek } = useAuthStore.getState();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    if (!pek) {
      throw new Error('No encryption key loaded');
    }

    const plaintext = JSON.stringify(blob);
    let encryptedBlob = await encryptData(pek, plaintext);
    let savedBlob = blob;

    let vectorClock = ++personalVectorClock;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await apiClient('/api/personal/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedBlob, vectorClock }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.vectorClock) {
          setLastVectorClock(data.vectorClock);
        }
        const { statuses: budgetStatuses, updatedBudgets } = computeBudgetStatuses(savedBlob.budgets, savedBlob.expenses);

        set({
          personalBlob: { ...savedBlob, budgets: updatedBudgets },
          expenses: savedBlob.expenses,
          budgets: updatedBudgets,
          categories: savedBlob.categories,
          budgetStatuses,
          incomeLogs: savedBlob.incomeLogs || [],
          savingsTargets: savedBlob.savingsTargets || [],
        });
        return;
      }

      if (res.status === 409 && attempt < 2) {
        const refreshRes = await apiClient('/api/personal/sync');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          vectorClock = (refreshData.vectorClock || 0) + 1;
          if (refreshData.encryptedBlob) {
            const freshPlaintext = await decryptData(pek, refreshData.encryptedBlob);
            const freshBlob = JSON.parse(freshPlaintext) as PersonalBlob;
            const merged: PersonalBlob = {
              ...blob,
              ...freshBlob,
              expenses: [...(freshBlob.expenses || []), ...(blob.expenses || []).filter(e => !freshBlob.expenses?.some((fe: any) => fe.id === e.id))],
              budgets: [...(freshBlob.budgets || []), ...(blob.budgets || []).filter(b => !freshBlob.budgets?.some((fb: any) => fb.id === b.id))],
              categories: [...(freshBlob.categories || []), ...(blob.categories || []).filter(c => !freshBlob.categories?.some((fc: any) => fc.id === c.id))],
              recurringBills: [...(freshBlob.recurringBills || []), ...(blob.recurringBills || []).filter(r => !freshBlob.recurringBills?.some((fr: any) => fr.id === r.id))],
              incomeLogs: [...(freshBlob.incomeLogs || []), ...(blob.incomeLogs || []).filter(i => !freshBlob.incomeLogs?.some((fi: any) => fi.id === i.id))],
              savingsTargets: [...(freshBlob.savingsTargets || []), ...(blob.savingsTargets || []).filter(s => !freshBlob.savingsTargets?.some((fs: any) => fs.id === s.id))],
            };
            const mergedPlaintext = JSON.stringify(merged);
            encryptedBlob = await encryptData(pek, mergedPlaintext);
            savedBlob = merged;
          }
        } else {
          vectorClock = Date.now();
        }
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
