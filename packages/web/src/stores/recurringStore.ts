import { create } from 'zustand';
import { usePersonalStore, type RecurringBill, type Frequency } from './personalStore';
import { onLogout } from '../lib/resetStores';

interface RecurringState {
  recurringBills: RecurringBill[];
  isLoading: boolean;
  error: string | null;

  fetchRecurringBills: () => Promise<void>;
  createRecurringBill: (data: Omit<RecurringBill, 'id' | 'isActive'>) => Promise<void>;
  updateRecurringBill: (id: string, updates: Partial<RecurringBill>) => Promise<void>;
  toggleRecurringBill: (id: string, isActive: boolean) => Promise<void>;
  clearError: () => void;
}

function generateId(): string {
  return `rb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useRecurringStore = create<RecurringState>((set) => ({
  recurringBills: [],
  isLoading: false,
  error: null,

  fetchRecurringBills: async () => {
    set({ isLoading: true, error: null });

    try {
      const { personalBlob, fetchPersonalBlob } = usePersonalStore.getState();

      if (!personalBlob) {
        await fetchPersonalBlob();
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
      const currentBlob = state.personalBlob!;

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

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  useRecurringStore.setState({
    recurringBills: [],
    isLoading: false,
    error: null,
  });
});
