import { useAuthStore } from '../stores/authStore';
import { triggerCriticalError } from './errorHandler';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const fullUrl = `${API_BASE}${url}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...options,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    triggerCriticalError(err, fullUrl);
    throw err;
  }

  if (res.status === 401) {
    const { refreshToken, logout } = useAuthStore.getState();
    try {
      const newToken = await refreshToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(fullUrl, { ...options, headers, credentials: 'include' });
      }
    } catch {
    }
    await logout();
    const err = new Error('Session expired');
    triggerCriticalError(err, 'Authentication session expired');
    throw err;
  }

  if (res.status >= 500) {
    const err = new Error(`Server error: ${res.status} ${res.statusText}`);
    triggerCriticalError(err, fullUrl);
    throw err;
  }

  return res;
}
