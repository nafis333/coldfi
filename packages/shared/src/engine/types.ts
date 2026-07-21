import { GroupLogEventType } from '../types/enums';
import type { GroupLogEntry } from './logManager';

export { GroupLogEventType };
export type { GroupLogEntry };

export interface ExpenseAddedMeta {
  createdBy: string;
  description: string;
  amount: number;
  currency: string;
}

export interface ExpenseEditedMeta {
  description: string;
  editedBy: string;
  changes: Record<string, string>;
}

export interface ExpenseDeletedMeta {
  description: string;
  amount: number;
  currency: string;
  deletedBy: string;
}

export interface SettlementProposedMeta {
  payerName: string;
  payeeName: string;
  amount: number;
  currency: string;
}

export interface SettlementMarkedPaidMeta {
  payerName: string;
  payeeName: string;
  amount: number;
  currency: string;
}

export interface SettlementApprovedMeta {
  payerName: string;
  payeeName: string;
  amount: number;
  currency: string;
}

export interface SettlementRejectedMeta {
  payerName: string;
  payeeName: string;
  amount: number;
  currency: string;
  rejectedBy: string;
}

export interface SettlementCancelledMeta {
  payerName: string;
  payeeName: string;
  amount: number;
  currency: string;
  cancelledBy: string;
}

export interface MemberJoinedMeta {
  memberName: string;
  role: string;
}

export interface MemberLeftMeta {
  memberName: string;
}

export interface MemberRemovedMeta {
  memberName: string;
  removedBy: string;
}

export interface CategoryAddedMeta {
  categoryName: string;
  addedBy: string;
}

export interface CategoryRatioChangedMeta {
  categoryName: string;
  changedBy: string;
}

export interface CategoryDeletedMeta {
  categoryName: string;
  deletedBy: string;
}

export interface RecurringBillCreatedMeta {
  description: string;
  amount: number;
  currency: string;
  createdBy: string;
}

export interface RecurringBillDeletedMeta {
  description: string;
  deletedBy: string;
}

export interface BillDraftConfirmedMeta {
  description: string;
  amount: number;
  currency: string;
  confirmedBy: string;
}

export interface AdminActionMeta {
  action: string;
  performedBy: string;
}

export interface LargeExpenseApprovedMeta {
  description: string;
  amount: number;
  currency: string;
  approvedBy: string;
}


