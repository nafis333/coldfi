export enum SettlementStatus {
  PROPOSED = 'proposed',
  MARKED_PAID = 'marked_paid',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  SUPERSEDED = 'superseded',
}

export enum GroupLogEventType {
  EXPENSE_ADDED = 'expense_added',
  EXPENSE_EDITED = 'expense_edited',
  EXPENSE_DELETED = 'expense_deleted',
  SETTLEMENT_PROPOSED = 'settlement_proposed',
  SETTLEMENT_MARKED_PAID = 'settlement_marked_paid',
  SETTLEMENT_APPROVED = 'settlement_approved',
  SETTLEMENT_REJECTED = 'settlement_rejected',
  SETTLEMENT_CANCELLED = 'settlement_cancelled',
  MEMBER_JOINED = 'member_joined',
  MEMBER_LEFT = 'member_left',
  MEMBER_REMOVED = 'member_removed',
  CATEGORY_ADDED = 'category_added',
  CATEGORY_RATIO_CHANGED = 'category_ratio_changed',
  CATEGORY_DELETED = 'category_deleted',
  RECURRING_BILL_CREATED = 'recurring_bill_created',
  RECURRING_BILL_DELETED = 'recurring_bill_deleted',
  BILL_DRAFT_CONFIRMED = 'bill_draft_confirmed',
  ADMIN_ACTION = 'admin_action',
  LARGE_EXPENSE_APPROVED = 'large_expense_approved',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
}

export enum ExpenseStatus {
  PENDING_APPROVAL = 'pending_approval',
  UNSETTLED = 'unsettled',
  PARTIALLY_SETTLED = 'partially_settled',
  SETTLED = 'settled',
}

export enum MemberRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum SplitMode {
  RATIO = 'ratio',
  FIXED = 'fixed',
}

export enum BudgetType {
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum BudgetStatus {
  GREEN = 'green',
  YELLOW = 'yellow',
  RED = 'red',
}

export enum NotificationType {
  BILL_DUE = 'bill_due',
  SETTLEMENT_PENDING = 'settlement_pending',
  BUDGET_ALERT = 'budget_alert',
  APPROVAL_NEEDED = 'approval_needed',
  LARGE_EXPENSE_PENDING = 'large_expense_pending',
  MEMBER_JOINED = 'member_joined',
}
