import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { decryptData } from '../lib/crypto';
import { getGroupKey } from './groupStore';
import { onLogout } from '../lib/resetStores';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface LogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  actionType: 'expense' | 'settlement' | 'member' | 'settings';
  details: string;
  hash: string;
  previousHash: string;
  isValid?: boolean;
}

interface VerifyResult {
  valid: boolean;
  totalChecked: number;
  brokenAt: number[];
}

interface LogState {
  logs: LogEntry[];
  isLoading: boolean;
  error: string | null;

  fetchLogs: (groupId: string) => Promise<void>;
  verifyIntegrity: (groupId: string) => Promise<VerifyResult>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return bytesToHex(new Uint8Array(hash));
}

async function computeEntryHash(entry: Omit<LogEntry, 'hash' | 'isValid'>): Promise<string> {
  const payload = JSON.stringify(
    { previousHash: entry.previousHash, timestamp: entry.timestamp, actorName: entry.actorName, action: entry.action, actionType: entry.actionType, details: entry.details },
    Object.keys({ previousHash: 1, timestamp: 1, actorName: 1, action: 1, actionType: 1, details: 1 }).sort()
  );
  return sha256(payload);
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  fetchLogs: async (groupId: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    set({ isLoading: true, error: null });

    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        // No group key cached — can't decrypt logs
        set({ logs: [], isLoading: false });
        return;
      }

      const res = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.status}`);
      }

      const syncData = await res.json();

      if (!syncData.encryptedBlob) {
        set({ logs: [], isLoading: false });
        return;
      }

      const decrypted = await decryptData(gk, syncData.encryptedBlob);
      const groupData = JSON.parse(decrypted);
      const logs: LogEntry[] = groupData.logs || [];

      set({ logs, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
      });
    }
  },

  verifyIntegrity: async (groupId: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      return { valid: true, totalChecked: 0, brokenAt: [] };
    }

    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const res = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const syncData = await res.json();

      if (!syncData.encryptedBlob) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const decrypted = await decryptData(gk, syncData.encryptedBlob);
      const groupData = JSON.parse(decrypted);
      const entries: LogEntry[] = groupData.logs || [];

      const brokenAt: number[] = [];
      let previousHash = '';

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;

        // Check previousHash matches
        if (i > 0 && entry.previousHash !== previousHash) {
          brokenAt.push(i);
        }

        // Recompute hash
        const expectedHash = await computeEntryHash({
          id: entry.id,
          timestamp: entry.timestamp,
          actorName: entry.actorName,
          action: entry.action,
          actionType: entry.actionType,
          details: entry.details,
          previousHash: entry.previousHash,
        });

        if (expectedHash !== entry.hash) {
          brokenAt.push(i);
        }

        previousHash = entry.hash;
      }

      // Update logs with validity flags
      set((state) => ({
        logs: state.logs.map((log, i) => ({
          ...log,
          isValid: !brokenAt.includes(i),
        })),
      }));

      return {
        valid: brokenAt.length === 0,
        totalChecked: entries.length,
        brokenAt,
      };
    } catch {
      return { valid: false, totalChecked: 0, brokenAt: [] };
    }
  },
}));

onLogout(() => {
  useLogStore.setState({
    logs: [],
    isLoading: false,
    error: null,
  });
});
