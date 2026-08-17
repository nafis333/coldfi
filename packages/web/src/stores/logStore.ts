import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { encryptData, decryptData } from '../lib/crypto';
import { getGroupKey } from './groupStore';
import { silentCatch } from '../lib/errorHandler';
import { onLogout } from '../lib/resetStores';
import { createGroupLogEntry, computeLogHash, type GroupLogEntry as EngineLogEntry, GroupLogEventType } from '@coldfi/shared';

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
  /** Group whose entries are currently in `logs`; prevents cross-group pollution. */
  logsGroupId: string | null;
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

function fromEngineEntry(engine: EngineLogEntry, logs: LogEntry[]): LogEntry {
  const meta = engine.metadata as Record<string, string> || {};
  const existing = logs.find((l) => l.id === engine.id);
  if (existing) return existing;
  const et = String(engine.eventType);
  const actionType: LogEntry['actionType'] = meta.actionType as LogEntry['actionType'] || (et.startsWith('expense_') ? 'expense' : et.startsWith('member_') ? 'member' : et.startsWith('settlement_') ? 'settlement' : 'expense');
  return {
    id: engine.id,
    timestamp: engine.timestamp,
    actorName: meta.actorName || engine.actorId,
    action: meta.action || et,
    actionType,
    details: meta.details || '',
    hash: engine.hash,
    previousHash: engine.previousLogHash,
  };
}

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  logsGroupId: null,
  isLoading: false,
  error: null,

  fetchLogs: async (groupId: string) => {
    set({ isLoading: true, error: null });

    try {
      const gk = getGroupKey(groupId);
      if (!gk) {
        set({ logs: [], logsGroupId: null, isLoading: false });
        return;
      }

      const res = await apiClient(`/api/group/${groupId}/sync`);

      if (!res.ok) {
        throw new Error(`Failed to fetch logs: ${res.status}`);
      }

      const syncData = await res.json();

      if (!syncData.encryptedBlob) {
        set({ logs: [], logsGroupId: null, isLoading: false });
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

      set({ logs, logsGroupId: groupId, isLoading: false });
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
      const rawLogs: any[] = groupData.logs || [];

      // Engine-format entries (SHA-512 over id/groupId/eventType/actorId/
      // metadata/timestamp/previousLogHash) and legacy entries (SHA-256 over
      // display fields) can coexist in a chain — verify each with its own
      // algorithm instead of marking one format as broken.
      const brokenAt: number[] = [];
      let previousHash = '';
      for (let i = 0; i < rawLogs.length; i++) {
        const l = rawLogs[i]!;
        const isEngine =
          l.previousLogHash !== undefined ||
          (typeof l.hash === 'string' && l.hash.length === 128 && l.previousHash === undefined);
        const link = isEngine ? (l.previousLogHash || '') : (l.previousHash || '');

        if (link !== previousHash) brokenAt.push(i);

        let expectedHash: string;
        if (isEngine) {
          expectedHash = computeLogHash({
            id: l.id,
            groupId: l.groupId,
            eventType: l.eventType,
            actorId: l.actorId,
            targetId: l.targetId,
            metadata: l.metadata || {},
            timestamp: l.timestamp,
            previousLogHash: l.previousLogHash || '',
          });
        } else {
          expectedHash = await computeEntryHash({
            id: l.id,
            timestamp: l.timestamp,
            actorName: l.actorName,
            action: l.action,
            actionType: l.actionType,
            details: l.details,
            previousHash: link,
          });
        }

        if (expectedHash !== l.hash) brokenAt.push(i);
        previousHash = l.hash;
      }

      set((state) => {
        // The user may have navigated to another group while verification ran;
        // don't stamp isValid flags onto the wrong group's logs.
        if (state.logsGroupId !== groupId) return {};
        const brokenIds = new Set(brokenAt.map((i) => rawLogs[i]?.id));
        return { logs: state.logs.map((log) => ({ ...log, isValid: !brokenIds.has(log.id) })) };
      });
      return { valid: brokenAt.length === 0, totalChecked: rawLogs.length, brokenAt };
    } catch (err) {
      silentCatch('logStore.verifyFallback', err);
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
      let vectorClock = syncData.vectorClock || {};
      let logs: LogEntry[] = [];
      let parsedBlob: Record<string, unknown> = {};

      if (syncData.encryptedBlob) {
        const decrypted = await decryptData(gk, syncData.encryptedBlob);
        parsedBlob = JSON.parse(decrypted);
        logs = ((parsedBlob.logs || []) as any[]).map((l: any) =>
          l.hash && l.previousHash !== undefined ? l as LogEntry : fromEngineEntry(l, [])
        );
      }

const entrySeed = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        groupId,
        eventType: entryDef.eventType,
        actorId: entryDef.actorId,
        targetId: entryDef.targetId,
        metadata: { ...entryDef.metadata, action: entryDef.action, details: entryDef.details, actorName: entryDef.actorName, actionType: entryDef.actionType },
        timestamp: new Date().toISOString(),
      };

      let putOk = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const prevHashForAttempt = logs.length > 0 ? logs[logs.length - 1]!.hash : '';

        const engineEntry = createGroupLogEntry({
          ...entrySeed,
          previousLogHash: prevHashForAttempt,
        });
        const meta = (engineEntry.metadata || {}) as Record<string, string>;
        const actorName = meta.actorName || engineEntry.actorId;
        const action = meta.action || String(engineEntry.eventType);
        const actionType = (meta.actionType as LogEntry['actionType']) || 'expense';
        const details = meta.details || '';
        const legacyHash = await computeEntryHash({
          id: engineEntry.id,
          timestamp: engineEntry.timestamp,
          actorName,
          action,
          actionType,
          details,
          previousHash: prevHashForAttempt,
        });

        const entry: LogEntry = {
          id: engineEntry.id,
          timestamp: engineEntry.timestamp,
          actorName,
          action,
          actionType,
          details,
          hash: legacyHash,
          previousHash: prevHashForAttempt,
        };

        const attemptLogs = [...logs, entry];
        const serialized = JSON.stringify({ ...parsedBlob, logs: attemptLogs });
        const encrypted = await encryptData(gk, serialized);

        const putRes = await apiClient(`/api/group/${groupId}/sync`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ encryptedBlob: encrypted, vectorClock }),
        });

        if (putRes.status !== 409) {
          if (!putRes.ok) {
            console.error('[logStore] PUT failed:', putRes.status);
            return;
          }
          logs = attemptLogs;
          putOk = true;
          break;
        }

        // Conflict — refetch the latest blob and relink the entry to its new
        // tail before retrying (the mutation must be re-applied, not resent).
        if (attempt === 2) {
          console.error('[logStore] Log append still conflicting after retries');
          return;
        }
        const retryRes = await apiClient(`/api/group/${groupId}/sync`);
        if (!retryRes.ok) return;
        const retryData = await retryRes.json();
        parsedBlob = retryData.encryptedBlob
          ? (JSON.parse(await decryptData(gk, retryData.encryptedBlob)) as Record<string, unknown>)
          : {};
        logs = ((parsedBlob.logs || []) as any[]).map((l: any) =>
          l.hash && l.previousHash !== undefined ? l as LogEntry : fromEngineEntry(l, [])
        );
        vectorClock = retryData.vectorClock || {};
      }

      if (!putOk) return;

      set((state) => {
        // Only mirror the append locally when the in-memory list belongs to
        // this group; otherwise a later fetch picks it up from the server.
        if (state.logsGroupId !== groupId) return {};
        return { logs: [...state.logs, logs[logs.length - 1]!] };
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add log entry' });
      console.error('[logStore] addLogEntry failed:', err);
    }
  },
}));

onLogout(() => {
  useLogStore.setState({
    logs: [],
    logsGroupId: null,
    isLoading: false,
    error: null,
  });
});

