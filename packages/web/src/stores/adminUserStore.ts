import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { onLogout } from '../lib/resetStores';

async function authFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await apiClient(`/api${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

interface AdminUserState {
  users: any;
  userDetail: any | null;
  userActivity: any;
  loading: boolean;
  error: string | null;

  fetchUsers: (opts?: { page?: number; limit?: number; status?: string; search?: string }) => Promise<void>;
  fetchUserDetail: (userId: string) => Promise<void>;
  fetchUserActivity: (userId: string, page?: number) => Promise<void>;
  forceLogout: (userId: string) => Promise<void>;
  suspendUser: (userId: string, reason: string, durationHours?: number) => Promise<void>;
  banUser: (userId: string, reason: string) => Promise<void>;
  restoreUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

export const useAdminUserStore = create<AdminUserState>((set, get) => ({
  users: null,
  userDetail: null,
  userActivity: null,
  loading: false,
  error: null,

  fetchUsers: async (opts = {}) => {
    const { page = 1, limit = 50, status, search } = opts as any;
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    try {
      const data = await authFetch(`/admin/users?${params}`);
      set({ users: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchUserDetail: async (userId: string) => {
    try {
      const data = await authFetch(`/admin/users/${userId}`);
      set({ userDetail: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchUserActivity: async (userId: string, page = 1) => {
    try {
      const data = await authFetch(`/admin/users/${userId}/activity?page=${page}`);
      set({ userActivity: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  forceLogout: async (userId: string) => {
    try {
      await authFetch(`/admin/users/${userId}/force-logout`, { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  suspendUser: async (userId: string, reason: string, durationHours?: number) => {
    try {
      await authFetch(`/admin/users/${userId}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason, durationHours }),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  banUser: async (userId: string, reason: string) => {
    try {
      await authFetch(`/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  restoreUser: async (userId: string) => {
    try {
      await authFetch(`/admin/users/${userId}/restore`, { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteUser: async (userId: string) => {
    try {
      await authFetch(`/admin/users/${userId}/delete`, { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));

onLogout(() => {
  useAdminUserStore.setState({
    users: null,
    userDetail: null,
    userActivity: null,
    loading: false,
    error: null,
  });
});
