import { useAuthStore } from '../stores/authStore';
import { triggerCriticalError } from './errorHandler';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

let refreshPromise: Promise<string | null> | null = null;
let sessionExpired = false;

export function resetSessionExpired(): void {
  sessionExpired = false;
}

// Render free-tier instances sleep after ~15 min idle and cold-boot in 30-60s,
// during which fetch() fails with a network TypeError. Retry idempotent GETs
// with a short backoff so a cold start is transparent instead of surfacing
// as "Failed to fetch". Mutations are NOT retried — a retried POST/PUT/PATCH
// could double-execute; callers implement their own conflict-aware retries.
const RETRYABLE_METHODS = new Set(['GET', 'HEAD']);
const RETRY_DELAYS_MS = [2000, 5000];

async function fetchWithRetry(fullUrl: string, init: RequestInit): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (!RETRYABLE_METHODS.has(method)) {
    return fetch(fullUrl, init);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fetch(fullUrl, init);
    } catch (err) {
      lastErr = err;
      if (attempt >= RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const fullUrl = `${API_BASE}${url}`;

  let res: Response;
  try {
    res = await fetchWithRetry(fullUrl, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    triggerCriticalError(err, fullUrl);
    throw err;
  }

  if (res.status === 401) {
    if (sessionExpired) {
      const err = new Error('Session expired');
      triggerCriticalError(err, 'Authentication session expired');
      throw err;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const { refreshToken } = useAuthStore.getState();
        try {
          return await refreshToken();
        } catch {
          return null;
        }
      })();
    }

    const newToken = await refreshPromise;

    if (newToken) {
      refreshPromise = null;
      headers.set('Authorization', `Bearer ${newToken}`);
      const retried = await fetch(fullUrl, { ...options, headers, credentials: 'include' });
      if (retried.status !== 401) {
        return retried;
      }
      // The retried request was still rejected even with a fresh token —
      // treat it as a dead session instead of a transient failure.
      sessionExpired = true;
      const { logout } = useAuthStore.getState();
      await logout();
      const err = new Error('Session expired');
      triggerCriticalError(err, 'Authentication session expired');
      throw err;
    }

    refreshPromise = null;
    if (useAuthStore.getState().accessToken) {
      // Session was kept alive (backend unreachable, e.g. cold start) — do not
      // log the user out; surface the error so they can retry.
      const err = new Error('Failed to fetch');
      triggerCriticalError(err, `${API_BASE}/api/auth/refresh`);
      throw err;
    }

    sessionExpired = true;
    const { logout } = useAuthStore.getState();
    await logout();
    const err = new Error('Session expired');
    triggerCriticalError(err, 'Authentication session expired');
    throw err;
  }

  if (res.status >= 500) {
    throw new Error(`Server error: ${res.status} ${res.statusText}`);
  }

  return res;
}
