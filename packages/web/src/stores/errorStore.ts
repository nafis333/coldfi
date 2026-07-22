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

export interface CriticalError extends ErrorEntry {
  category: ErrorCategory;
  title: string;
  detail: string;
  action: string;
  retryable: boolean;
}

export type ErrorCategory = 'NetworkError' | 'AuthError' | 'ServerError' | 'ValidationError' | 'CSPError' | 'UnknownError';

interface ErrorState {
  errors: ErrorEntry[];
  criticalError: CriticalError | null;
  isDebugPanelOpen: boolean;
  addError: (entry: Omit<ErrorEntry, 'id'>) => void;
  setCriticalError: (error: CriticalError) => void;
  viewError: (id: string) => void;
  clearCriticalError: () => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  toggleDebugPanel: () => void;
}

export const useErrorStore = create<ErrorState>((set, get) => ({
  errors: [],
  criticalError: null,
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

  setCriticalError: (error) => {
    set({ criticalError: error });
  },

  viewError: (id) => {
    const entry = get().errors.find(e => e.id === id);
    if (!entry) return;
    set({
      criticalError: {
        ...entry,
        category: 'UnknownError',
        title: entry.type,
        detail: entry.message,
        action: 'Review error details above.',
        retryable: true,
      },
    });
    window.location.href = '/error';
  },

  clearCriticalError: () => {
    set({ criticalError: null });
  },

  removeError: (id) => {
    set((state) => ({ errors: state.errors.filter((e) => e.id !== id) }));
  },

  clearErrors: () => set({ errors: [] }),

  toggleDebugPanel: () =>
    set((state) => ({ isDebugPanelOpen: !state.isDebugPanelOpen })),
}));
