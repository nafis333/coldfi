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

interface AdminConfigState {
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

export const useAdminConfigStore = create<AdminConfigState>((set, get) => ({
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

  fetchAlertRules: async () => {
    try {
      const data = await authFetch('/admin/alerts/rules');
      set({ alertRules: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createAlertRule: async (rule: any) => {
    try {
      await authFetch('/admin/alerts/rules', { method: 'POST', body: JSON.stringify(rule) });
      await get().fetchAlertRules();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  updateAlertRule: async (id: string, updates: any) => {
    try {
      await authFetch(`/admin/alerts/rules/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
      await get().fetchAlertRules();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteAlertRule: async (id: string) => {
    try {
      await authFetch(`/admin/alerts/rules/${id}`, { method: 'DELETE' });
      await get().fetchAlertRules();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchAlertHistory: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/alerts/history?${params}`);
      set({ alertHistory: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  acknowledgeAlert: async (id: number) => {
    try {
      await authFetch(`/admin/alerts/${id}/acknowledge`, { method: 'POST' });
      await get().fetchAlertHistory();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  testAlertRule: async (id: string) => {
    try {
      return await authFetch(`/admin/alerts/rules/${id}/test`, { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  evaluateAlerts: async () => {
    try {
      await authFetch('/admin/alerts/evaluate', { method: 'POST' });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchConfig: async () => {
    try {
      const data = await authFetch('/admin/config');
      set({ configItems: data });
    } catch (err: any) {
      set({ error: err.message });
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
      set({ error: err.message });
    }
  },

  fetchConfigHistory: async (key?: string) => {
    try {
      const params = key ? `?key=${key}` : '';
      const data = await authFetch(`/admin/config/history${params}`);
      set({ configHistory: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  toggleMaintenance: async (enabled: boolean, message?: string) => {
    try {
      await authFetch('/admin/maintenance', {
        method: 'POST',
        body: JSON.stringify({ enabled, message }),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  fetchAuditLog: async (opts = {}) => {
    const params = new URLSearchParams(opts as any);
    try {
      const data = await authFetch(`/admin/audit-log?${params}`);
      set({ auditLog: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchHealth: async () => {
    try {
      const data = await authFetch('/admin/health');
      set({ health: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchHealthHistory: async (hours = 24) => {
    try {
      const data = await authFetch(`/admin/health/history?hours=${hours}`);
      set({ healthHistory: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchJobs: async () => {
    try {
      const data = await authFetch('/admin/jobs');
      set({ jobs: data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },
}));

onLogout(() => {
  useAdminConfigStore.setState({
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
