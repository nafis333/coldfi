import { create } from 'zustand';
import { encryptData, decryptData } from '../lib/crypto';
import { useAuthStore } from './authStore';
import { computeBudgetStatus, BudgetStatus, BudgetType, PaymentMethod, type BudgetStatusResult } from '@coldfi/shared';
import { onLogout } from '../lib/resetStores';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Expense {
  id: string;
  amount: number;
  currency: string;
  categoryId: string;
  date: string;
  payee: string | null;
  note: string | null;
  paymentMethod: string | null;
  receiptUri: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Budget {
  id: string;
  categoryId: string;
  type: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  alertThreshold: number;
  rollover: boolean;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  category: string;
  nextDueDate: string;
  isActive: boolean;
}

interface PersonalBlob {
  version?: number;
  updatedAt?: string;
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  recurringBills?: RecurringBill[];
  incomeLogs?: Array<{ source: string; amount: number; currency: string; date: string }>;
  savingsTargets?: Array<{ name: string; targetAmount: number; currentAmount: number; currency: string }>;
}

interface PersonalState {
  personalBlob: PersonalBlob | null;
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  budgetStatuses: BudgetStatusResult[];
  isLoading: boolean;
  error: string | null;

  fetchPersonalBlob: () => Promise<void>;
  savePersonalBlob: (blob: PersonalBlob) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateExpense: (id: string, updates: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addBudget: (budget: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, updates: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  clearError: () => void;
}

function computeBudgetStatuses(
  budgets: Budget[],
  expenses: Expense[]
): BudgetStatusResult[] {
  return budgets.map((b) =>
    computeBudgetStatus(
      {
        id: b.id,
        categoryId: b.categoryId,
        type: b.type as BudgetType,
        amount: b.amount,
        currency: b.currency,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        status: BudgetStatus.GREEN,
        alertThreshold: b.alertThreshold,
        createdAt: '',
        updatedAt: '',
      },
      expenses.map((e) => ({
        id: e.id,
        amount: e.amount,
        categoryId: e.categoryId,
        date: e.date,
        currency: e.currency,
        description: e.note ?? '',
        paymentMethod: (e.paymentMethod ?? 'other') as PaymentMethod,
        isRecurring: e.isRecurring,
        tags: [],
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }))
    )
  );
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export const usePersonalStore = create<PersonalState>((set, get) => ({
  personalBlob: null,
  expenses: [],
  budgets: [],
  categories: [],
  budgetStatuses: [],
  isLoading: false,
  error: null,

  fetchPersonalBlob: async () => {
    const { accessToken, pek } = useAuthStore.getState();
    if (!accessToken || !pek) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/api/personal/sync`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (res.status === 404) {
        set({ isLoading: false, personalBlob: null, expenses: [], budgets: [], categories: [] });
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (!data.encryptedBlob) {
        set({ isLoading: false, personalBlob: null, expenses: [], budgets: [], categories: [] });
        return;
      }

      const decrypted = await decryptData(pek, data.encryptedBlob);
      const blob: PersonalBlob = JSON.parse(decrypted);

      const budgetStatuses = computeBudgetStatuses(blob.budgets, blob.expenses);

      set({
        personalBlob: blob,
        expenses: blob.expenses,
        budgets: blob.budgets,
        categories: blob.categories,
        budgetStatuses,
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
    if (!accessToken || !pek) {
      throw new Error('Not authenticated');
    }

    const plaintext = JSON.stringify(blob);
    const encryptedBlob = await encryptData(pek, plaintext);
    const vectorClock = Date.now();

    const res = await fetch(`${API_BASE}/api/personal/sync`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        encryptedBlob,
        vectorClock,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to save: ${res.status}`);
    }

    const budgetStatuses = computeBudgetStatuses(blob.budgets, blob.expenses);

    set({
      personalBlob: blob,
      expenses: blob.expenses,
      budgets: blob.budgets,
      categories: blob.categories,
      budgetStatuses,
    });
  },

  addExpense: async (expense) => {
    const { personalBlob } = get();
    const current = personalBlob || { expenses: [], budgets: [], categories: [] };

    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: PersonalBlob = {
      ...current,
      expenses: [newExpense, ...current.expenses],
    };

    await get().savePersonalBlob(updated);
  },

  updateExpense: async (id, updates) => {
    const { personalBlob } = get();
    if (!personalBlob) throw new Error('No data loaded');

    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
      ),
    };

    await get().savePersonalBlob(updated);
  },

  deleteExpense: async (id) => {
    const { personalBlob } = get();
    if (!personalBlob) throw new Error('No data loaded');

    const updated: PersonalBlob = {
      ...personalBlob,
      expenses: personalBlob.expenses.filter((e) => e.id !== id),
    };

    await get().savePersonalBlob(updated);
  },

  addBudget: async (budget) => {
    const { personalBlob } = get();
    const current = personalBlob || { expenses: [], budgets: [], categories: [] };

    const newBudget: Budget = {
      ...budget,
      id: generateId(),
    };

    const updated: PersonalBlob = {
      ...current,
      budgets: [...(current.budgets || []), newBudget],
    };

    await get().savePersonalBlob(updated);
  },

  updateBudget: async (id, updates) => {
    const { personalBlob } = get();
    if (!personalBlob) throw new Error('No data loaded');

    const updated: PersonalBlob = {
      ...personalBlob,
      budgets: personalBlob.budgets.map((b) =>
        b.id === id ? { ...b, ...updates } : b
      ),
    };

    await get().savePersonalBlob(updated);
  },

  deleteBudget: async (id) => {
    const { personalBlob } = get();
    if (!personalBlob) throw new Error('No data loaded');

    const updated: PersonalBlob = {
      ...personalBlob,
      budgets: personalBlob.budgets.filter((b) => b.id !== id),
    };

    await get().savePersonalBlob(updated);
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
    isLoading: false,
    error: null,
  });
});
