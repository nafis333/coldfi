import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    const { refreshToken, logout } = useAuthStore.getState();
    try {
      const newToken = await refreshToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(`${API_BASE}${url}`, { ...options, headers, credentials: 'include' });
      }
    } catch {
    }
    await logout();
    throw new Error('Session expired');
  }

  return res;
}
