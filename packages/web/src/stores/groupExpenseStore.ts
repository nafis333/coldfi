import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { apiClient } from '../lib/apiClient';
import {
  getGroupKey,
  modifySyncBlob,
  createGroupNotification,
  GroupExpenseInput,
  GroupExpenseData,
  GroupCategory,
  GroupSummary,
  migrateGroupBlob,
} from '../lib/groupSync';
import { decryptData, encryptData } from '../lib/crypto';
import { SplitMode, GroupLogEventType } from '@coldfi/shared';
import { silentCatch } from '../lib/errorHandler';
import { onLogout } from '../lib/resetStores';
import { useLogStore } from './logStore';

interface GroupExpenseState {
  groupExpensesCache: Record<string, { name: string; expenses: GroupExpenseData[]; currency: string }>;
  isLoading: boolean;
  error: string | null;

  createGroupExpense: (groupId: string, data: GroupExpenseInput) => Promise<void>;
  deleteGroupExpense: (groupId: string, expenseId: string) => Promise<void>;
  updateGroupExpense: (groupId: string, expenseId: string, data: Partial<GroupExpenseInput>) => Promise<void>;
  fetchAllGroupExpenses: () => Promise<void>;
  clearError: () => void;
}

export const useGroupExpenseStore = create<GroupExpenseState>((set) => ({
  groupExpensesCache: {},
  isLoading: false,
  error: null,

  createGroupExpense: async (groupId: string, data: GroupExpenseInput) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) throw new Error('Expense amount must be a positive number');

    set({ isLoading: true, error: null });

    try {
      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available.');

      const { useGroupStore } = await import('./groupStore');
      const groupMembers = useGroupStore.getState().currentGroup?.members;
      if (!groupMembers) throw new Error('Group data not loaded');

      const memberIds = groupMembers.map((m) => m.userId);

      if (data.splitMode && data.splitParams) {
        const { calculateSplits: engineCalculateSplits } = await import('@coldfi/shared');
        const engineResult = engineCalculateSplits({
          totalAmount: data.amount,
          splitMode: data.splitMode,
          memberIds,
          ...(data.splitMode === SplitMode.RATIO
            ? { ratios: data.splitParams }
            : { fixedAmounts: data.splitParams }),
        });

        for (const computed of engineResult.splits) {
          const submitted = data.splits.find((s) => s.userId === computed.memberId);
          if (submitted) {
            if (Math.abs(submitted.amount - computed.amount) > 0.02) {
              throw new Error(
                `Split mismatch for member ${computed.memberId}: submitted ${submitted.amount.toFixed(2)}, ` +
                `engine computed ${computed.amount.toFixed(2)}`
              );
            }
          } else if (computed.amount > 0.01) {
            throw new Error(`Missing split for member ${computed.memberId}: ${computed.amount.toFixed(2)}`);
          }
        }
      } else {
        const splitTotal = data.splits.reduce((sum, s) => sum + s.amount, 0);
        if (Math.abs(splitTotal - data.amount) > 0.01) {
          throw new Error(`Split total (${splitTotal.toFixed(2)}) must equal expense amount (${data.amount.toFixed(2)})`);
        }
      }

      if (data.itemized && data.itemized.length > 0) {
        const itemTotal = data.itemized.reduce((sum, i) => sum + i.amount, 0);
        if (Math.abs(itemTotal - data.amount) > 0.01) {
          throw new Error(`Itemized total (${itemTotal.toFixed(2)}) must equal expense amount (${data.amount.toFixed(2)})`);
        }
      }

      const groupName = useGroupStore.getState().currentGroup?.name || 'group';
      const shortName = groupName.trim() ? groupName.split(' ').map((w: string) => w[0] || '').join('').toLowerCase().slice(0, 6) : 'g';
      const defaultCurrency = useGroupStore.getState().currentGroup?.defaultCurrency || useAuthStore.getState().defaultCurrency;
      const now = new Date().toISOString();

      let created = false;
      let lastError: Error | null = null;
      let latestDisplayId = '';
      let latestExpenseId = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const syncRes = await apiClient(`/api/group/${groupId}/sync`);
          if (!syncRes.ok) throw new Error(`Failed to fetch group data: ${syncRes.status}`);

          const syncData = await syncRes.json();
          const vectorClock = syncData.vectorClock || {};

          let groupData: { expenses: GroupExpenseData[]; settlements: any[]; categories: GroupCategory[] } = { expenses: [], settlements: [], categories: [] };

          if (syncData.encryptedBlob) {
            const decrypted = await decryptData(gk, syncData.encryptedBlob);
            groupData = migrateGroupBlob(JSON.parse(decrypted)) as typeof groupData;
          }

          const existing = groupData.expenses.filter((e) => e.displayId?.startsWith(`#${shortName}`));
          let nextNum = 1;
          for (const e of existing) {
            const match = e.displayId!.match(/-(\d+)$/);
            if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n)) nextNum = Math.max(nextNum, n + 1);
            }
          }
          const displayId = `#${shortName}-${String(nextNum).padStart(3, '0')}`;

          const expenseId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          if (groupData.expenses.some((e) => e.id === expenseId)) {
            throw new Error('Expense ID collision — please retry');
          }
          latestDisplayId = displayId;
          latestExpenseId = expenseId;
          groupData.expenses.push({
            ...data,
            categoryId: data.category || data.categoryId || '',
            paidBy: data.payerId || data.paidBy || '',
            date: now.split('T')[0],
            displayId,
            createdAt: now,
            updatedAt: now,
            id: expenseId,
          });

          const encrypted = await encryptData(gk, JSON.stringify(groupData));

          const putRes = await apiClient(`/api/group/${groupId}/sync`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
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

          created = true;
          break;
        } catch (e) {
          if (e instanceof Error && e.message !== 'Data conflict. Retrying...') {
            throw e;
          }
          lastError = e instanceof Error ? e : new Error('Failed to create expense');
        }
      }

      if (!created) throw lastError || new Error('Failed to save expense due to a data conflict. Please try again.');
      set({ isLoading: false });
      await useGroupStore.getState().fetchGroupById(groupId);
      const gExpNotificationRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      try {
        await createGroupNotification('expense_added', 'Expense Added', `New expense of ${data.amount} ${defaultCurrency}`, groupId, undefined, gExpNotificationRecipients);
      } catch { silentCatch('groupExpenseStore.notification', null); }
      const actorId = useAuthStore.getState().userId || '';
      const actorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      try {
        await useLogStore.getState().addLogEntry(groupId, {
          eventType: GroupLogEventType.EXPENSE_ADDED,
          actorId,
          actorName,
          action: `Added expense: ${data.description}`,
          actionType: 'expense',
          details: `${data.amount} ${defaultCurrency} via ${shortName}`,
          targetId: latestExpenseId,
          metadata: { amount: data.amount, description: data.description, category: data.categoryId || data.category || '' },
        });
      } catch { silentCatch('groupExpenseStore.log', null); }
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create expense',
      });
      throw error;
    }
  },

  deleteGroupExpense: async (groupId: string, expenseId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    const gk = getGroupKey(groupId);
    if (!gk) throw new Error('Group key not available');
    set({ isLoading: true, error: null });
    try {
      let deletedDesc = '';
      await modifySyncBlob(groupId, gk, (groupData) => {
        const found = groupData.expenses.find((e) => e.id === expenseId);
        if (found) deletedDesc = found.description;
        groupData.expenses = groupData.expenses.filter((e) => e.id !== expenseId);
      });
      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      set({ isLoading: false });
      const delActorId = useAuthStore.getState().userId || '';
      const delActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.EXPENSE_DELETED,
        actorId: delActorId,
        actorName: delActorName,
        action: `Deleted expense: ${deletedDesc || expenseId}`,
        actionType: 'expense',
        details: `Deleted expense ${expenseId}`,
        targetId: expenseId,
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to delete expense' });
      throw err;
    }
  },

  updateGroupExpense: async (groupId: string, expenseId: string, data: Partial<GroupExpenseInput>) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    const gk = getGroupKey(groupId);
    if (!gk) throw new Error('Group key not available');
    set({ isLoading: true, error: null });
    try {
      let oldDesc = '';
      await modifySyncBlob(groupId, gk, (groupData) => {
        const idx = groupData.expenses.findIndex((e) => e.id === expenseId);
        if (idx === -1) throw new Error('Expense not found');
        oldDesc = groupData.expenses[idx]!.description;
        groupData.expenses[idx] = { ...groupData.expenses[idx], ...data, updatedAt: new Date().toISOString() };
      });
      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      set({ isLoading: false });
      const updActorId = useAuthStore.getState().userId || '';
      const updActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.EXPENSE_EDITED,
        actorId: updActorId,
        actorName: updActorName,
        action: `Edited expense: ${oldDesc || expenseId}`,
        actionType: 'expense',
        details: `Updated expense ${expenseId}`,
        targetId: expenseId,
      });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to update expense' });
      throw err;
    }
  },

  fetchAllGroupExpenses: async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      const res = await apiClient('/api/group');
      if (!res.ok) return;
      const data = await res.json();
      const groups: GroupSummary[] = data.groups || [];

      const cache: Record<string, { name: string; expenses: GroupExpenseData[]; currency: string }> = {};

      for (const g of groups) {
        const gk = getGroupKey(g.id);
        if (!gk) continue;

        try {
          const syncRes = await apiClient(`/api/group/${g.id}/sync`);
          if (!syncRes.ok) continue;
          const syncData = await syncRes.json();
          if (!syncData.encryptedBlob) continue;

          const decrypted = await decryptData(gk, syncData.encryptedBlob);
          const parsed: any = migrateGroupBlob(JSON.parse(decrypted));
          cache[g.id] = {
            name: g.name,
            expenses: parsed.expenses || [],
            currency: parsed.settings?.defaultCurrency || useAuthStore.getState().defaultCurrency,
          };
        } catch (err) {
          silentCatch('groupExpenseStore.decryptGroup', err);
        }
      }

      set({ groupExpensesCache: cache });
    } catch (err) {
      silentCatch('groupExpenseStore.fetchAll', err);
      console.error('[groupExpenseStore] fetchAllGroupExpenses failed');
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  useGroupExpenseStore.setState({
    groupExpensesCache: {},
    isLoading: false,
    error: null,
  });
});
