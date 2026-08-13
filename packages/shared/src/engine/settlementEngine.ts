import { SettlementProposal, SettlementActionResult } from '../types/settlement';
import { SettlementStatus } from '../types/enums';

export interface ProposeSettlementInput {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  relatedExpenseIds?: string[];
  note?: string;
}

export function proposeSettlement(input: ProposeSettlementInput): SettlementProposal {
  if (typeof input.amount !== 'number' || isNaN(input.amount) || !isFinite(input.amount) || input.amount <= 0) {
    throw new Error(`Invalid settlement amount: ${input.amount}`);
  }
  const now = new Date().toISOString();
  return {
    id: input.id,
    groupId: input.groupId,
    fromUserId: input.fromUserId,
    toUserId: input.toUserId,
    amount: input.amount,
    currency: input.currency,
    status: SettlementStatus.PROPOSED,
    proposedAt: now,
    note: input.note,
    relatedExpenseIds: input.relatedExpenseIds || [],
    createdAt: now,
    updatedAt: now,
  };
}

export function markAsPaid(
  settlement: SettlementProposal,
  paidAmount?: number
): SettlementActionResult {
  if (settlement.status !== SettlementStatus.PROPOSED) {
    return {
      success: false,
      error: `Cannot mark as paid: current status is ${settlement.status}`,
    };
  }

  const now = new Date().toISOString();

  if (paidAmount !== undefined) {
    if (typeof paidAmount !== 'number' || isNaN(paidAmount) || !isFinite(paidAmount) || paidAmount <= 0) {
      return { success: false, error: 'Paid amount must be a valid positive number' };
    }
    if (paidAmount > settlement.amount) {
      return { success: false, error: 'Paid amount cannot exceed the settlement amount' };
    }
    if (paidAmount < settlement.amount) {
      const remainder = Math.round((settlement.amount - paidAmount) * 100) / 100;

      const superseded: SettlementProposal = {
        ...settlement,
        status: SettlementStatus.SUPERSEDED,
        paidAmount,
        markedPaidAt: now,
        updatedAt: now,
      };

      const newProposal: SettlementProposal = {
        id: `${settlement.id}-partial-${Date.now()}`,
        groupId: settlement.groupId,
        fromUserId: settlement.fromUserId,
        toUserId: settlement.toUserId,
        amount: remainder,
        currency: settlement.currency,
        status: SettlementStatus.PROPOSED,
        proposedAt: now,
        note: `Partial remainder of ${settlement.id}`,
        relatedExpenseIds: settlement.relatedExpenseIds,
        createdAt: now,
        updatedAt: now,
      };

      return {
        success: true,
        settlement: superseded,
        remainderProposal: newProposal,
      };
    }
  }

  const updated: SettlementProposal = {
    ...settlement,
    status: SettlementStatus.MARKED_PAID,
    markedPaidAt: now,
    updatedAt: now,
  };

  return { success: true, settlement: updated };
}

export function confirmReceipt(
  settlement: SettlementProposal
): SettlementActionResult {
  if (settlement.status !== SettlementStatus.MARKED_PAID) {
    return {
      success: false,
      error: `Cannot confirm receipt: current status is ${settlement.status}`,
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementProposal = {
    ...settlement,
    status: SettlementStatus.APPROVED,
    approvedAt: now,
    updatedAt: now,
  };

  return { success: true, settlement: updated };
}

export function rejectPayment(
  settlement: SettlementProposal,
  reason?: string
): SettlementActionResult {
  if (settlement.status !== SettlementStatus.MARKED_PAID) {
    return {
      success: false,
      error: `Cannot reject: current status is ${settlement.status}`,
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementProposal = {
    ...settlement,
    status: SettlementStatus.REJECTED,
    rejectedAt: now,
    note: reason || settlement.note,
    updatedAt: now,
  };

  return { success: true, settlement: updated };
}

export function rejectProposal(
  settlement: SettlementProposal,
  userId: string,
  reason?: string
): SettlementActionResult {
  if (settlement.status !== SettlementStatus.PROPOSED) {
    return {
      success: false,
      error: `Cannot reject proposal: current status is ${settlement.status}`,
    };
  }

  if (settlement.toUserId !== userId) {
    return {
      success: false,
      error: 'Only the recipient can reject a proposal',
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementProposal = {
    ...settlement,
    status: SettlementStatus.REJECTED,
    rejectedAt: now,
    note: reason || settlement.note,
    updatedAt: now,
  };

  return { success: true, settlement: updated };
}

export function cancelProposal(
  settlement: SettlementProposal,
  userId: string
): SettlementActionResult {
  if (settlement.status !== SettlementStatus.PROPOSED) {
    return {
      success: false,
      error: `Cannot cancel: current status is ${settlement.status}`,
    };
  }

  if (settlement.fromUserId !== userId) {
    return {
      success: false,
      error: 'Only the proposer can cancel a settlement',
    };
  }

  const now = new Date().toISOString();
  const updated: SettlementProposal = {
    ...settlement,
    status: SettlementStatus.CANCELLED,
    cancelledAt: now,
    updatedAt: now,
  };

  return { success: true, settlement: updated };
}

export function findDuplicateProposal(
  settlements: SettlementProposal[],
  fromUserId: string,
  toUserId: string,
  groupId?: string
): SettlementProposal | undefined {
  return settlements.find(
    (s) =>
      s.fromUserId === fromUserId &&
      s.toUserId === toUserId &&
      s.status === SettlementStatus.PROPOSED &&
      (!groupId || s.groupId === groupId)
  );
}

export function getValidTransitions(
  currentStatus: SettlementStatus
): SettlementStatus[] {
  switch (currentStatus) {
    case SettlementStatus.PROPOSED:
      return [SettlementStatus.MARKED_PAID, SettlementStatus.CANCELLED, SettlementStatus.REJECTED];
    case SettlementStatus.MARKED_PAID:
      return [SettlementStatus.APPROVED, SettlementStatus.REJECTED];
    default:
      return [];
  }
}
