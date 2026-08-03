import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { apiClient } from '../lib/apiClient';
import { decryptData } from '../lib/crypto';
import { silentCatch } from '../lib/errorHandler';
import { onLogout } from '../lib/resetStores';
import { useLogStore } from './logStore';
import { GroupLogEventType } from '@coldfi/shared';
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
  clearGroupKey,
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

let activeFetchGroupId: string | null = null;

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
  createGroup: (name: string) => Promise<string>;
  joinGroup: (inviteCode: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  removeMember: (groupId: string, targetUserId: string) => Promise<void>;
  updateMemberRole: (groupId: string, targetUserId: string, role: 'admin' | 'member') => Promise<void>;
  generateInvite: (groupId: string) => Promise<{ code: string; inviteId: string; expiresIn: string; maxUses: number }>;
  fetchInvites: (groupId: string) => Promise<{ invites: Array<{ id: string; code: string; use_count: number; max_uses: number; expires_at: string; is_active: boolean; created_at: string }> }>;
  revokeInvite: (groupId: string, inviteId: string) => Promise<void>;
  updateGroupSettings: (groupId: string, settings: { name?: string; defaultCurrency?: string }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  addGroupCategory: (groupId: string, category: Pick<GroupCategory, 'name' | 'icon' | 'color'>) => Promise<void>;
  removeGroupCategory: (groupId: string, categoryId: string) => Promise<void>;
  addMemberFromSocket: (groupId: string, member: GroupMember) => void;
  removeMemberFromSocket: (groupId: string, userId: string) => void;
  updateGroupFromSocket: (group: GroupSummary) => void;
  incrementGroupDataVersion: (groupId: string) => void;
  clearError: () => void;
}

async function fetchGroupEncryptionKey(groupId: string): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/group/${groupId}/encryption-key`, {
      headers: { 'Authorization': `Bearer ${useAuthStore.getState().accessToken || ''}` },
    });
    if (res.ok) {
      const data = await res.json();
      return data.encryptionKey || null;
    }
  } catch { /* encryption key not available */ }
  return null;
}

async function computeGroupBalance(groupId: string, userId: string, defaultCurrency: string): Promise<number | null> {
  try {
    let gk = getGroupKey(groupId);
    if (!gk) {
      const ek = await fetchGroupEncryptionKey(groupId);
      if (ek) gk = await cacheGroupKey(groupId, ek);
    }
    if (!gk) return null;

    const syncRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/group/${groupId}/sync`, {
      headers: { 'Authorization': `Bearer ${useAuthStore.getState().accessToken || ''}` },
    });
    if (!syncRes.ok) return null;
    const syncData = await syncRes.json();
    if (!syncData.encryptedBlob) return null;

    const decrypted = await decryptData(gk, syncData.encryptedBlob);
    const parsed: GroupSyncData = migrateGroupBlob(JSON.parse(decrypted)) as unknown as GroupSyncData;
    const expenses = parsed.expenses || [];
    const settlements = parsed.settlements || [];

    const memberIdsSet = new Set<string>([userId]);
    for (const exp of expenses) {
      memberIdsSet.add(exp.paidBy || exp.payerId || '');
      for (const s of exp.splits) memberIdsSet.add(s.userId);
    }
    for (const st of settlements) {
      memberIdsSet.add(st.fromUserId);
      memberIdsSet.add(st.toUserId);
    }
    const memberIds = Array.from(memberIdsSet);

    const engineExpenses = toEngineExpenses(expenses, groupId, defaultCurrency);
    const engineSettlements = toEngineSettlements(settlements);
    const balances = computeNetBalances(engineExpenses, engineSettlements, memberIds);
    return balances.find((b) => b.userId === userId)?.net ?? 0;
  } catch {
    return null;
  }
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

      const currentUserId = useAuthStore.getState().userId || '';
      const groupIds = (data.groups as GroupSummary[]).map(g => g.id);
      const balanceResults = await Promise.allSettled(
        (data.groups as GroupSummary[]).map(g =>
          computeGroupBalance(g.id, currentUserId, g.defaultCurrency)
        )
      );
      const balanceMap: Record<string, number> = {};
      for (let i = 0; i < groupIds.length; i++) {
        const result = balanceResults[i];
        if (result?.status === 'fulfilled' && result.value !== null) {
          balanceMap[groupIds[i]!] = result.value;
        }
      }
      if (Object.keys(balanceMap).length > 0) {
        set((state) => ({
          groups: state.groups.map((grp) =>
            balanceMap[grp.id] !== undefined ? { ...grp, yourBalance: balanceMap[grp.id]! } : grp
          ),
        }));
      }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch groups',
      });
    }
  },

  fetchGroupById: async (id: string) => {
    if (!useAuthStore.getState().accessToken) return;

    activeFetchGroupId = id;
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
          let gk = getGroupKey(id);
          if (!gk) {
            const ek = await fetchGroupEncryptionKey(id);
            if (ek) gk = await cacheGroupKey(id, ek);
          }
          if (gk) {
            try {
              const decrypted = await decryptData(gk, syncData.encryptedBlob);
              const parsed: any = migrateGroupBlob(JSON.parse(decrypted));
              settlements = parsed.settlements || [];
              expenses = parsed.expenses || [];
              groupCategories = parsed.categories || [];
            } catch (err) {
              // Key may be stale after rotation — try fetching fresh encryption key
              try {
                const ek = await fetchGroupEncryptionKey(id);
                if (ek) {
                  const newKey = await cacheGroupKey(id, ek);
                  const decrypted = await decryptData(newKey, syncData.encryptedBlob);
                  const parsed: any = migrateGroupBlob(JSON.parse(decrypted));
                  settlements = parsed.settlements || [];
                  expenses = parsed.expenses || [];
                  groupCategories = parsed.categories || [];
                }
              } catch { silentCatch('groupStore.blobDecrypt', err); }
            }
          }
        }
      }

      const defaultCurrency = data.defaultCurrency;
      const memberIdsSet = new Set<string>(data.members.map((m: GroupMember) => m.userId));
      for (const exp of expenses) {
        memberIdsSet.add(exp.paidBy || exp.payerId || '');
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

      if (activeFetchGroupId !== id) return;

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
      if (activeFetchGroupId === id) {
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch group',
        });
      }
    }
  },

  createGroup: async (name: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const defaultCurrency = useAuthStore.getState().defaultCurrency;

      const res = await apiClient('/api/group/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, defaultCurrency }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create group');
      }

      const data = await res.json();
      set({ isLoading: false });

      // Fetch encryption key for this group
      const ek = await fetchGroupEncryptionKey(data.groupId);
      if (ek) await cacheGroupKey(data.groupId, ek);

      const cgActorId = useAuthStore.getState().userId || '';
      const cgActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(data.groupId, {
        eventType: GroupLogEventType.MEMBER_JOINED,
        actorId: cgActorId,
        actorName: cgActorName,
        action: `Created group: ${name}`,
        actionType: 'settings', details: 'Group created',
      });

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

  joinGroup: async (inviteCode: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const res = await apiClient('/api/group/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join group');
      }

      const data = await res.json();
      set({ isLoading: false });

      // Fetch encryption key for the newly joined group
      const ek = await fetchGroupEncryptionKey(data.groupId);
      if (ek) await cacheGroupKey(data.groupId, ek);

      const jgActorId = useAuthStore.getState().userId || '';
      const jgActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(data.groupId, {
        eventType: GroupLogEventType.MEMBER_JOINED,
        actorId: jgActorId,
        actorName: jgActorName,
        action: `Joined group via invite`,
        actionType: 'member', details: `Joined group ${data.groupId}`,
      });

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

      clearGroupKey(groupId);
      set({ isLoading: false, currentGroup: null });

      const lgActorId = useAuthStore.getState().userId || '';
      const lgActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.MEMBER_LEFT,
        actorId: lgActorId,
        actorName: lgActorName,
        action: `Left group`,
        actionType: 'member', details: 'Left group voluntarily',
      });

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

  removeMember: async (groupId: string, targetUserId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    const res = await apiClient(`/api/group/${groupId}/members/${targetUserId}`, { method: 'DELETE' });
    if (!res.ok) { const data = await res.json(); throw new Error(data.message || 'Failed to remove member'); }

    const result = await res.json();

    // The server re-encrypts the blob with the rotated key; just refresh our local
    // key cache so the admin can keep decrypting group data immediately.
    if (result.newEncryptionKey) {
      await cacheGroupKey(groupId, result.newEncryptionKey);
    }

    const rmActorId = useAuthStore.getState().userId || '';
    const rmActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
    useLogStore.getState().addLogEntry(groupId, {
      eventType: GroupLogEventType.MEMBER_REMOVED,
      actorId: rmActorId,
      actorName: rmActorName,
      action: `Removed member: ${targetUserId}`,
      actionType: 'member', details: `Removed user ${targetUserId} from group`,
      targetId: targetUserId,
    });

    await useGroupStore.getState().fetchGroupById(groupId);
  },

  updateMemberRole: async (groupId: string, targetUserId: string, role: 'admin' | 'member') => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    const res = await apiClient(`/api/group/${groupId}/members/${targetUserId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) { const data = await res.json(); throw new Error(data.message || 'Failed to update role'); }
    const urActorId = useAuthStore.getState().userId || '';
    const urActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
    useLogStore.getState().addLogEntry(groupId, {
      eventType: GroupLogEventType.ADMIN_ACTION,
      actorId: urActorId,
      actorName: urActorName,
      action: `Changed role of ${targetUserId} to ${role}`,
      actionType: 'settings', details: `Updated member ${targetUserId} role to ${role}`,
      targetId: targetUserId,
      metadata: { role },
    });
    await useGroupStore.getState().fetchGroupById(groupId);
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
      set((state) => ({
        currentGroup: state.currentGroup && state.currentGroup.id === groupId
          ? { ...state.currentGroup, ...settings }
          : state.currentGroup,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update group settings' });
      throw error;
    }
  },

  deleteGroup: async (groupId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient(`/api/group/${groupId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete group');
      }
      set({ currentGroup: null, isLoading: false });
      const state = useGroupStore.getState();
      await state.fetchGroups();
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Failed to delete group' });
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

      const caActorId = useAuthStore.getState().userId || '';
      const caActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.CATEGORY_ADDED,
        actorId: caActorId,
        actorName: caActorName,
        action: `Added category: ${category.name}`,
        actionType: 'settings', details: `Added category "${category.name}"`,
        metadata: { categoryName: category.name },
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

      const cdActorId = useAuthStore.getState().userId || '';
      const cdActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.CATEGORY_DELETED,
        actorId: cdActorId,
        actorName: cdActorName,
        action: `Removed category`,
        actionType: 'settings', details: `Removed category ${categoryId}`,
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
    const cloned = { ...group };
    set((state) => ({
      groups: state.groups.map((g) => (g.id === cloned.id ? cloned : g)),
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
