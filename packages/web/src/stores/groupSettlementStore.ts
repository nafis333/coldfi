import { create } from 'zustand';
import { useAuthStore } from './authStore';
import {
  getGroupKey,
  modifySyncBlob,
  createGroupNotification,
  SettlementData,
  SettlementInput,
} from '../lib/groupSync';
import {
  proposeSettlement as enginePropose,
  markAsPaid as engineMarkAsPaid,
  confirmReceipt as engineConfirmReceipt,
  rejectPayment as engineRejectPayment,
  cancelProposal as engineCancelProposal,
  findDuplicateProposal as engineFindDuplicate,
  getValidTransitions as engineGetValidTransitions,
  forceSettleOnLeave as engineForceSettle,
  SettlementStatus,
} from '@coldfi/shared';
import { onLogout } from '../lib/resetStores';

interface GroupSettlementState {
  isLoading: boolean;
  error: string | null;

  proposeSettlement: (groupId: string, data: SettlementInput) => Promise<void>;
  forceSettleLeavingMember: (groupId: string, leavingUserId: string) => Promise<void>;
  markSettlementAsPaid: (groupId: string, settlementId: string, paidAmount?: number) => Promise<void>;
  acceptSettlement: (groupId: string, settlementId: string) => Promise<void>;
  rejectSettlement: (groupId: string, settlementId: string) => Promise<void>;
  cancelSettlement: (groupId: string, settlementId: string) => Promise<void>;
  clearError: () => void;
}

