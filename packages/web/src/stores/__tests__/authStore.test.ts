import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';

vi.mock('../../lib/crypto', () => ({
  deriveAuthKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  uint8ArrayToHex: vi.fn().mockReturnValue('a'.repeat(64)),
  importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  exportKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  uint8ArrayToBase64: vi.fn().mockReturnValue('dGVzdA=='),
  base64ToUint8Array: vi.fn().mockReturnValue(new Uint8Array(32)),
  deriveWrappingKey: vi.fn().mockResolvedValue({} as CryptoKey),
  encryptPEK: vi.fn().mockResolvedValue('encrypted-pek'),
  decryptPEK: vi.fn().mockResolvedValue(new Uint8Array(32)),
  generateSalt: vi.fn().mockReturnValue(new Uint8Array(32)),
}));

vi.mock('../../lib/tabSync', () => ({
  broadcastLogin: vi.fn(),
  broadcastLogout: vi.fn(),
}));

vi.mock('../../lib/resetStores', () => ({
  resetAllStores: vi.fn(),
  onLogout: vi.fn(),
}));

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      userId: null,
      email: null,
      displayName: null,
      accessToken: null,
      pek: null,
      personalSalt: null,
      role: null,
      tempToken: null,
      defaultCurrency: 'BDT',
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      pekMissing: false,
      pekErrorMessage: null,
      error: null,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('should start with correct defaults', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.isInitialized).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.defaultCurrency).toBe('BDT');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useAuthStore.setState({ error: 'Something went wrong' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should restore the PEK from sessionStorage on the fast path (valid stored JWT)', async () => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `header.${payload}.sig`;
      sessionStorage.setItem('coldfi:auth', JSON.stringify({
        accessToken: token,
        userId: 'user-1',
        email: 'test@test.com',
        displayName: '',
        role: 'user',
        isGoogleUser: false,
        storedAt: Date.now(),
      }));
      sessionStorage.setItem('coldfi:pek', 'dGVzdA==');

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().pek).toEqual({} as CryptoKey);
      expect(useAuthStore.getState().userId).toBe('user-1');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should reset all auth state on logout', async () => {
      useAuthStore.setState({
        userId: 'user-1',
        email: 'test@test.com',
        accessToken: 'token-123',
        isAuthenticated: true,
      });

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.email).toBeNull();
      expect(state.accessToken).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should throw when not authenticated', async () => {
      await expect(
        useAuthStore.getState().updateProfile({ displayName: 'New Name' })
      ).rejects.toThrow('Not authenticated');
    });

    it('should update display name', async () => {
      useAuthStore.setState({ accessToken: 'token-1' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ displayName: 'Updated', defaultCurrency: 'USD', timezone: 'UTC' }),
      } as Response);

      await useAuthStore.getState().updateProfile({ displayName: 'Updated' });

      expect(useAuthStore.getState().displayName).toBe('Updated');
    });
  });
});
