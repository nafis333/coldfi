import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../authStore';
import { importKey } from '../../lib/crypto';

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
    sessionStorage.clear();
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
    it('should restore the PEK from storage on the fast path (valid stored JWT)', async () => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
      const token = `header.${payload}.sig`;
      localStorage.setItem('coldfi:auth', JSON.stringify({
        accessToken: token,
        userId: 'user-1',
        email: 'test@test.com',
        displayName: '',
        role: 'user',
        isGoogleUser: false,
        personalSalt: 'c2FsdA==',
        encryptedPek: 'ZW5j',
        storedAt: Date.now(),
      }));
      localStorage.setItem('coldfi:pek', 'dGVzdA==');

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.pek).toEqual({} as CryptoKey);
      expect(state.userId).toBe('user-1');
      expect(state.personalSalt).toBe('c2FsdA==');
      expect(state.encryptedPek).toBe('ZW5j');
      expect(state.pekMissing).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should refresh via the cookie when the stored JWT is expired and restore the profile', async () => {
      const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
      const expired = `header.${payload}.sig`;
      localStorage.setItem('coldfi:auth', JSON.stringify({
        accessToken: expired,
        userId: 'user-1',
        email: 'old@test.com',
        isGoogleUser: false,
        storedAt: Date.now() - 60000,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'token-refreshed',
          userId: 'user-1',
          email: 'test@test.com',
          displayName: 'Test',
          role: 'user',
          personalSalt: 'c2FsdA==',
          encryptedPek: 'ZW5j',
          isGoogleUser: false,
        }),
      } as Response);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userId).toBe('user-1');
      expect(state.accessToken).toBe('token-refreshed');
      expect(state.displayName).toBe('Test');
      expect(state.personalSalt).toBe('c2FsdA==');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/refresh'),
        expect.objectContaining({ method: 'POST', credentials: 'include' })
      );
    });
  });

  describe('googleLogin', () => {
    it('should import the server-provided PEK (rawPek) so personal data works', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          accessToken: 'token-google',
          userId: 'user-google',
          email: 'google@test.com',
          displayName: 'Google User',
          role: 'user',
          personalSalt: 'c2FsdA==',
          encryptedPek: 'ZW5j',
          rawPek: 'cmF3LXBlaw==',
        }),
      } as Response);

      await useAuthStore.getState().googleLogin('id-token');

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isGoogleUser).toBe(true);
      expect(state.pek).toEqual({} as CryptoKey);
      expect(state.pekMissing).toBe(false);
      expect(state.personalSalt).toBe('c2FsdA==');
      expect(importKey).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/google'),
        expect.objectContaining({ credentials: 'include' })
      );
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
