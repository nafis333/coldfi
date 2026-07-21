import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { apiClient } from '../lib/apiClient';
import { encryptData, decryptData } from '../lib/crypto';
import { onLogout } from '../lib/resetStores';
import {
  computeNetBalances,
  migrateGroupBlob,
  GroupExpense,
  SettlementProposal,
  PaymentMethod,
  SplitMode,
  ExpenseStatus,
  SettlementStatus,
} from '@coldfi/shared';
import {
  getGroupKey,
  cacheGroupKey,
  clearGroupKeyCache,
  hashPassphrase,
  generateSalt,
  modifySyncBlob,
  toEngineExpenses,
  toEngineSettlements,
  GroupSummary,
  GroupDetail,
  GroupMember,
  GroupExpenseData,
  SettlementData,
  GroupCategory,
  GroupSyncData,
} from '../lib/groupSync';

export { getGroupKey, cacheGroupKey } from '../lib/groupSync';

export interface MemberSplit {
  userId: string;
  amount: number;
}

export interface ItemizedEntry {
  name: string;
  amount: number;
  assignedTo?: string[];
  splitMode?: 'equal' | 'exact' | 'percentage';
  splitValues?: Record<string, number>;
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
  leaveGroup: (groupId: string) => Promise<void>;
  generateInvite: (groupId: string) => Promise<{ code: string; inviteId: string; expiresIn: string; maxUses: number }>;
  fetchInvites: (groupId: string) => Promise<{ invites: Array<{ id: string; code: string; use_count: number; max_uses: number; expires_at: string; is_active: boolean; created_at: string }> }>;
  revokeInvite: (groupId: string, inviteId: string) => Promise<void>;
  changePassphrase: (groupId: string, newPassphrase: string) => Promise<void>;
  updateGroupSettings: (groupId: string, settings: { name?: string; defaultCurrency?: string }) => Promise<void>;
  addGroupCategory: (groupId: string, category: Pick<GroupCategory, 'name' | 'icon' | 'color'>) => Promise<void>;
  removeGroupCategory: (groupId: string, categoryId: string) => Promise<void>;
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
    if (!useAuthStore.getState().accessToken) return;

    set({ isLoading: true, error: null });

    try {
      const res = await apiClient('/api/group');

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
    if (!useAuthStore.getState().accessToken) return;

    set({ isLoading: true, error: null });

    try {
      const [membersRes, syncRes] = await Promise.all([
        apiClient(`/api/group/${id}/members`),
        apiClient(`/api/group/${id}/sync`),
      ]);

      if (!membersRes.ok) {
        throw new Error(`Failed to fetch group: ${membersRes.status}`);
      }

      const data = await membersRes.json();
      let settlements: SettlementData[] = [];
      let expenses: GroupExpenseData[] = [];
      let groupCategories: GroupCategory[] = [];

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.encryptedBlob) {
          const gk = getGroupKey(id);
          if (gk) {
            try {
              const decrypted = await decryptData(gk, syncData.encryptedBlob);
              const parsed: any = migrateGroupBlob(JSON.parse(decrypted));
              settlements = parsed.settlements || [];
              expenses = parsed.expenses || [];
              groupCategories = parsed.categories || [];
            } catch {}
          }
        }
      }

      const defaultCurrency = data.defaultCurrency;
      const memberIdsSet = new Set<string>(data.members.map((m: GroupMember) => m.userId));
      for (const exp of expenses) {
        memberIdsSet.add(exp.payerId);
        for (const s of exp.splits) {
          memberIdsSet.add(s.userId);
        }
      }
      for (const st of settlements) {
        memberIdsSet.add(st.fromUserId);
        memberIdsSet.add(st.toUserId);
      }
      const memberIds = Array.from(memberIdsSet);
      const engineExpenses = toEngineExpenses(expenses, data.id, defaultCurrency);
      const engineSettlements = toEngineSettlements(settlements);
      const balances = computeNetBalances(engineExpenses, engineSettlements, memberIds);

      set({
        currentGroup: {
          id: data.id,
          name: data.name,
          defaultCurrency,
          members: data.members,
          settlements,
          expenses,
          groupCategories,
          myBalance: data.myBalance ?? 0,
          balances,
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
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const salt = generateSalt();
      const passphraseVerifier = await hashPassphrase(passphrase, salt);
      const defaultCurrency = useAuthStore.getState().defaultCurrency;

      const res = await apiClient('/api/group/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, passphraseVerifier, salt, defaultCurrency }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }

      const data = await res.json();
      set({ isLoading: false });

      await cacheGroupKey(data.groupId, passphrase);

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
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const infoRes = await apiClient(`/api/group/invite/${inviteCode}`);

      if (!infoRes.ok) {
        throw new Error('Group not found or invalid invite code');
      }

      const groupInfo = await infoRes.json();
      const passphraseVerifier = await hashPassphrase(passphrase, groupInfo.salt);

      const res = await apiClient('/api/group/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode, passphraseVerifier }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join group');
      }

      const data = await res.json();
      set({ isLoading: false });

      await cacheGroupKey(data.groupId, passphrase);

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

  leaveGroup: async (groupId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const res = await apiClient(`/api/group/${groupId}/leave`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave group');
      }

      set({ isLoading: false });

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

  generateInvite: async (groupId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    try {
      const res = await apiClient(`/api/group/${groupId}/invites`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to generate invite code');
      return res.json();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to generate invite' });
      throw error;
    }
  },

  fetchInvites: async (groupId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    try {
      const res = await apiClient(`/api/group/${groupId}/invites`);
      if (!res.ok) throw new Error('Failed to fetch invite codes');
      return res.json();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch invites' });
      throw error;
    }
  },

  revokeInvite: async (groupId: string, inviteId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    try {
      const res = await apiClient(`/api/group/${groupId}/invites/${inviteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke invite code');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to revoke invite' });
      throw error;
    }
  },

  changePassphrase: async (groupId: string, newPassphrase: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    try {
      const salt = generateSalt();
      const newPassphraseVerifier = await hashPassphrase(newPassphrase, salt);

      const res = await apiClient(`/api/group/${groupId}/passphrase`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassphraseVerifier, newSalt: salt }),
      });

      if (!res.ok) throw new Error('Failed to change passphrase');

      await cacheGroupKey(groupId, newPassphrase);
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to change passphrase' });
      throw error;
    }
  },

  updateGroupSettings: async (groupId: string, settings: { name?: string; defaultCurrency?: string }) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    try {
      const res = await apiClient(`/api/group/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to update group settings');
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update group settings' });
      throw error;
    }
  },

  addGroupCategory: async (groupId, category) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      const newCat: GroupCategory = {
        ...category,
        id: `gcat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };

      await modifySyncBlob(groupId, gk, (groupData) => {
        groupData.categories.push(newCat);
      });

      await useGroupStore.getState().fetchGroupById(groupId);
    } catch (err: any) {
      set({ error: err.message });
      console.error('addGroupCategory failed:', err.message);
    }
  },

  removeGroupCategory: async (groupId, categoryId) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      await modifySyncBlob(groupId, gk, (groupData) => {
        groupData.categories = groupData.categories.filter((c) => c.id !== categoryId);
      });

      await useGroupStore.getState().fetchGroupById(groupId);
    } catch (err: any) {
      set({ error: err.message });
      console.error('removeGroupCategory failed:', err.message);
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
}));

onLogout(() => {
  useGroupStore.setState({
    groups: [],
    currentGroup: null,
    isLoading: false,
    error: null,
    groupDataVersions: {},
  });
  clearGroupKeyCache();
});
