import { deriveWrappingKey, decryptPEK, importKey, uint8ArrayToBase64 } from './crypto';

export const PEK_STORAGE_KEY = 'coldfi:pek';
export const AUTH_STORAGE_KEY = 'coldfi:auth';
export const LAST_ACTIVITY_KEY = 'coldfi:lastActivity';

export function storage(): Storage {
  try {
    return sessionStorage;
  } catch {
    return localStorage;
  }
}

export function getJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveAuthToStorage(data: { accessToken: string; userId: string; email?: string; displayName?: string; role?: string; isGoogleUser?: boolean }) {
  try {
    storage().setItem(AUTH_STORAGE_KEY, JSON.stringify({
      accessToken: data.accessToken,
      userId: data.userId,
      email: data.email || '',
      displayName: data.displayName || '',
      role: data.role || 'user',
      isGoogleUser: !!data.isGoogleUser,
      storedAt: Date.now(),
    }));
  } catch { /* quota exceeded, ignore */ }
}

export function clearAuthStorage() {
  try { storage().removeItem(AUTH_STORAGE_KEY); } catch {}
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
}

export async function deriveAndStorePek(passphrase: string, personalSalt: string, encryptedPek: string): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(passphrase, personalSalt);
  const pekBytes = await decryptPEK(encryptedPek, wrappingKey);
  const pek = await importKey(pekBytes);
  try { storage().setItem(PEK_STORAGE_KEY, uint8ArrayToBase64(pekBytes)); } catch {}
  return pek;
}

export function storePekBytes(pekBytes: Uint8Array) {
  try { storage().setItem(PEK_STORAGE_KEY, uint8ArrayToBase64(pekBytes)); } catch {}
}

export function clearPekStorage() {
  try { storage().removeItem(PEK_STORAGE_KEY); } catch {}
  try { localStorage.removeItem(PEK_STORAGE_KEY); } catch {}
}