import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { onLogout } from '../lib/resetStores';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function authFetch<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE}/api${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface AdminState {
  stats: any | null;
  endpoints: any[];
  errors: any;
  slowQueries: any[];
  dbHealth: any | null;
  redisStats: any | null;
  users: any;
  userDetail: any | null;
  userActivity: any;
  logs: any;
  errorEvents: any;
  errorDetail: any | null;
  trace: any | null;
  cacheInfo: any | null;
  failedLogins: any;
  suspiciousIPs: any[];
  rateLimitHits: any[];
  securityScore: any | null;
  alertRules: any[];
  alertHistory: any;
  configItems: any[];
  configHistory: any[];
  auditLog: any;
  health: any | null;
  healthHistory: any[];
  jobs: any | null;
  loading: boolean;
  error: string | null;

  fetchStats: () => Promise<void>;
  fetchEndpoints: (hours?: number) => Promise<void>;
  fetchErrors: (hours?: number) => Promise<void>;
  fetchSlowQueries: (hours?: number, minDuration?: number) => Promise<void>;
  fetchDbHealth: () => Promise<void>;
  fetchRedisStats: () => Promise<void>;
  fetchUsers: (opts?: { page?: number; limit?: number; status?: string; search?: string }) => Promise<void>;
  fetchUserDetail: (userId: string) => Promise<void>;
  fetchUserActivity: (userId: string, page?: number) => Promise<void>;
  fetchLogs: (opts?: any) => Promise<void>;
  fetchErrorEvents: (opts?: any) => Promise<void>;
  fetchErrorDetail: (id: number) => Promise<void>;
  resolveError: (id: number) => Promise<void>;
  fetchTrace: (requestId: string) => Promise<void>;
  inspectCache: (pattern?: string) => Promise<void>;
  clearCache: (pattern?: string) => Promise<void>;
  forceLogout: (userId: string) => Promise<void>;
  suspendUser: (userId: string, reason: string, durationHours?: number) => Promise<void>;
  banUser: (userId: string, reason: string) => Promise<void>;
  restoreUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  fetchFailedLogins: (hours?: number) => Promise<void>;
  fetchSuspiciousIPs: (threshold?: number, hours?: number) => Promise<void>;
  fetchRateLimitHits: (hours?: number) => Promise<void>;
  fetchSecurityScore: () => Promise<void>;
  blockIP: (ipAddress: string, reason?: string) => Promise<void>;
  fetchAlertRules: () => Promise<void>;
  createAlertRule: (rule: any) => Promise<void>;
  updateAlertRule: (id: string, updates: any) => Promise<void>;
  deleteAlertRule: (id: string) => Promise<void>;
  fetchAlertHistory: (opts?: any) => Promise<void>;
  acknowledgeAlert: (id: number) => Promise<void>;
  testAlertRule: (id: string) => Promise<any>;
  evaluateAlerts: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  updateConfig: (key: string, value: any, description?: string) => Promise<void>;
  fetchConfigHistory: (key?: string) => Promise<void>;
  toggleMaintenance: (enabled: boolean, message?: string) => Promise<void>;
  fetchAuditLog: (opts?: any) => Promise<void>;
  fetchHealth: () => Promise<void>;
  fetchHealthHistory: (hours?: number) => Promise<void>;
  fetchJobs: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  stats: null,
  endpoints: [],
  errors: null,
  slowQueries: [],
  dbHealth: null,
  redisStats: null,
  users: null,
  userDetail: null,
  userActivity: null,
  logs: null,
  errorEvents: null,
  errorDetail: null,
  trace: null,
  cacheInfo: null,
  failedLogins: null,
  suspiciousIPs: [],
  rateLimitHits: [],
  securityScore: null,
  alertRules: [],
  alertHistory: null,
  configItems: [],
  configHistory: [],
  auditLog: null,
  health: null,
  healthHistory: [],
  jobs: null,
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
      console.error('fetchEndpoints failed:', err.message);
    }
  },

  fetchErrors: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/monitoring/errors?hours=${hours}`);
      set({ errors: data });
    } catch (err: any) {
      console.error('fetchErrors failed:', err.message);
    }
  },

  fetchSlowQueries: async (hours = 24, minDuration = 500) => {
    try {
      const data = await authFetch(`/admin/monitoring/slow-queries?hours=${hours}&minDuration=${minDuration}`);
      set({ slowQueries: data });
    } catch (err: any) {
      console.error('fetchSlowQueries failed:', err.message);
    }
  },

  fetchDbHealth: async () => {
    try {
      const data = await authFetch('/admin/monitoring/database');
      set({ dbHealth: data });
    } catch (err: any) {
      console.error('fetchDbHealth failed:', err.message);
    }
  },

  fetchRedisStats: async () => {
    try {
      const data = await authFetch('/admin/monitoring/redis');
      set({ redisStats: data });
    } catch (err: any) {
      console.error('fetchRedisStats failed:', err.message);
    }
  },

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
      console.error('fetchUserDetail failed:', err.message);
    }
  },

  fetchUserActivity: async (userId: string, page = 1) => {
    try {
      const data = await authFetch(`/admin/users/${userId}/activity?page=${page}`);
      set({ userActivity: data });
    } catch (err: any) {
      console.error('fetchUserActivity failed:', err.message);
    }
  },

  fetchLogs: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/debug/logs?${params}`);
      set({ logs: data });
    } catch (err: any) {
      console.error('fetchLogs failed:', err.message);
    }
  },

  fetchErrorEvents: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/debug/errors?${params}`);
      set({ errorEvents: data });
    } catch (err: any) {
      console.error('fetchErrorEvents failed:', err.message);
    }
  },

  fetchErrorDetail: async (id: number) => {
    try {
      const data = await authFetch(`/admin/debug/errors/${id}`);
      set({ errorDetail: data });
    } catch (err: any) {
      console.error('fetchErrorDetail failed:', err.message);
    }
  },

  resolveError: async (id: number) => {
    await authFetch(`/admin/debug/errors/${id}/resolve`, { method: 'POST' });
    await get().fetchErrorEvents();
  },

  fetchTrace: async (requestId: string) => {
    try {
      const data = await authFetch(`/admin/debug/trace/${requestId}`);
      set({ trace: data });
    } catch (err: any) {
      console.error('fetchTrace failed:', err.message);
    }
  },

  inspectCache: async (pattern = '*') => {
    try {
      const data = await authFetch(`/admin/debug/cache?pattern=${encodeURIComponent(pattern)}`);
      set({ cacheInfo: data });
    } catch (err: any) {
      console.error('inspectCache failed:', err.message);
    }
  },

  clearCache: async (pattern = '*') => {
    await authFetch('/admin/debug/cache/clear', { method: 'POST', body: JSON.stringify({ pattern }) });
    await get().inspectCache(pattern);
  },

  forceLogout: async (userId: string) => {
    await authFetch(`/admin/users/${userId}/force-logout`, { method: 'POST' });
  },

  suspendUser: async (userId: string, reason: string, durationHours?: number) => {
    await authFetch(`/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason, durationHours }),
    });
  },

  banUser: async (userId: string, reason: string) => {
    await authFetch(`/admin/users/${userId}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  restoreUser: async (userId: string) => {
    await authFetch(`/admin/users/${userId}/restore`, { method: 'POST' });
  },

  deleteUser: async (userId: string) => {
    try {
      await authFetch(`/admin/users/${userId}/delete`, { method: 'POST' });
    } catch (err: any) {
      console.error('deleteUser failed:', err.message);
      throw err;
    }
  },

  fetchFailedLogins: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/security/failed-logins?hours=${hours}`);
      set({ failedLogins: data });
    } catch (err: any) {
      console.error('fetchFailedLogins failed:', err.message);
    }
  },

  fetchSuspiciousIPs: async (threshold = 50, hours = 1) => {
    try {
      const data = await authFetch(`/admin/security/suspicious-ips?threshold=${threshold}&hours=${hours}`);
      set({ suspiciousIPs: data });
    } catch (err: any) {
      console.error('fetchSuspiciousIPs failed:', err.message);
    }
  },

  fetchRateLimitHits: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/security/rate-limit-hits?hours=${hours}`);
      set({ rateLimitHits: data });
    } catch (err: any) {
      console.error('fetchRateLimitHits failed:', err.message);
    }
  },

  fetchSecurityScore: async () => {
    try {
      const data = await authFetch('/admin/security/score');
      set({ securityScore: data });
    } catch (err: any) {
      console.error('fetchSecurityScore failed:', err.message);
    }
  },

  blockIP: async (ipAddress: string, reason?: string) => {
    try {
      await authFetch('/admin/security/block-ip', {
        method: 'POST',
        body: JSON.stringify({ ipAddress, reason }),
      });
    } catch (err: any) {
      console.error('blockIP failed:', err.message);
      throw err;
    }
  },

  fetchAlertRules: async () => {
    try {
      const data = await authFetch('/admin/alerts/rules');
      set({ alertRules: data });
    } catch (err: any) {
      console.error('fetchAlertRules failed:', err.message);
    }
  },

  createAlertRule: async (rule: any) => {
    try {
      await authFetch('/admin/alerts/rules', { method: 'POST', body: JSON.stringify(rule) });
      await get().fetchAlertRules();
    } catch (err: any) {
      console.error('createAlertRule failed:', err.message);
    }
  },

  updateAlertRule: async (id: string, updates: any) => {
    try {
      await authFetch(`/admin/alerts/rules/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
      await get().fetchAlertRules();
    } catch (err: any) {
      console.error('updateAlertRule failed:', err.message);
    }
  },

  deleteAlertRule: async (id: string) => {
    try {
      await authFetch(`/admin/alerts/rules/${id}`, { method: 'DELETE' });
      await get().fetchAlertRules();
    } catch (err: any) {
      console.error('deleteAlertRule failed:', err.message);
    }
  },

  fetchAlertHistory: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/alerts/history?${params}`);
      set({ alertHistory: data });
    } catch (err: any) {
      console.error('fetchAlertHistory failed:', err.message);
    }
  },

  acknowledgeAlert: async (id: number) => {
    try {
      await authFetch(`/admin/alerts/${id}/acknowledge`, { method: 'POST' });
      await get().fetchAlertHistory();
    } catch (err: any) {
      console.error('acknowledgeAlert failed:', err.message);
    }
  },

  testAlertRule: async (id: string) => {
    try {
      return await authFetch(`/admin/alerts/rules/${id}/test`, { method: 'POST' });
    } catch (err: any) {
      console.error('testAlertRule failed:', err.message);
      throw err;
    }
  },

  evaluateAlerts: async () => {
    try {
      await authFetch('/admin/alerts/evaluate', { method: 'POST' });
    } catch (err: any) {
      console.error('evaluateAlerts failed:', err.message);
    }
  },

  fetchConfig: async () => {
    try {
      const data = await authFetch('/admin/config');
      set({ configItems: data });
    } catch (err: any) {
      console.error('fetchConfig failed:', err.message);
    }
  },

  updateConfig: async (key: string, value: any, description?: string) => {
    try {
      await authFetch(`/admin/config/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value, description }),
      });
      await get().fetchConfig();
    } catch (err: any) {
      console.error('updateConfig failed:', err.message);
    }
  },

  fetchConfigHistory: async (key?: string) => {
    try {
      const params = key ? `?key=${key}` : '';
      const data = await authFetch(`/admin/config/history${params}`);
      set({ configHistory: data });
    } catch (err: any) {
      console.error('fetchConfigHistory failed:', err.message);
    }
  },

  toggleMaintenance: async (enabled: boolean, message?: string) => {
    try {
      await authFetch('/admin/maintenance', {
        method: 'POST',
        body: JSON.stringify({ enabled, message }),
      });
    } catch (err: any) {
      console.error('toggleMaintenance failed:', err.message);
    }
  },

  fetchAuditLog: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/audit-log?${params}`);
      set({ auditLog: data });
    } catch (err: any) {
      console.error('fetchAuditLog failed:', err.message);
    }
  },

  fetchHealth: async () => {
    try {
      const data = await authFetch('/admin/health');
      set({ health: data });
    } catch (err: any) {
      console.error('fetchHealth failed:', err.message);
    }
  },

  fetchHealthHistory: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/health/history?hours=${hours}`);
      set({ healthHistory: data });
    } catch (err: any) {
      console.error('fetchHealthHistory failed:', err.message);
    }
  },

  fetchJobs: async () => {
    try {
      const data = await authFetch('/admin/jobs');
      set({ jobs: data });
    } catch (err: any) {
      console.error('fetchJobs failed:', err.message);
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
    users: null,
    userDetail: null,
    userActivity: null,
    logs: null,
    errorEvents: null,
    errorDetail: null,
    trace: null,
    cacheInfo: null,
    failedLogins: null,
    suspiciousIPs: [],
    rateLimitHits: [],
    securityScore: null,
    alertRules: [],
    alertHistory: null,
    configItems: [],
    configHistory: [],
    auditLog: null,
    health: null,
    healthHistory: [],
    jobs: null,
    loading: false,
    error: null,
  });
});
