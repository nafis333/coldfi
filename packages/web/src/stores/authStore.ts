import { create } from 'zustand';
import { deriveKey, deriveAuthKey, uint8ArrayToHex } from '../lib/crypto';
import { broadcastLogin, broadcastLogout } from '../lib/tabSync';
import { resetAllStores } from '../lib/resetStores';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function computeAuthKeyHash(passphrase: string, email: string): Promise<string> {
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase().trim())));
  const keyBytes = await deriveAuthKey(passphrase, salt);
  return uint8ArrayToHex(keyBytes);
}

interface AuthState {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  accessToken: string | null;
  pek: CryptoKey | null;
  personalSalt: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  pekMissing: boolean;
  pekErrorMessage: string | null;
  error: string | null;

  login: (email: string, passphrase: string) => Promise<void>;
  register: (email: string, displayName: string, passphrase: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshToken: () => Promise<string>;
  updateProfile: (data: { name?: string; email?: string; currency?: string }) => Promise<void>;
  clearError: () => void;
  setPek: (pek: CryptoKey) => void;
  derivePek: (passphrase: string) => Promise<void>;
  resolvePekMissing: (passphrase: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  userId: null,
  email: null,
  displayName: null,
  accessToken: null,
  pek: null,
  personalSalt: null,
  role: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  pekMissing: false,
  pekErrorMessage: null,
  error: null,

  login: async (email: string, passphrase: string) => {
    set({ isLoading: true, error: null });

    try {
      const authKeyHash = await computeAuthKeyHash(passphrase, email);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, authKeyHash }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }

      const data = await res.json();

      if (data.requires2FA) {
        set({
          userId: data.userId,
          personalSalt: data.personalSalt,
          isLoading: false,
          isInitialized: true,
          pekMissing: true,
        });
        throw new Error('2FA_REQUIRED');
      }

      const { accessToken, userId, displayName, personalSalt, role } = data;
      const pek = await deriveKey(passphrase, personalSalt);

      set({
        userId,
        email,
        displayName: displayName || null,
        accessToken,
        pek,
        personalSalt,
        role: role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pekMissing: false,
      });

      broadcastLogin(userId);
    } catch (error) {
      set({
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    }
  },

  register: async (email: string, displayName: string, passphrase: string) => {
    set({ isLoading: true, error: null });

    try {
      const authKeyHash = await computeAuthKeyHash(passphrase, email);
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, displayName, authKeyHash }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }

      const data = await res.json();
      const { accessToken, userId, personalSalt, role } = data;
      const pek = await deriveKey(passphrase, personalSalt);

      set({
        userId,
        email,
        displayName,
        accessToken,
        pek,
        personalSalt,
        role: role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pekMissing: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        isInitialized: true,
        error: error instanceof Error ? error.message : 'Registration failed',
      });
      throw error;
    }
  },

  logout: async () => {
    const { accessToken } = get();

    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch {
      // Non-critical — server will expire the cookie
    }

    resetAllStores();
    set({
      userId: null,
      email: null,
      displayName: null,
      accessToken: null,
      pek: null,
      personalSalt: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      pekMissing: false,
      pekErrorMessage: null,
      error: null,
    });

    broadcastLogout();
  },

  initialize: async () => {
    set({ isLoading: true });

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        set({ isLoading: false, isInitialized: true });
        return;
      }

      const data = await res.json();
      const { accessToken, userId, email, displayName, personalSalt, role } = data;

      const hasPek = get().pek !== null;

      set({
        userId,
        email,
        displayName,
        accessToken,
        personalSalt,
        role: role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pekMissing: !hasPek && !!personalSalt,
      });
    } catch {
      set({ isLoading: false, isInitialized: true });
    }
  },

  setPek: (pek: CryptoKey) => set({ pek, pekMissing: false, pekErrorMessage: null }),

  derivePek: async (passphrase: string) => {
    const { personalSalt } = get();
    if (!personalSalt) throw new Error('No personal salt available. Please log in again.');
    const pek = await deriveKey(passphrase, personalSalt);
    set({ pek, pekMissing: false, pekErrorMessage: null });
  },

  resolvePekMissing: async (passphrase: string) => {
    try {
      await get().derivePek(passphrase);
    } catch {
      set({ pekErrorMessage: 'Incorrect passphrase. Please try again.' });
      throw new Error('PEK restoration failed');
    }
  },

  refreshToken: async () => {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      set({
        isAuthenticated: false,
        accessToken: null,
      });
      throw new Error('Token refresh failed');
    }

    const data = await res.json();
    set({ accessToken: data.accessToken });
    return data.accessToken;
  },

  clearError: () => set({ error: null }),

  updateProfile: async (data: { name?: string; email?: string; currency?: string }) => {
    set({
      displayName: data.name ?? get().displayName,
      email: data.email ?? get().email,
    });
  },
}));
