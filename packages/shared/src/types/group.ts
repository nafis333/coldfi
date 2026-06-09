import {
  PaymentMethod,
  ExpenseStatus,
  MemberRole,
  SplitMode,
  GroupLogEventType,
} from './enums';
import type { GroupLogEntry } from '../engine/types';

export interface GroupBlob {
  version: number;
  updatedAt: string;
  groupId: string;
  expenses: GroupExpense[];
  categories: GroupCategory[];
  members: GroupMemberProfile[];
  settings: GroupSettings;
  recurringBills: GroupRecurringBill[];
  logs: GroupLogEntry[];
}

export interface GroupExpense {
  id: string;
  groupId: string;
  amount: number;
  currency: string;
  categoryId: string;
  description: string;
  date: string;
  paidBy: string;
  paymentMethod: PaymentMethod;
  splitMode: SplitMode;
  splits: ExpenseSplit[];
  itemizedItems?: ItemizedItem[];
  status: ExpenseStatus;
  receiptUrl?: string;
  isRecurring: boolean;
  recurringBillId?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ExpenseSplit {
  memberId: string;
  ratio: number;
  fixedAmount?: number;
  isPaid: boolean;
}

export interface GroupCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  defaultRatio: Record<string, number>;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface GroupMemberProfile {
  userId: string;
  displayName: string;
  avatarUrl: string;
  role: MemberRole;
  joinedAt: string;
  isActive: boolean;
  nickname?: string;
}

export interface GroupSettings {
  groupId: string;
  name: string;
  defaultCurrency: string;
  defaultSplitMode: SplitMode;
  requireApprovalAbove: number;
  allowMemberInvites: boolean;
  autoSettleThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupRecurringBill {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  currency: string;
  categoryId: string;
  paidBy: string;
  splitMode: SplitMode;
  splits: ExpenseSplit[];
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  endDate?: string;
  isActive: boolean;
  reminderDaysBefore: number;
  lastGenerated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemizedItem {
  id: string;
  name: string;
  amount: number;
  assignedTo: string[];
}
