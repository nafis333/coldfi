import { create } from 'zustand';
import { usePersonalStore, type RecurringBill, type Frequency } from './personalStore';
import { useAuthStore } from './authStore';
import { onLogout } from '../lib/resetStores';

export type BillStatus = 'paid' | 'overdue' | 'due_soon' | 'upcoming' | 'paused' | 'due_today';

interface RecurringState {
  recurringBills: RecurringBill[];
  isLoading: boolean;
  error: string | null;
  generatedCount: number;

  fetchRecurringBills: () => Promise<void>;
  createRecurringBill: (data: Omit<RecurringBill, 'id' | 'isActive'>) => Promise<void>;
  updateRecurringBill: (id: string, updates: Partial<RecurringBill>) => Promise<void>;
  toggleRecurringBill: (id: string, isActive: boolean) => Promise<void>;
  processDueBills: () => Promise<string[]>;
  markAsPaid: (id: string) => Promise<void>;
  undoMarkAsPaid: (id: string) => Promise<void>;
  clearGeneratedCount: () => void;
  clearError: () => void;
}

function toLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateOnlyISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function computeBillStatus(bill: RecurringBill): BillStatus {
  if (!bill.isActive) return 'paused';

  const today = todayLocal();
  const dueDate = toLocalDate(bill.nextDueDate);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (bill.lastPaidDate) {
    const paidDate = toLocalDate(bill.lastPaidDate);
    const prevDueDate = previousDueDate(bill.nextDueDate, bill.frequency);
    if (paidDate >= prevDueDate && diffDays > 0) return 'paid';
  }

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  if (diffDays <= 7) return 'due_soon';
  return 'upcoming';
}

export function getDaysUntilDue(nextDueDate: string): number {
  const today = todayLocal();
  const due = toLocalDate(nextDueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function previousDueDate(current: string, frequency: Frequency): Date {
  const d = toLocalDate(current);
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() - 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() - 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() - 1);
      break;
  }
  return d;
}

