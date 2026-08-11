import { SettlementStatus } from './enums';

export interface SettlementProposal {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  proposedAt: string;
  markedPaidAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  cancelledAt?: string;
  note?: string;
  relatedExpenseIds: string[];
  supersededBy?: string;
  /** Set when a settlement was partially paid and superseded by a remainder. */
  paidAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TransferProposal {
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  relatedExpenseIds: string[];
}

export interface MemberNetBalance {
  userId: string;
  currency: string;
  netAmount: number;
  owesTo: Record<string, number>;
  owedBy: Record<string, number>;
}

export interface SettlementActionResult {
  success: boolean;
  settlement?: SettlementProposal;
  remainderProposal?: SettlementProposal;
  error?: string;
  updatedBalances?: MemberNetBalance[];
}