export const useGroupSettlementStore = create<GroupSettlementState>((set) => ({
  isLoading: false,
  error: null,

  forceSettleLeavingMember: async (groupId: string, leavingUserId: string) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');
    const gk = getGroupKey(groupId);
    if (!gk) throw new Error('Group key not available');
    const { useGroupStore } = await import('./groupStore');
    const state = useGroupStore.getState();
    const currentGroup = state.currentGroup;
    if (!currentGroup) throw new Error('Group data not loaded');
    const balanceArr = currentGroup.balances as Array<{ userId: string; owesTo: Record<string, number>; owedBy: Record<string, number> }> | undefined;
    const leavingBalance = balanceArr?.find((b) => b.userId === leavingUserId);
    if (!leavingBalance) return;
    const currency = currentGroup.defaultCurrency || useAuthStore.getState().defaultCurrency;

    await modifySyncBlob(groupId, gk, (groupData) => {
      const settlements = groupData.settlements || [];
      for (const [otherId, amtStr] of Object.entries(leavingBalance.owesTo)) {
        const amt = amtStr as number;
        if (amt <= 0.01) continue;
        const id = `stl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const settled = engineForceSettle({
          id, groupId, fromUserId: leavingUserId, toUserId: otherId,
          amount: Math.round(amt * 100) / 100, currency,
          note: `Auto-settled: ${leavingUserId.slice(0, 8)} left the group`,
        });
        settlements.push(settled as SettlementData);
      }
      for (const [otherId, amtStr] of Object.entries(leavingBalance.owedBy)) {
        const amt = amtStr as number;
        if (amt <= 0.01) continue;
        const id = `stl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const settled = engineForceSettle({
          id, groupId, fromUserId: otherId, toUserId: leavingUserId,
          amount: Math.round(amt * 100) / 100, currency,
          note: `Auto-settled: ${leavingUserId.slice(0, 8)} left the group`,
        });
        settlements.push(settled as SettlementData);
      }
      groupData.settlements = settlements;
    });
    await useGroupStore.getState().fetchGroupById(groupId);
  },

  proposeSettlement: async (groupId: string, data: SettlementInput) => {
    if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

    set({ isLoading: true, error: null });

    try {
      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available. Please re-enter the group passphrase.');

      const { useGroupStore } = await import('./groupStore');
      const state = useGroupStore.getState();
      const group = state.groups.find((g) => g.id === groupId);
      const currentGroup = state.currentGroup;
      const currency = data.currency || currentGroup?.defaultCurrency || useAuthStore.getState().defaultCurrency;

      await modifySyncBlob(groupId, gk, (groupData) => {
        const duplicate = engineFindDuplicate(groupData.settlements, data.fromUserId, data.toUserId);
        if (duplicate) {
          throw new Error('A pending settlement already exists between these members');
        }

        const proposal = enginePropose({
          id: `stl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          groupId,
          fromUserId: data.fromUserId,
          toUserId: data.toUserId,
          amount: data.amount,
          currency,
          relatedExpenseIds: data.relatedExpenseIds,
          note: data.note,
        });

        groupData.settlements.push(proposal as SettlementData);
      });

      await useGroupStore.getState().fetchGroupById(groupId);
      set({ isLoading: false });
      createGroupNotification('settlement_proposed', 'Settlement Proposed', `${data.amount.toFixed(2)} settlement proposed`, groupId);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to propose settlement',
      });
      throw error;
    }
  },

  markSettlementAsPaid: async (groupId: string, settlementId: string, paidAmount?: number) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const currentUserId = useAuthStore.getState().userId;
      if (!currentUserId) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      await modifySyncBlob(groupId, gk, (groupData) => {
        const s = groupData.settlements.find((s: any) => s.id === settlementId);
        if (!s) throw new Error('Settlement not found');

        if (s.fromUserId !== currentUserId) {
          throw new Error('Only the debtor can mark a settlement as paid');
        }

        const validNext = engineGetValidTransitions(s.status as SettlementStatus);
        if (!validNext.includes(SettlementStatus.MARKED_PAID)) {
          throw new Error(`Cannot mark as paid from current status (${s.status})`);
        }

        const result = engineMarkAsPaid(s, paidAmount);
        if (!result.success) {
          throw new Error(result.error || 'Failed to mark settlement as paid');
        }

        const idx = groupData.settlements.findIndex((x: any) => x.id === settlementId);
        groupData.settlements[idx] = result.settlement! as any;

        if (result.remainderProposal) {
          groupData.settlements.push(result.remainderProposal as any);
        }
      });

      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      createGroupNotification('settlement_marked_paid', 'Settlement Marked Paid', 'A settlement has been marked as paid', groupId, settlementId);
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to mark settlement as paid' });
    }
  },

  acceptSettlement: async (groupId: string, settlementId: string) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const currentUserId = useAuthStore.getState().userId;
      if (!currentUserId) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      await modifySyncBlob(groupId, gk, (groupData) => {
        const s = groupData.settlements.find((s: any) => s.id === settlementId);
        if (!s) throw new Error('Settlement not found');

        if (s.toUserId !== currentUserId) {
          throw new Error('Only the recipient can confirm receipt of a settlement');
        }

        const validNext = engineGetValidTransitions(s.status as SettlementStatus);
        if (!validNext.includes(SettlementStatus.APPROVED)) {
          throw new Error(`Cannot accept from current status (${s.status})`);
        }

        const result = engineConfirmReceipt(s);
        if (!result.success) {
          throw new Error(result.error || 'Failed to confirm receipt');
        }

        const idx = groupData.settlements.findIndex((x: any) => x.id === settlementId);
        groupData.settlements[idx] = result.settlement! as any;
      });

      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      createGroupNotification('settlement_confirmed', 'Settlement Confirmed', 'A settlement has been approved', groupId, settlementId);
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to accept settlement' });
    }
  },

  rejectSettlement: async (groupId: string, settlementId: string) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const currentUserId = useAuthStore.getState().userId;
      if (!currentUserId) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      await modifySyncBlob(groupId, gk, (groupData) => {
        const s = groupData.settlements.find((s: any) => s.id === settlementId);
        if (!s) throw new Error('Settlement not found');

        if (s.toUserId !== currentUserId) {
          throw new Error('Only the recipient can reject a settlement');
        }

        const validNext = engineGetValidTransitions(s.status as SettlementStatus);
        if (!validNext.includes(SettlementStatus.REJECTED)) {
          throw new Error(`Cannot reject from current status (${s.status})`);
        }

        const result = engineRejectPayment(s);
        if (!result.success) {
          throw new Error(result.error || 'Failed to reject settlement');
        }

        const idx = groupData.settlements.findIndex((x: any) => x.id === settlementId);
        groupData.settlements[idx] = result.settlement! as any;
      });

      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      createGroupNotification('settlement_rejected', 'Settlement Rejected', 'A settlement has been rejected', groupId, settlementId);
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to reject settlement' });
    }
  },

  cancelSettlement: async (groupId: string, settlementId: string) => {
    try {
      if (!useAuthStore.getState().accessToken) throw new Error('Not authenticated');

      const currentUserId = useAuthStore.getState().userId;
      if (!currentUserId) throw new Error('Not authenticated');

      const gk = getGroupKey(groupId);
      if (!gk) throw new Error('Group key not available');

      await modifySyncBlob(groupId, gk, (groupData) => {
        const s = groupData.settlements.find((s: any) => s.id === settlementId);
        if (!s) throw new Error('Settlement not found');

        const validNext = engineGetValidTransitions(s.status as SettlementStatus);
        if (!validNext.includes(SettlementStatus.CANCELLED)) {
          throw new Error(`Cannot cancel from current status (${s.status})`);
        }

        const result = engineCancelProposal(s, currentUserId);
        if (!result.success) {
          throw new Error(result.error || 'Failed to cancel settlement');
        }

        const idx = groupData.settlements.findIndex((x: any) => x.id === settlementId);
        groupData.settlements[idx] = result.settlement! as any;
      });

      const { useGroupStore } = await import('./groupStore');
      await useGroupStore.getState().fetchGroupById(groupId);
      createGroupNotification('settlement_rejected', 'Settlement Cancelled', 'A settlement proposal was cancelled', groupId, settlementId);
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Failed to cancel settlement' });
    }
  },

  clearError: () => set({ error: null }),
}));

onLogout(() => {
  useGroupSettlementStore.setState({
    isLoading: false,
    error: null,
  });
});
