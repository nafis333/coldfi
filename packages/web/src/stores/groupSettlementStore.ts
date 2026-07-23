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
  SettlementStatus,
  GroupLogEventType,
} from '@coldfi/shared';
import { onLogout } from '../lib/resetStores';
import { useLogStore } from './logStore';

interface GroupSettlementState {
  isLoading: boolean;
  error: string | null;

  proposeSettlement: (groupId: string, data: SettlementInput) => Promise<void>;
  markSettlementAsPaid: (groupId: string, settlementId: string, paidAmount?: number) => Promise<void>;
  acceptSettlement: (groupId: string, settlementId: string) => Promise<void>;
  rejectSettlement: (groupId: string, settlementId: string) => Promise<void>;
  cancelSettlement: (groupId: string, settlementId: string) => Promise<void>;
  clearError: () => void;
}

export const useGroupSettlementStore = create<GroupSettlementState>((set) => ({
  isLoading: false,
  error: null,

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
      const sRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      createGroupNotification('settlement_proposed', 'Settlement Proposed', `${data.amount.toFixed(2)} settlement proposed`, groupId, undefined, sRecipients);
      const sActorId = useAuthStore.getState().userId || '';
      const sActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.SETTLEMENT_PROPOSED,
        actorId: sActorId,
        actorName: sActorName,
        action: `Settlement proposed: ${data.amount.toFixed(2)} from user ${data.fromUserId} to ${data.toUserId}`,
        actionType: 'settlement', details: `${data.amount.toFixed(2)} settlement proposed`,
        targetId: data.fromUserId,
        metadata: { amount: data.amount },
      });
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
      const mpRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      createGroupNotification('settlement_marked_paid', 'Settlement Marked Paid', 'A settlement has been marked as paid', groupId, settlementId, mpRecipients);
      const mpActorId = useAuthStore.getState().userId || '';
      const mpActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.SETTLEMENT_MARKED_PAID,
        actorId: mpActorId,
        actorName: mpActorName,
        action: `Settlement marked paid: ${settlementId}`,
        actionType: 'settlement', details: `Marked settlement ${settlementId} as paid`,
        targetId: settlementId,
      });
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
      const acRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      createGroupNotification('settlement_confirmed', 'Settlement Confirmed', 'A settlement has been approved', groupId, settlementId, acRecipients);
      const acActorId = useAuthStore.getState().userId || '';
      const acActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.SETTLEMENT_APPROVED,
        actorId: acActorId,
        actorName: acActorName,
        action: `Settlement approved: ${settlementId}`,
        actionType: 'settlement', details: `Approved settlement ${settlementId}`,
        targetId: settlementId,
      });
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
      const rjRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      createGroupNotification('settlement_rejected', 'Settlement Rejected', 'A settlement has been rejected', groupId, settlementId, rjRecipients);
      const rjActorId = useAuthStore.getState().userId || '';
      const rjActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.SETTLEMENT_REJECTED,
        actorId: rjActorId,
        actorName: rjActorName,
        action: `Settlement rejected: ${settlementId}`,
        actionType: 'settlement', details: `Rejected settlement ${settlementId}`,
        targetId: settlementId,
      });
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
      const cnRecipients = useGroupStore.getState().currentGroup?.members.filter(m => !m.leftAt).map(m => m.userId);
      createGroupNotification('settlement_cancelled', 'Settlement Cancelled', 'A settlement proposal was cancelled', groupId, settlementId, cnRecipients);
      const cnActorId = useAuthStore.getState().userId || '';
      const cnActorName = useAuthStore.getState().displayName || useAuthStore.getState().email || '';
      useLogStore.getState().addLogEntry(groupId, {
        eventType: GroupLogEventType.SETTLEMENT_CANCELLED,
        actorId: cnActorId,
        actorName: cnActorName,
        action: `Settlement cancelled: ${settlementId}`,
        actionType: 'settlement', details: `Cancelled settlement ${settlementId}`,
        targetId: settlementId,
      });
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
