import { create } from 'zustand';

const MAX_ERRORS = 200;

export interface ErrorEntry {
  id: string;
  type: string;
  message: string;
  stack: string;
  componentStack?: string;
  timestamp: string;
}

interface ErrorState {
  errors: ErrorEntry[];
  isDebugPanelOpen: boolean;
  addError: (entry: Omit<ErrorEntry, 'id'>) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  toggleDebugPanel: () => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  errors: [],
  isDebugPanelOpen: false,

  addError: (entry) => {
    set((state) => ({
      errors: [
        {
          ...entry,
          id: crypto.randomUUID(),
        },
        ...state.errors,
      ].slice(0, MAX_ERRORS),
    }));
  },

  removeError: (id) => {
    set((state) => ({ errors: state.errors.filter((e) => e.id !== id) }));
  },

  clearErrors: () => set({ errors: [] }),

  toggleDebugPanel: () =>
    set((state) => ({ isDebugPanelOpen: !state.isDebugPanelOpen })),
}));
