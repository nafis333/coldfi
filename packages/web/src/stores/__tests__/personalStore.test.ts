import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePersonalStore } from '../personalStore';

vi.mock('../authStore', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      pek: {} as CryptoKey,
      accessToken: 'test-token',
      userId: 'user-1',
    })),
  },
}));

vi.mock('../../lib/crypto', () => ({
  encryptData: vi.fn().mockResolvedValue('encrypted-blob'),
  decryptData: vi.fn().mockImplementation(async (_key: CryptoKey, data: string) => {
    if (data === 'invalid') throw new Error('Decryption failed');
    return JSON.stringify({
      expenses: [],
      budgets: [],
      categories: [
        { id: 'cat-1', name: 'Food', icon: '🍕', color: '#ff0000' },
      ],
    });
  }),
}));

vi.mock('../../lib/resetStores', () => ({
  onLogout: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('personalStore', () => {
  beforeEach(() => {
    usePersonalStore.setState({
      expenses: [],
      budgets: [],
      categories: [],
      budgetStatuses: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with empty data', () => {
      const state = usePersonalStore.getState();
      expect(state.expenses).toEqual([]);
      expect(state.budgets).toEqual([]);
      expect(state.categories).toEqual([]);
      expect(state.budgetStatuses).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('data fetching', () => {
    it('should load personal data successfully', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ encryptedBlob: 'enc-data', vectorClock: 1, updatedAt: '2024-01-01' }),
        } as Response);

      await usePersonalStore.getState().fetchPersonalBlob();

      const state = usePersonalStore.getState();
      expect(state.categories).toHaveLength(1);
      expect(state.categories[0]!.name).toBe('Food');
      expect(state.isLoading).toBe(false);
    });

    it('should handle API error gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'ERR_AUTH', message: 'Unauthorized' }),
      } as Response);

      await usePersonalStore.getState().fetchPersonalBlob();

      const state = usePersonalStore.getState();
      expect(state.expenses).toEqual([]);
      expect(state.error).toBeDefined();
    });
  });
});
