import { create } from 'zustand';
import { importKey, exportKey, uint8ArrayToBase64, base64ToUint8Array, deriveWrappingKey, encryptPEK, generateSalt, computeAuthKeyHash } from '../lib/crypto';
import { broadcastLogin, broadcastLogout } from '../lib/tabSync';
import { resetAllStores } from '../lib/resetStores';
import { PEK_STORAGE_KEY, AUTH_STORAGE_KEY, LAST_ACTIVITY_KEY, getJwtExpiry, saveAuthToStorage, clearAuthStorage, storage, storePekBytes, clearPekStorage, deriveAndStorePek } from '../lib/authPersistence';
import { triggerCriticalError, silentCatch } from '../lib/errorHandler';
import { resetSessionExpired } from '../lib/apiClient';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface AuthState {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  accessToken: string | null;
  pek: CryptoKey | null;
  personalSalt: string | null;
  encryptedPek: string | null;
  role: string | null;
  tempToken: string | null;
  defaultCurrency: string;
  timezone: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  pekMissing: boolean;
  pekErrorMessage: string | null;
  error: string | null;
  isGoogleUser: boolean;

  login: (email: string, passphrase: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  verify2FA: (code: string, passphrase: string) => Promise<void>;
  register: (email: string, displayName: string, passphrase: string) => Promise<string | undefined>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshToken: () => Promise<string>;
  updateProfile: (data: { displayName?: string; defaultCurrency?: string; timezone?: string }) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  setPek: (pek: CryptoKey) => void;
  derivePek: (passphrase: string) => Promise<void>;
  resolvePekMissing: (passphrase: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isGoogleUser: false,
  userId: null,
  email: null,
  displayName: null,
  accessToken: null,
  pek: null,
  personalSalt: null,
  encryptedPek: null,
  role: null,
  tempToken: null,
  defaultCurrency: 'BDT',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
          throw new Error(data.message || data.error || 'Login failed');
        }

        const data = await res.json();

        if (data.requires2FA) {
          set({
            userId: data.userId,
            personalSalt: data.personalSalt,
            tempToken: data.tempToken,
            email,
            isLoading: false,
            isInitialized: true,
          });
          throw new Error('2FA_REQUIRED');
        }

        const { accessToken, userId, displayName, personalSalt, encryptedPek, role } = data;
        const pek = await deriveAndStorePek(passphrase, personalSalt, encryptedPek);
        saveAuthToStorage({ accessToken, userId, email, displayName, role: role || 'user', isGoogleUser: false });

        set({
          userId,
          email,
          displayName: displayName || null,
          accessToken,
          pek,
          personalSalt,
          encryptedPek,
          role: role || 'user',
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
          pekMissing: false,
          isGoogleUser: false,
        });

        broadcastLogin(userId);
        resetSessionExpired();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Login failed';
        if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
          triggerCriticalError(error, `${API_BASE}/api/auth/login`);
        }
        if (msg !== '2FA_REQUIRED') {
          set({ isLoading: false, isInitialized: true, error: msg });
        }
        throw error;
      }
    },

  googleLogin: async (idToken: string) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Google login failed');
      }

      const data = await res.json();
      const { accessToken, userId, displayName, email, rawPek, personalSalt, encryptedPek } = data;
      let pek: CryptoKey | null = null;
      if (rawPek) {
        try {
          pek = await importKey(base64ToUint8Array(rawPek));
          storePekBytes(base64ToUint8Array(rawPek));
        } catch {
          silentCatch('authStore.googleLogin.importRawPek');
        }
      }
      saveAuthToStorage({ accessToken, userId, email, displayName, role: data.role, isGoogleUser: true });

      set({
        userId,
        email: email || '',
        displayName: displayName || null,
        accessToken,
        pek,
        personalSalt: personalSalt || null,
        encryptedPek: encryptedPek || null,
        role: data.role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pekMissing: !!(personalSalt && !pek),
        isGoogleUser: true,
      });

      broadcastLogin(userId);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Google login failed';
        if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
          triggerCriticalError(error, `${API_BASE}/api/auth/google`);
        }
        set({ isLoading: false, isInitialized: true, error: msg });
        throw error;
      }
    },

  verify2FA: async (code: string, passphrase: string) => {
    set({ isLoading: true, error: null });

    try {
      const { tempToken, email, personalSalt } = get();
      if (!tempToken) throw new Error('No 2FA session. Please log in again.');

      const res = await fetch(`${API_BASE}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tempToken, code }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Invalid 2FA code');
      }

      const data = await res.json();
      const { accessToken, userId, displayName, encryptedPek, role } = data;
      const pek = await deriveAndStorePek(passphrase, personalSalt!, encryptedPek);
      saveAuthToStorage({ accessToken, userId, email: email || '', displayName, role, isGoogleUser: false });

      set({
        userId,
        email: email || '',
        displayName: displayName || null,
        accessToken,
        encryptedPek,
        role: role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pek,
        pekMissing: false,
        isGoogleUser: false,
      });

      broadcastLogin(userId);
    } catch (error) {
        const msg = error instanceof Error ? error.message : '2FA verification failed';
        if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
          triggerCriticalError(error, `${API_BASE}/api/auth/2fa/verify`);
        }
        set({ isLoading: false, isInitialized: true, error: msg });
        throw error;
      }
    },

  register: async (email: string, displayName: string, passphrase: string) => {
    set({ isLoading: true, error: null });

    try {
      const authKeyHash = await computeAuthKeyHash(passphrase, email);
      const personalSaltBytes = generateSalt();
      const personalSalt = uint8ArrayToBase64(personalSaltBytes);
      const pekBytes = generateSalt();
      const wrappingKey = await deriveWrappingKey(passphrase, personalSalt);
      const encryptedPek = await encryptPEK(pekBytes, wrappingKey);

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, displayName, authKeyHash, personalSalt, encryptedPek }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || 'Registration failed');
      }

      const data = await res.json();
      const { accessToken, userId, role, recoveryCode } = data;
      const pek = await importKey(pekBytes);

      storePekBytes(pekBytes);
      saveAuthToStorage({ accessToken, userId, email, displayName, role, isGoogleUser: false });

      set({
        userId,
        email,
        displayName,
        accessToken,
        pek,
        personalSalt,
        encryptedPek,
        role: role || 'user',
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
        pekMissing: false,
      });

      return recoveryCode as string | undefined;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Registration failed';
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        triggerCriticalError(error, `${API_BASE}/api/auth/register`);
      }
      set({ isLoading: false, isInitialized: true, error: msg });
      throw error;
    }
  },

  logout: (() => {
    let isLoggingOut = false;
    return async () => {
      if (isLoggingOut) return;
      isLoggingOut = true;
      try {
        const { accessToken } = get();

        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (err) {
        silentCatch('authStore.logout', err);
      }

      resetAllStores();
      clearPekStorage();
      clearAuthStorage();
      storage().removeItem(LAST_ACTIVITY_KEY);
      set({
        userId: null,
        email: null,
        displayName: null,
        accessToken: null,
        pek: null,
        personalSalt: null,
        encryptedPek: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        pekMissing: false,
        pekErrorMessage: null,
        error: null,
      });

      broadcastLogout();
    };
  })(),

  initialize: async () => {
    if (get().isInitialized) return;
    const lastActivity = storage().getItem(LAST_ACTIVITY_KEY) || localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const elapsed = Date.now() - Number(lastActivity);
      if (elapsed > 30 * 24 * 60 * 60 * 1000) {
        try { localStorage.removeItem(LAST_ACTIVITY_KEY); } catch (err) { silentCatch('authStore.initialize.removeLastActivity', err); }
        storage().removeItem(LAST_ACTIVITY_KEY);
        storage().removeItem(AUTH_STORAGE_KEY);
        set({ isInitialized: true });
        return;
      }
    }

    const stored = storage().getItem(AUTH_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const expiry = getJwtExpiry(parsed.accessToken);
        if (expiry && expiry > Date.now() && parsed.userId) {
          let pek: CryptoKey | null = null;
          const storedPek = storage().getItem(PEK_STORAGE_KEY);
          if (storedPek) {
            try {
              pek = await importKey(base64ToUint8Array(storedPek));
            } catch {
              silentCatch('authStore.initialize.importStoredPek');
              storage().removeItem(PEK_STORAGE_KEY);
            }
          }
          set({
            userId: parsed.userId,
            email: parsed.email || null,
            displayName: parsed.displayName || null,
            accessToken: parsed.accessToken,
            role: parsed.role || 'user',
            isAuthenticated: true,
            isInitialized: true,
            pek,
            personalSalt: null,
            encryptedPek: null,
            pekMissing: false,
            isGoogleUser: !!parsed.isGoogleUser,
          });
          return;
        }
      } catch {
        storage().removeItem(AUTH_STORAGE_KEY);
      }
    }

    try {
      let res: Response | null = null;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < 3) { await new Promise((r) => setTimeout(r, 800 * attempt)); continue; }
          throw lastError;
        }
        if (res.ok) break;
        if (res.status === 401) throw new Error(`Refresh failed: ${res.status}`);
        if (attempt < 3) { await new Promise((r) => setTimeout(r, 800 * attempt)); continue; }
        throw new Error(`Refresh failed: ${res.status}`);
      }

      if (!res || !res.ok) {
        set({ isInitialized: true });
        return;
      }

      const data = await res.json();
      const { accessToken, userId, email, displayName, personalSalt, encryptedPek, role, isGoogleUser, rawPek } = data;

      let pek: CryptoKey | null = null;
      const storedPek = storage().getItem(PEK_STORAGE_KEY);
      if (storedPek) {
        try {
          pek = await importKey(base64ToUint8Array(storedPek));
        } catch {
          silentCatch('authStore.initialize.importStoredPek');
          storage().removeItem(PEK_STORAGE_KEY);
        }
      }
      if (!pek && rawPek) {
        try {
          pek = await importKey(base64ToUint8Array(rawPek));
          storePekBytes(base64ToUint8Array(rawPek));
        } catch {
          silentCatch('authStore.initialize.importRawPek');
        }
      }

      saveAuthToStorage({ accessToken, userId, email, displayName, role, isGoogleUser });

      set({
        userId,
        email,
        displayName,
        accessToken,
        personalSalt,
        encryptedPek,
        pek,
        role: role || 'user',
        isAuthenticated: true,
        isInitialized: true,
        pekMissing: !!(personalSalt && !pek && !isGoogleUser),
        isGoogleUser: !!isGoogleUser,
      });
    } catch (err) {
      silentCatch('authStore.initialize.refresh', err);
      set({ isInitialized: true });
    }
  },

  setPek: async (pek: CryptoKey) => {
    const pekBytes = await exportKey(pek);
    storePekBytes(pekBytes);
    set({ pek, pekMissing: false, pekErrorMessage: null });
  },

  derivePek: async (passphrase: string) => {
    const { personalSalt, encryptedPek } = get();
    if (!personalSalt || !encryptedPek) throw new Error('No PEK data available. Please log in again.');
    const pek = await deriveAndStorePek(passphrase, personalSalt, encryptedPek);
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

  refreshToken: (() => {
    let pending: Promise<string> | null = null;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    return async () => {
      if (pending) return pending;

      const currentToken = get().accessToken;
      const stored = storage().getItem(AUTH_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const expiry = getJwtExpiry(parsed.accessToken);
          if (expiry && expiry > Date.now() && parsed.accessToken !== currentToken) {
            set({ accessToken: parsed.accessToken });
            return parsed.accessToken;
          }
        } catch (err) { silentCatch('authStore.refreshToken.parseStored', err); }
      }

      pending = (async () => {
        // Transient failures (cold start, brief blips, refresh races between
        // tabs) must NOT log the user out — retry before giving up.
        const MAX_ATTEMPTS = 3;
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          let res: Response;
          try {
            res = await fetch(`${API_BASE}/api/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
            });
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < MAX_ATTEMPTS) { await sleep(800 * attempt); continue; }
            break;
          }

          if (res.ok) {
            const data = await res.json();
            const { accessToken, userId, email, displayName, role, isGoogleUser } = data;
            if (userId) {
              saveAuthToStorage({ accessToken, userId, email, displayName, role, isGoogleUser });
            }
            set({ accessToken: data.accessToken, isAuthenticated: true });
            return data.accessToken as string;
          }

          const reuseError = res.status === 401
            && (await res.json().catch(() => ({}))).error === 'ERR_TOKEN_REUSED';

          if (reuseError) {
            // Another tab rotated the token — wait for its Set-Cookie to land,
            // then retry with the fresh cookie.
            if (attempt < MAX_ATTEMPTS) { await sleep(600 * attempt); continue; }
            lastError = new Error('Refresh token reused');
            break;
          }

          if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
            await sleep(800 * attempt);
            continue;
          }

          lastError = new Error(`Token refresh failed: ${res.status}`);
          break;
        }

        const stored = storage().getItem(AUTH_STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const expiry = getJwtExpiry(parsed.accessToken);
            if (expiry && expiry > Date.now() && parsed.accessToken !== get().accessToken) {
              set({ accessToken: parsed.accessToken, isAuthenticated: true });
              return parsed.accessToken;
            }
          } catch (err) { silentCatch('authStore.refreshToken.parseStoredFallback', err); }
        }
        if (lastError?.message === 'Refresh token reused') {
          clearAuthStorage();
          set({ isAuthenticated: false, accessToken: null });
          throw lastError;
        }
        const isNetworkFailure = !lastError || lastError.message.startsWith('Failed to fetch')
          || lastError.message.includes('NetworkError') || lastError.message.includes('fetch');
        if (isNetworkFailure) {
          // Backend unreachable (e.g., cold start) — keep the session intact;
          // a later request will retry refresh successfully.
          throw new Error('Failed to fetch during token refresh. The server may be starting up.');
        }
        clearAuthStorage();
        set({ isAuthenticated: false, accessToken: null });
        throw lastError || new Error('Token refresh failed');
      })();
      try {
        return await pending;
      } finally {
        pending = null;
      }
    };
  })(),

  clearError: () => set({ error: null }),

  updateProfile: async (data: { displayName?: string; defaultCurrency?: string; timezone?: string }) => {
    try {
      set({ isLoading: true, error: null });
      const { accessToken } = get();
      if (!accessToken) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update profile');
      }

      const result = await res.json();
      set({
        displayName: result.displayName ?? get().displayName,
        defaultCurrency: result.defaultCurrency ?? get().defaultCurrency,
        timezone: result.timezone ?? get().timezone,
        isLoading: false,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update profile';
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        triggerCriticalError(error, `${API_BASE}/api/auth/profile`);
      }
      set({ isLoading: false, error: msg });
      throw error;
    }
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      const { accessToken, email, pek } = get();
      if (!accessToken || !email) throw new Error('Not authenticated');
      if (!pek) throw new Error('No encryption key loaded');

      const oldAuthKeyHash = await computeAuthKeyHash(oldPassword, email);
      const newAuthKeyHash = await computeAuthKeyHash(newPassword, email);
      const personalSaltBytes = generateSalt();
      const personalSalt = uint8ArrayToBase64(personalSaltBytes);
      const pekBytes = await exportKey(pek);
      const wrappingKey = await deriveWrappingKey(newPassword, personalSalt);
      const encryptedPek = await encryptPEK(pekBytes, wrappingKey);

      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ oldAuthKeyHash, newAuthKeyHash, personalSalt, encryptedPek }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to change password');
      }

      set({
        personalSalt,
        encryptedPek,
        isLoading: false,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to change password';
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
        triggerCriticalError(error, `${API_BASE}/api/auth/change-password`);
      }
      set({ isLoading: false, error: msg });
      throw error;
    }
  },
}));
