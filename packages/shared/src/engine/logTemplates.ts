import {
  GroupLogEventType,
  type GroupLogEntry,
  type ExpenseAddedMeta,
  type ExpenseEditedMeta,
  type ExpenseDeletedMeta,
  type SettlementProposedMeta,
  type SettlementMarkedPaidMeta,
  type SettlementApprovedMeta,
  type SettlementRejectedMeta,
  type SettlementCancelledMeta,
  type MemberJoinedMeta,
  type MemberLeftMeta,
  type MemberRemovedMeta,
  type CategoryAddedMeta,
  type CategoryRatioChangedMeta,
  type CategoryDeletedMeta,
  type RecurringBillCreatedMeta,
  type RecurringBillDeletedMeta,
  type BillDraftConfirmedMeta,
  type AdminActionMeta,
  type LargeExpenseApprovedMeta,
} from './types';
import { formatCurrency } from '../utils/currency';

export type {
  ExpenseAddedMeta,
  ExpenseEditedMeta,
  ExpenseDeletedMeta,
  SettlementProposedMeta,
  SettlementMarkedPaidMeta,
  SettlementApprovedMeta,
  SettlementRejectedMeta,
  SettlementCancelledMeta,
  MemberJoinedMeta,
  MemberLeftMeta,
  MemberRemovedMeta,
  CategoryAddedMeta,
  CategoryRatioChangedMeta,
  CategoryDeletedMeta,
  RecurringBillCreatedMeta,
  RecurringBillDeletedMeta,
  BillDraftConfirmedMeta,
  AdminActionMeta,
  LargeExpenseApprovedMeta,
};

function fmt(amount: number, currency: string): string {
  return `${formatCurrency(amount, currency)} (${currency})`;
}

export const LOG_TEMPLATES: Record<
  GroupLogEventType,
  (meta: Record<string, unknown>) => string
> = {
  [GroupLogEventType.EXPENSE_ADDED]: (meta) => {
    const m = meta as unknown as ExpenseAddedMeta;
    return `${m.createdBy} added expense "${m.description}" for ${fmt(m.amount, m.currency)}`;
  },

  [GroupLogEventType.EXPENSE_EDITED]: (meta) => {
    const m = meta as unknown as ExpenseEditedMeta;
    const changes = Object.entries(m.changes)
      .map(([key, val]) => `${key} → "${val}"`)
      .join(', ');
    return `Expense "${m.description}" was edited by ${m.editedBy}: ${changes}`;
  },

  [GroupLogEventType.EXPENSE_DELETED]: (meta) => {
    const m = meta as unknown as ExpenseDeletedMeta;
    return `Expense "${m.description}" (${fmt(m.amount, m.currency)}) was deleted by ${m.deletedBy}`;
  },

  [GroupLogEventType.SETTLEMENT_PROPOSED]: (meta) => {
    const m = meta as unknown as SettlementProposedMeta;
    return `${m.payerName} proposed a settlement of ${fmt(m.amount, m.currency)} to ${m.payeeName}`;
  },

  [GroupLogEventType.SETTLEMENT_MARKED_PAID]: (meta) => {
    const m = meta as unknown as SettlementMarkedPaidMeta;
    return `${m.payerName} marked a settlement of ${fmt(m.amount, m.currency)} as paid to ${m.payeeName}`;
  },

  [GroupLogEventType.SETTLEMENT_APPROVED]: (meta) => {
    const m = meta as unknown as SettlementApprovedMeta;
    return `Settlement of ${fmt(m.amount, m.currency)} from ${m.payerName} to ${m.payeeName} was approved`;
  },

  [GroupLogEventType.SETTLEMENT_REJECTED]: (meta) => {
    const m = meta as unknown as SettlementRejectedMeta;
    return `Settlement of ${fmt(m.amount, m.currency)} from ${m.payerName} to ${m.payeeName} was rejected by ${m.rejectedBy}`;
  },

  [GroupLogEventType.SETTLEMENT_CANCELLED]: (meta) => {
    const m = meta as unknown as SettlementCancelledMeta;
    return `Settlement of ${fmt(m.amount, m.currency)} from ${m.payerName} to ${m.payeeName} was cancelled by ${m.cancelledBy}`;
  },

  [GroupLogEventType.MEMBER_JOINED]: (meta) => {
    const m = meta as unknown as MemberJoinedMeta;
    return `${m.memberName} joined the group as ${m.role}`;
  },

  [GroupLogEventType.MEMBER_LEFT]: (meta) => {
    const m = meta as unknown as MemberLeftMeta;
    return `${m.memberName} left the group`;
  },

  [GroupLogEventType.MEMBER_REMOVED]: (meta) => {
    const m = meta as unknown as MemberRemovedMeta;
    return `${m.memberName} was removed from the group by ${m.removedBy}`;
  },

  [GroupLogEventType.CATEGORY_ADDED]: (meta) => {
    const m = meta as unknown as CategoryAddedMeta;
    return `Category "${m.categoryName}" was added by ${m.addedBy}`;
  },

  [GroupLogEventType.CATEGORY_RATIO_CHANGED]: (meta) => {
    const m = meta as unknown as CategoryRatioChangedMeta;
    return `Ratio for category "${m.categoryName}" was updated by ${m.changedBy}`;
  },

  [GroupLogEventType.CATEGORY_DELETED]: (meta) => {
    const m = meta as unknown as CategoryDeletedMeta;
    return `Category "${m.categoryName}" was deleted by ${m.deletedBy}`;
  },

  [GroupLogEventType.RECURRING_BILL_CREATED]: (meta) => {
    const m = meta as unknown as RecurringBillCreatedMeta;
    return `${m.createdBy} created recurring bill "${m.description}" for ${fmt(m.amount, m.currency)}`;
  },

  [GroupLogEventType.RECURRING_BILL_DELETED]: (meta) => {
    const m = meta as unknown as RecurringBillDeletedMeta;
    return `Recurring bill "${m.description}" was deleted by ${m.deletedBy}`;
  },

  [GroupLogEventType.BILL_DRAFT_CONFIRMED]: (meta) => {
    const m = meta as unknown as BillDraftConfirmedMeta;
    return `Bill draft "${m.description}" (${fmt(m.amount, m.currency)}) was confirmed by ${m.confirmedBy}`;
  },

  [GroupLogEventType.ADMIN_ACTION]: (meta) => {
    const m = meta as unknown as AdminActionMeta;
    return `Admin action: ${m.action} (by ${m.performedBy})`;
  },

  [GroupLogEventType.LARGE_EXPENSE_APPROVED]: (meta) => {
    const m = meta as unknown as LargeExpenseApprovedMeta;
    return `Large expense "${m.description}" (${fmt(m.amount, m.currency)}) was approved by ${m.approvedBy}`;
  },
};

export function resolveLogMessage(entry: GroupLogEntry): string {
  const template = LOG_TEMPLATES[entry.eventType];
  if (!template) {
    return `[Unknown event: ${entry.eventType}]`;
  }
  return template(entry.metadata ?? {});
}

export function getAvailableTemplates(): GroupLogEventType[] {
  return Object.keys(LOG_TEMPLATES) as GroupLogEventType[];
}
