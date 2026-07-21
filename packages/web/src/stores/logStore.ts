import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { encryptData, decryptData } from '../lib/crypto';
import { getGroupKey } from './groupStore';
import { onLogout } from '../lib/resetStores';
import { verifyLogChain, createGroupLogEntry, type GroupLogEntry as EngineLogEntry, GroupLogEventType } from '@coldfi/shared';

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
  addLogEntry: (groupId: string, entry: {
    eventType: GroupLogEventType;
    actorId: string;
    actorName: string;
    action: string;
    actionType: LogEntry['actionType'];
    details: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
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

function toEngineEntry(entry: LogEntry): EngineLogEntry {
  const eventMap: Record<string, GroupLogEventType> = {
    expense: GroupLogEventType.EXPENSE_ADDED,
    settlement: GroupLogEventType.SETTLEMENT_PROPOSED,
    member: GroupLogEventType.MEMBER_JOINED,
    settings: GroupLogEventType.ADMIN_ACTION,
  };
  return {
    id: entry.id,
    groupId: '',
    eventType: eventMap[entry.actionType] || GroupLogEventType.ADMIN_ACTION,
    actorId: '',
    metadata: { action: entry.action, details: entry.details, actorName: entry.actorName },
    timestamp: entry.timestamp,
    previousLogHash: entry.previousHash,
    hash: entry.hash,
    targetId: undefined,
  };
}

function fromEngineEntry(engine: EngineLogEntry, logs: LogEntry[]): LogEntry {
  const meta = engine.metadata as Record<string, string> || {};
  const existing = logs.find((l) => l.id === engine.id);
  if (existing) return existing;
  return {
    id: engine.id,
    timestamp: engine.timestamp,
    actorName: meta.actorName || engine.actorId,
    action: meta.action || engine.eventType,
    actionType: 'expense',
    details: meta.details || '',
    hash: engine.hash,
    previousHash: engine.previousLogHash,
  };
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  fetchLogs: async (groupId: string) => {
    set({ isLoading: true, error: null });

    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        set({ logs: [], isLoading: false });
        return;
      }

      const res = await apiClient(`/api/group/${groupId}/sync`);

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

      // Support both legacy LogEntry[] and engine GroupLogEntry[] format
      const rawLogs: any[] = groupData.logs || [];
      const logs: LogEntry[] = rawLogs.map((l: any) =>
        l.hash && l.previousHash !== undefined
          ? l as LogEntry
          : fromEngineEntry(l, [])
      );

      set({ logs, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch logs',
      });
    }
  },

  verifyIntegrity: async (groupId: string) => {
    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const res = await apiClient(`/api/group/${groupId}/sync`);

      if (!res.ok) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const syncData = await res.json();

      if (!syncData.encryptedBlob) {
        return { valid: false, totalChecked: 0, brokenAt: [] };
      }

      const decrypted = await decryptData(gk, syncData.encryptedBlob);
      const groupData = JSON.parse(decrypted);
      const entries: LogEntry[] = (groupData.logs || []).map((l: any) =>
        l.hash && l.previousHash !== undefined ? l as LogEntry : fromEngineEntry(l, [])
      );

      // Try engine chain verification first
      try {
        const engineEntries: EngineLogEntry[] = entries.map(toEngineEntry);
        const engineResult = verifyLogChain(engineEntries);
        const alwaysHashErrors = engineResult.errors.filter((e) => !e.includes('hash mismatch'));
        // Engine may report false hash mismatches due to algorithm difference;
        // we still get chain structure validation
        if (alwaysHashErrors.length === 0) {
          // Chain structure is sound — now do per-entry hash checks with SHA-256
          const brokenAt: number[] = [];
          let previousHash = '';
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i]!;
            if (i > 0 && entry.previousHash !== previousHash) brokenAt.push(i);
            const expectedHash = await computeEntryHash({
              id: entry.id, timestamp: entry.timestamp, actorName: entry.actorName,
              action: entry.action, actionType: entry.actionType, details: entry.details,
              previousHash: entry.previousHash,
            });
            if (expectedHash !== entry.hash) brokenAt.push(i);
            previousHash = entry.hash;
          }
          set((state) => ({
            logs: state.logs.map((log, i) => ({ ...log, isValid: !brokenAt.includes(i) })),
          }));
          return { valid: brokenAt.length === 0, totalChecked: entries.length, brokenAt };
        }
      } catch {}

      // Fallback: pure inline verification
      const brokenAt: number[] = [];
      let previousHash = '';
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        if (i > 0 && entry.previousHash !== previousHash) brokenAt.push(i);
        const expectedHash = await computeEntryHash({
          id: entry.id, timestamp: entry.timestamp, actorName: entry.actorName,
          action: entry.action, actionType: entry.actionType, details: entry.details,
          previousHash: entry.previousHash,
        });
        if (expectedHash !== entry.hash) brokenAt.push(i);
        previousHash = entry.hash;
      }
      set((state) => ({
        logs: state.logs.map((log, i) => ({ ...log, isValid: !brokenAt.includes(i) })),
      }));
      return { valid: brokenAt.length === 0, totalChecked: entries.length, brokenAt };
    } catch {
      return { valid: false, totalChecked: 0, brokenAt: [] };
    }
  },

  addLogEntry: async (groupId: string, entryDef: {
    eventType: GroupLogEventType;
    actorId: string;
    actorName: string;
    action: string;
    actionType: LogEntry['actionType'];
    details: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        console.warn('[logStore] No group key for', groupId);
        return;
      }

      const res = await apiClient(`/api/group/${groupId}/sync`);
      if (!res.ok) {
        console.warn('[logStore] Failed to fetch sync blob:', res.status);
        return;
      }

      const syncData = await res.json();
      const vectorClock = syncData.vectorClock || {};
      let logs: LogEntry[] = [];

      if (syncData.encryptedBlob) {
        const decrypted = await decryptData(gk, syncData.encryptedBlob);
        const parsed = JSON.parse(decrypted);
        logs = (parsed.logs || []).map((l: any) =>
          l.hash && l.previousHash !== undefined ? l as LogEntry : fromEngineEntry(l, [])
        );
      }

      const previousHash = logs.length > 0 ? logs[logs.length - 1]!.hash : '';

      const engineEntry = createGroupLogEntry({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        groupId,
        eventType: entryDef.eventType,
        actorId: entryDef.actorId,
        targetId: entryDef.targetId,
        metadata: { ...entryDef.metadata, action: entryDef.action, details: entryDef.details, actorName: entryDef.actorName, actionType: entryDef.actionType },
        timestamp: new Date().toISOString(),
        previousLogHash: previousHash,
      });

      const legacyHash = await computeEntryHash({
        id: engineEntry.id,
        timestamp: engineEntry.timestamp,
        actorName: entryDef.actorName,
        action: entryDef.action,
        actionType: entryDef.actionType,
        details: entryDef.details,
        previousHash,
      });

      logs.push({
        id: engineEntry.id,
        timestamp: engineEntry.timestamp,
        actorName: entryDef.actorName,
        action: entryDef.action,
        actionType: entryDef.actionType,
        details: entryDef.details,
        hash: legacyHash,
        previousHash,
      });

      const serialized = JSON.stringify({ ...JSON.parse(syncData.encryptedBlob ? await decryptData(gk, syncData.encryptedBlob) : '{}'), logs });
      const encrypted = await encryptData(gk, serialized);

      const putRes = await apiClient(`/api/group/${groupId}/sync`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedBlob: encrypted, vectorClock }),
      });

      if (putRes.status === 409) {
        console.warn('[logStore] Conflict on log append, retrying once...');
        const retryRes = await apiClient(`/api/group/${groupId}/sync`);
        if (!retryRes.ok) return;
        const retryData = await retryRes.json();
        let retryLogs: LogEntry[] = [];
        if (retryData.encryptedBlob) {
          const d = await decryptData(gk, retryData.encryptedBlob);
          retryLogs = (JSON.parse(d).logs || []).map((l: any) =>
            l.hash && l.previousHash !== undefined ? l as LogEntry : fromEngineEntry(l, [])
          );
        }
        const retryPrevHash = retryLogs.length > 0 ? retryLogs[retryLogs.length - 1]!.hash : '';
        logs[logs.length - 1] = { ...logs[logs.length - 1]!, previousHash: retryPrevHash };
        const retryEngineEntry = createGroupLogEntry({
          ...engineEntry,
          previousLogHash: retryPrevHash,
        });
        logs[logs.length - 1] = {
          ...logs[logs.length - 1]!,
          id: retryEngineEntry.id,
          timestamp: retryEngineEntry.timestamp,
          hash: retryEngineEntry.hash,
          previousHash: retryPrevHash,
        };
        const retrySerialized = JSON.stringify({ ...JSON.parse(retryData.encryptedBlob ? await decryptData(gk, retryData.encryptedBlob) : '{}'), logs });
        const retryEncrypted = await encryptData(gk, retrySerialized);
        await apiClient(`/api/group/${groupId}/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedBlob: retryEncrypted, vectorClock: retryData.vectorClock }),
        });
      }

      set((state) => ({ logs: [...state.logs, logs[logs.length - 1]!] }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add log entry' });
      console.error('[logStore] addLogEntry failed:', err);
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