function generateId(): string {
  return `rb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeNextDueDate(current: string, frequency: Frequency): string {
  const d = toLocalDate(current);
  const origDate = d.getDate();
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      if (d.getDate() !== origDate) {
        d.setDate(0);
      }
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return dateOnlyISO(d);
}

export const useRecurringStore = create<RecurringState>((set) => ({
  recurringBills: [],
  isLoading: false,
  error: null,
  generatedCount: 0,

  fetchRecurringBills: async () => {
    set({ isLoading: true, error: null });

    try {
      const { personalBlob, fetchPersonalBlob } = usePersonalStore.getState();

      if (!personalBlob) {
        await fetchPersonalBlob();
        const afterFetch = usePersonalStore.getState();
        if (!afterFetch.personalBlob) {
          throw new Error('Failed to load personal data');
        }
      }

      const state = usePersonalStore.getState();
      const bills = state.personalBlob?.recurringBills ?? [];

      set({ recurringBills: bills, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recurring bills',
      });
    }
  },

  createRecurringBill: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const personalStore = usePersonalStore.getState();
      const blob = personalStore.personalBlob;

      if (!blob) {
        await personalStore.fetchPersonalBlob();
      }

      const state = usePersonalStore.getState();
      const currentBlob = state.personalBlob;
      if (!currentBlob) {
        throw new Error('Personal data not available');
      }

      const newBill: RecurringBill = {
        ...data,
        id: generateId(),
        isActive: true,
      };

      const updatedBlob = {
        ...currentBlob,
        recurringBills: [...(currentBlob.recurringBills ?? []), newBill],
      };

      await state.savePersonalBlob(updatedBlob);
      set({ recurringBills: updatedBlob.recurringBills!, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create recurring bill',
      });
      throw error;
    }
  },

  updateRecurringBill: async (id, updates) => {
    set({ isLoading: true, error: null });

    try {
      const state = usePersonalStore.getState();
      const blob = state.personalBlob;
      if (!blob) throw new Error('Personal data not loaded');

      const updatedBills = (blob.recurringBills ?? []).map((b) =>
        b.id === id ? { ...b, ...updates } : b
      );

      const updatedBlob = { ...blob, recurringBills: updatedBills };
      await state.savePersonalBlob(updatedBlob);
      set({ recurringBills: updatedBills, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update recurring bill',
      });
      throw error;
    }
  },

  toggleRecurringBill: async (id, isActive) => {
    set({ error: null });

    try {
      const state = usePersonalStore.getState();
      const blob = state.personalBlob;
      if (!blob) return;

      const updatedBills = (blob.recurringBills ?? []).map((b) =>
        b.id === id ? { ...b, isActive } : b
      );

      const updatedBlob = { ...blob, recurringBills: updatedBills };
      await state.savePersonalBlob(updatedBlob);
      set({ recurringBills: updatedBills });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to toggle recurring bill',
      });
      throw error;
    }
  },

  markAsPaid: async (id) => {
    set({ error: null });

    try {
      const state = usePersonalStore.getState();
      const blob = state.personalBlob;
      if (!blob) return;

      const today = dateOnlyISO(new Date());
      const updatedBills = (blob.recurringBills ?? []).map((b) =>
        b.id === id
          ? {
              ...b,
              lastPaidDate: today,
              previousNextDueDate: b.nextDueDate,
              nextDueDate: computeNextDueDate(b.nextDueDate, b.frequency),
            }
          : b
      );

      const updatedBlob = { ...blob, recurringBills: updatedBills };
      await state.savePersonalBlob(updatedBlob);
      set({ recurringBills: updatedBills });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to mark bill as paid',
      });
      throw error;
    }
  },

  undoMarkAsPaid: async (id) => {
    set({ error: null });

    try {
      const state = usePersonalStore.getState();
      const blob = state.personalBlob;
      if (!blob) return;

      const updatedBills = (blob.recurringBills ?? []).map((b) =>
        b.id === id
          ? {
              ...b,
              lastPaidDate: undefined,
              nextDueDate: b.previousNextDueDate || b.nextDueDate,
              previousNextDueDate: undefined,
            }
          : b
      );

      const updatedBlob = { ...blob, recurringBills: updatedBills };
      await state.savePersonalBlob(updatedBlob);
      set({ recurringBills: updatedBills });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to undo mark as paid',
      });
      throw error;
    }
  },

  processDueBills: async () => {
    try {
      const state = usePersonalStore.getState();
      const blob = state.personalBlob;
      if (!blob || !blob.recurringBills) return [];

      const today = dateOnlyISO(new Date());
      const generated: string[] = [];
      let billsChanged = false;

      const updatedBills: RecurringBill[] = [];
      const newExpenses: Array<{
        amount: number;
        currency: string;
        categoryId: string;
        date: string;
        payee: string | null;
        note: string | null;
        paymentMethod: string | null;
        receiptUri: string | null;
        isRecurring: boolean;
      }> = [];
      const categories = blob.categories ?? [];

      for (const bill of blob.recurringBills) {
        if (!bill.isActive || bill.nextDueDate > today) {
          updatedBills.push(bill);
          continue;
        }

        billsChanged = true;
        const matchingCategory = categories.find(
          (c) => c.name.toLowerCase() === bill.category.toLowerCase()
        );

        const defaultCurrency = useAuthStore.getState().defaultCurrency || 'BDT';

        let cursor = bill.nextDueDate;
        let iterations = 0;
        while (cursor <= today && iterations < 60) {
          newExpenses.push({
            amount: bill.amount,
            currency: bill.currency || defaultCurrency,
            categoryId: matchingCategory?.id ?? bill.category,
            date: cursor,
            payee: bill.name,
            note: `Auto-generated from recurring bill`,
            paymentMethod: null,
            receiptUri: null,
            isRecurring: true,
          });

          generated.push(bill.name);
          cursor = computeNextDueDate(cursor, bill.frequency);
          iterations++;
        }

        updatedBills.push({
          ...bill,
          lastPaidDate: today,
          previousNextDueDate: bill.nextDueDate,
          nextDueDate: cursor,
        });
      }

    if (billsChanged) {
      const currentBlob = usePersonalStore.getState().personalBlob!;
      const mergedExpenses = [...(currentBlob.expenses || []), ...newExpenses.map((e) => ({
        ...e,
        id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))];

      const updatedBlob = { ...currentBlob, expenses: mergedExpenses, recurringBills: updatedBills };
      await usePersonalStore.getState().savePersonalBlob(updatedBlob);
      set({
        recurringBills: updatedBills,
        generatedCount: generated.length,
      });
    }

    return generated;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to process due bills',
      });
      return [];
    }
  },

  clearGeneratedCount: () => set({ generatedCount: 0 }),

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  useRecurringStore.setState({
    recurringBills: [],
    isLoading: false,
    error: null,
    generatedCount: 0,
  });
});
