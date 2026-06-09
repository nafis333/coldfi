import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { encryptData, decryptData, deriveGroupKey, base64ToUint8Array, uint8ArrayToBase64 } from '../lib/crypto';
import { onLogout } from '../lib/resetStores';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  yourBalance: number;
}

interface GroupMember {
  userId: string;
  displayName: string;
  email: string;
  role: 'admin' | 'member';
  balance: number;
  joinedAt: string;
}

interface GroupDetail {
  id: string;
  name: string;
  members: GroupMember[];
  myBalance: number;
}

interface MemberSplit {
  userId: string;
  amount: number;
}

interface ItemizedEntry {
  name: string;
  amount: number;
}

interface GroupExpenseInput {
  amount: number;
  description: string;
  category: string;
  payerId: string;
  splits: MemberSplit[];
  itemized?: ItemizedEntry[];
}

interface GroupExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  payerId: string;
  splits: MemberSplit[];
  itemized?: ItemizedEntry[];
  createdAt: string;
}

interface SettlementInput {
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
}

interface SettlementData {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: string;
  confirmedAt?: string;
}

const groupKeyCache = new Map<string, CryptoKey>();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
 return bytes;
}

async function hashPassphrase(passphrase: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = hexToBytes(saltHex);
  const passBytes = encoder.encode(passphrase);
  const combined = new Uint8Array(salt.length + passBytes.length);
  combined.set(salt);
  combined.set(passBytes, salt.length);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return bytesToHex(new Uint8Array(hash));
}

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function getGroupKey(groupId: string): CryptoKey | undefined {
  return groupKeyCache.get(groupId);
}

export function cacheGroupKey(groupId: string, passphrase: string): Promise<CryptoKey> {
  return deriveGroupKey(passphrase, groupId).then((key) => {
    groupKeyCache.set(groupId, key);
    return key;
  });
}

interface GroupState {
  groups: GroupSummary[];
  currentGroup: GroupDetail | null;
  isLoading: boolean;
  error: string | null;
  groupDataVersions: Record<string, number>;

  fetchGroups: () => Promise<void>;
  fetchGroupById: (id: string) => Promise<void>;
  createGroup: (name: string, passphrase: string) => Promise<string>;
  joinGroup: (inviteCode: string, passphrase: string) => Promise<void>;
  createGroupExpense: (groupId: string, data: GroupExpenseInput) => Promise<void>;
  proposeSettlement: (groupId: string, data: SettlementInput) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  addMemberFromSocket: (groupId: string, member: GroupMember) => void;
  removeMemberFromSocket: (groupId: string, userId: string) => void;
  updateGroupFromSocket: (group: GroupSummary) => void;
  incrementGroupDataVersion: (groupId: string) => void;
  clearError: () => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  currentGroup: null,
  isLoading: false,
  error: null,
  groupDataVersions: {},

