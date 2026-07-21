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
import { decryptData } from '../lib/crypto';
import { SplitMode } from '@coldfi/shared';
import { onLogout } from '../lib/resetStores';

interface GroupExpenseState {
  groupExpensesCache: Record<string, { name: string; expenses: GroupExpenseData[]; currency: string }>;
  isLoading: boolean;
  error: string | null;

  createGroupExpense: (groupId: string, data: GroupExpenseInput) => Promise<void>;
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
      if (!gk) throw new Error('Group key not available. Please re-enter the group passphrase.');

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
      const shortName = groupName.split(' ').map((w: string) => w[0]).join('').toLowerCase().slice(0, 6);
      const defaultCurrency = useGroupStore.getState().currentGroup?.defaultCurrency || useAuthStore.getState().defaultCurrency;
      const now = new Date().toISOString();

      let created = false;
      let lastError: Error | null = null;
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
          const nextNum = existing.length + 1;
          const displayId = `#${shortName}-${String(nextNum).padStart(3, '0')}`;

          const expenseId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          if (groupData.expenses.some((e) => e.id === expenseId)) {
            throw new Error('Expense ID collision — please retry');
          }
          groupData.expenses.push({
            ...data,
            date: now.split('T')[0],
            displayId,
            createdAt: now,
            id: expenseId,
          });

          const { encryptData } = await import('../lib/crypto');
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

      if (!created) throw lastError || new Error('Failed to create expense after retries');
      set({ isLoading: false });
      useGroupStore.getState().fetchGroupById(groupId).catch(() => {});
      createGroupNotification('expense_added', 'Expense Added', `New expense of ${data.amount} ${defaultCurrency}`, groupId);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create expense',
      });
      throw error;
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
        } catch {
          // skip groups that fail to decrypt
        }
      }

      set({ groupExpensesCache: cache });
    } catch {
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
