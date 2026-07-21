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

interface AdminState {
  stats: any | null;
  endpoints: any[];
  errors: any;
  slowQueries: any[];
  dbHealth: any | null;
  redisStats: any | null;
  logs: any;
  errorEvents: any;
  errorDetail: any | null;
  trace: any | null;
  cacheInfo: any | null;
  failedLogins: any;
  suspiciousIPs: any[];
  rateLimitHits: any[];
  securityScore: any | null;
  loading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
  fetchEndpoints: (hours?: number) => Promise<void>;
  fetchErrors: (hours?: number) => Promise<void>;
  fetchSlowQueries: (hours?: number, minDuration?: number) => Promise<void>;
  fetchDbHealth: () => Promise<void>;
  fetchRedisStats: () => Promise<void>;
  fetchLogs: (opts?: any) => Promise<void>;
  fetchErrorEvents: (opts?: any) => Promise<void>;
  fetchErrorDetail: (id: number) => Promise<void>;
  resolveError: (id: number) => Promise<void>;
  fetchTrace: (requestId: string) => Promise<void>;
  inspectCache: (pattern?: string) => Promise<void>;
  clearCache: (pattern?: string) => Promise<void>;
  fetchFailedLogins: (hours?: number) => Promise<void>;
  fetchSuspiciousIPs: (threshold?: number, hours?: number) => Promise<void>;
  fetchRateLimitHits: (hours?: number) => Promise<void>;
  fetchSecurityScore: () => Promise<void>;
  blockIP: (ipAddress: string, reason?: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  endpoints: [],
  errors: null,
  slowQueries: [],
  dbHealth: null,
  redisStats: null,
  logs: null,
  errorEvents: null,
  errorDetail: null,
  trace: null,
  cacheInfo: null,
  failedLogins: null,
  suspiciousIPs: [],
  rateLimitHits: [],
  securityScore: null,
  loading: false,
  error: null,

  fetchStats: async () => {
    try {
      set({ loading: true, error: null });
      const data = await authFetch('/admin/stats');
      set({ stats: data, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchEndpoints: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/monitoring/endpoints?hours=${hours}`);
      set({ endpoints: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchErrors: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/monitoring/errors?hours=${hours}`);
      set({ errors: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSlowQueries: async (hours = 24, minDuration = 500) => {
    try {
      const data = await authFetch(`/admin/monitoring/slow-queries?hours=${hours}&minDuration=${minDuration}`);
      set({ slowQueries: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchDbHealth: async () => {
    try {
      const data = await authFetch('/admin/monitoring/database');
      set({ dbHealth: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchRedisStats: async () => {
    try {
      const data = await authFetch('/admin/monitoring/redis');
      set({ redisStats: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchLogs: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/debug/logs?${params}`);
      set({ logs: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchErrorEvents: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/debug/errors?${params}`);
      set({ errorEvents: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchErrorDetail: async (id: number) => {
    try {
      const data = await authFetch(`/admin/debug/errors/${id}`);
      set({ errorDetail: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  resolveError: async (id: number) => {
    try {
      await authFetch(`/admin/debug/errors/${id}/resolve`, { method: 'POST' });
      await get().fetchErrorEvents();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchTrace: async (requestId: string) => {
    try {
      const data = await authFetch(`/admin/debug/trace/${requestId}`);
      set({ trace: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  inspectCache: async (pattern = '*') => {
    try {
      const data = await authFetch(`/admin/debug/cache?pattern=${encodeURIComponent(pattern)}`);
      set({ cacheInfo: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearCache: async (pattern = '*') => {
    try {
      await authFetch('/admin/debug/cache/clear', { method: 'POST', body: JSON.stringify({ pattern }) });
      await get().inspectCache(pattern);
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchFailedLogins: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/security/failed-logins?hours=${hours}`);
      set({ failedLogins: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSuspiciousIPs: async (threshold = 50, hours = 1) => {
    try {
      const data = await authFetch(`/admin/security/suspicious-ips?threshold=${threshold}&hours=${hours}`);
      set({ suspiciousIPs: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchRateLimitHits: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/security/rate-limit-hits?hours=${hours}`);
      set({ rateLimitHits: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchSecurityScore: async () => {
    try {
      const data = await authFetch('/admin/security/score');
      set({ securityScore: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  blockIP: async (ipAddress: string, reason?: string) => {
    try {
      await authFetch('/admin/security/block-ip', {
        method: 'POST',
        body: JSON.stringify({ ipAddress, reason }),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));

onLogout(() => {
  useAdminStore.setState({
    stats: null,
    endpoints: [],
    errors: null,
    slowQueries: [],
    dbHealth: null,
    redisStats: null,
    logs: null,
    errorEvents: null,
    errorDetail: null,
    trace: null,
    cacheInfo: null,
    failedLogins: null,
    suspiciousIPs: [],
    rateLimitHits: [],
    securityScore: null,
    loading: false,
    error: null,
  });
});