  fetchGroups: async () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/api/group`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch groups: ${res.status}`);
      }

      const data = await res.json();
      set({ groups: data.groups, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch groups',
      });
    }
  },

  fetchGroupById: async (id: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/api/group/${id}/members`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch group: ${res.status}`);
      }

      const data = await res.json();
      set({
        currentGroup: {
          id: data.id,
          name: data.name,
          members: data.members,
          myBalance: data.myBalance ?? 0,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch group',
      });
    }
  },

  createGroup: async (name: string, passphrase: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const salt = generateSalt();
      const passphraseVerifier = await hashPassphrase(passphrase, salt);

      const res = await fetch(`${API_BASE}/api/group/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name, passphraseVerifier, salt, defaultCurrency: 'USD' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }

      const data = await res.json();
      set({ isLoading: false });

      // Cache group key for this session
      await cacheGroupKey(data.groupId, passphrase);

      // Refresh group list
      const state = useGroupStore.getState();
      await state.fetchGroups();

      return data.groupId;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create group',
      });
      throw error;
    }
  },

  joinGroup: async (inviteCode: string, passphrase: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      // First fetch group info to get the salt
      const infoRes = await fetch(`${API_BASE}/api/group/invite/${inviteCode}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!infoRes.ok) {
        throw new Error('Group not found or invalid invite code');
      }

      const groupInfo = await infoRes.json();
      const passphraseVerifier = await hashPassphrase(passphrase, groupInfo.salt);

      const res = await fetch(`${API_BASE}/api/group/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ groupId: inviteCode, passphraseVerifier }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join group');
      }

      set({ isLoading: false });

      // Cache group key for this session
      await cacheGroupKey(inviteCode, passphrase);

      // Refresh group list
      const state = useGroupStore.getState();
      await state.fetchGroups();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to join group',
      });
      throw error;
    }
  },

  createGroupExpense: async (groupId: string, data: GroupExpenseInput) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const gk = groupKeyCache.get(groupId);
      if (!gk) throw new Error('Group key not available. Please re-enter the group passphrase.');

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const syncRes = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!syncRes.ok) throw new Error(`Failed to fetch group data: ${syncRes.status}`);

          const syncData = await syncRes.json();
          const vectorClock = syncData.vectorClock || {};

          let groupData: { expenses: GroupExpenseData[]; settlements: SettlementData[] } = { expenses: [], settlements: [] };
          if (syncData.encryptedBlob) {
            const decrypted = await decryptData(gk, syncData.encryptedBlob);
            groupData = JSON.parse(decrypted);
          }

          groupData.expenses.push({
            ...data,
            createdAt: new Date().toISOString(),
            id: `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          });

          const encrypted = await encryptData(gk, JSON.stringify(groupData));

          const putRes = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ encryptedBlob: encrypted, vectorClock }),
          });

          if (putRes.status === 409) {
            lastError = new Error('Data conflict. Retrying...');
            continue;
          }

          if (!putRes.ok) {
            throw new Error(`Failed to save group expense: ${putRes.status}`);
          }

          set({ isLoading: false });
          return;
        } catch (e) {
          if (e instanceof Error && e.message !== 'Data conflict. Retrying...') {
            throw e;
          }
          lastError = e instanceof Error ? e : new Error('Failed to create expense');
        }
      }

      throw lastError || new Error('Failed to create expense after retries');
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create expense',
      });
      throw error;
    }
  },

  proposeSettlement: async (groupId: string, data: SettlementInput) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const gk = groupKeyCache.get(groupId);
      if (!gk) throw new Error('Group key not available. Please re-enter the group passphrase.');

      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const syncRes = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!syncRes.ok) throw new Error(`Failed to fetch group data: ${syncRes.status}`);

          const syncData = await syncRes.json();
          const vectorClock = syncData.vectorClock || {};

          let groupData: { expenses: GroupExpenseData[]; settlements: SettlementData[] } = { expenses: [], settlements: [] };
          if (syncData.encryptedBlob) {
            const decrypted = await decryptData(gk, syncData.encryptedBlob);
            groupData = JSON.parse(decrypted);
          }

          groupData.settlements.push({
            id: `stl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            amount: data.amount,
            note: data.note,
            status: 'pending',
            createdAt: new Date().toISOString(),
          });

          const encrypted = await encryptData(gk, JSON.stringify(groupData));

          const putRes = await fetch(`${API_BASE}/api/group/${groupId}/sync`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ encryptedBlob: encrypted, vectorClock }),
          });

          if (putRes.status === 409) {
            lastError = new Error('Data conflict. Retrying...');
            continue;
          }

          if (!putRes.ok) {
            throw new Error(`Failed to save settlement: ${putRes.status}`);
          }

          set({ isLoading: false });
          return;
        } catch (e) {
          if (e instanceof Error && e.message !== 'Data conflict. Retrying...') {
            throw e;
          }
          lastError = e instanceof Error ? e : new Error('Failed to propose settlement');
        }
      }

      throw lastError || new Error('Failed to propose settlement after retries');
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to propose settlement',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  addMemberFromSocket: (groupId: string, member: GroupMember) => {
    set((state) => {
      if (state.currentGroup?.id !== groupId) return state;
      return {
        currentGroup: {
          ...state.currentGroup,
          members: [...state.currentGroup.members, member],
        },
      };
    });
  },

  removeMemberFromSocket: (groupId: string, userId: string) => {
    set((state) => {
      if (state.currentGroup?.id !== groupId) return state;
      return {
        currentGroup: {
          ...state.currentGroup,
          members: state.currentGroup.members.filter((m) => m.userId !== userId),
        },
      };
    });
  },

  updateGroupFromSocket: (group: GroupSummary) => {
    set((state) => ({
      groups: state.groups.map((g) => (g.id === group.id ? group : g)),
    }));
  },

  incrementGroupDataVersion: (groupId: string) => {
    set((state) => ({
      groupDataVersions: {
        ...state.groupDataVersions,
        [groupId]: (state.groupDataVersions[groupId] ?? 0) + 1,
      },
    }));
  },

  leaveGroup: async (groupId: string) => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const res = await fetch(`${API_BASE}/api/group/${groupId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave group');
      }

      set({ isLoading: false });

      // Refresh group list
      const state = useGroupStore.getState();
      await state.fetchGroups();
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to leave group',
      });
      throw error;
    }
  },
}));

onLogout(() => {
  useGroupStore.setState({
    groups: [],
    currentGroup: null,
    isLoading: false,
    error: null,
    groupDataVersions: {},
  });
  groupKeyCache.clear();
});
