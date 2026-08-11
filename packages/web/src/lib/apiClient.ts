import { useAuthStore } from '../stores/authStore';
import { triggerCriticalError } from './errorHandler';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

let refreshPromise: Promise<string | null> | null = null;
let sessionExpired = false;

export function resetSessionExpired(): void {
  sessionExpired = false;
}

// Render free-tier instances sleep after ~15 min idle and cold-boot in 30-60s,
// during which fetch() fails with a network TypeError. Retry idempotent
// requests with backoff so a cold start is transparent instead of surfacing
// as "Failed to fetch". POST is excluded — a retried POST could double-execute.
const RETRYABLE_METHODS = new Set(['GET', 'PUT', 'PATCH', 'DELETE']);

async function fetchWithRetry(fullUrl: string, init: RequestInit): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  if (!RETRYABLE_METHODS.has(method)) {
    return fetch(fullUrl, init);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      return await fetch(fullUrl, init);
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 15000 * (attempt + 1)));
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
      return fetch(fullUrl, { ...options, headers, credentials: 'include' });
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
