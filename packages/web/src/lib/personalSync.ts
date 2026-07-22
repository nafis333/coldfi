import { computeBudgetStatus, BudgetStatus, BudgetType, type BudgetStatusResult } from '@coldfi/shared';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface ExpenseItem {
  name: string;
  amount: number;
}

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  categoryId: string;
  date: string;
  payee: string | null;
  note: string | null;
  paymentMethod: string | null;
  receiptUri: string | null;
  isRecurring: boolean;
  items?: ExpenseItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  type: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  alertThreshold: number;
  rollover: boolean;
  unusedRolloverAmount: number;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  category: string;
  nextDueDate: string;
  isActive: boolean;
  currency?: string;
  lastPaidDate?: string;
  previousNextDueDate?: string;
}

export interface IncomeLog {
  id: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsTarget {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalBlob {
  version?: number;
  updatedAt?: string;
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  recurringBills?: RecurringBill[];
  incomeLogs?: IncomeLog[];
  savingsTargets?: SavingsTarget[];
}

export function computeBudgetStatuses(
  budgets: Budget[],
  expenses: Expense[]
): { statuses: BudgetStatusResult[]; updatedBudgets: Budget[] } {
  const now = new Date();
  const updatedBudgets = budgets.map((b) => {
    const rolloverAmount = b.rollover ? (b.unusedRolloverAmount || 0) : 0;
    return { ...b, unusedRolloverAmount: rolloverAmount };
  });

  const statuses = budgets.map((b, i) => {
    const rolloverAmount = b.rollover ? (b.unusedRolloverAmount || 0) : 0;
    const result = computeBudgetStatus(
      {
        id: b.id,
        categoryId: b.categoryId,
        type: b.type as BudgetType,
        amount: b.amount + rolloverAmount,
        currency: b.currency,
        periodStart: b.periodStart,
        periodEnd: b.periodEnd,
        status: BudgetStatus.GREEN,
        alertThreshold: b.alertThreshold,
        createdAt: '',
        updatedAt: '',
      },
      expenses.map((e) => ({
        id: e.id,
        amount: e.amount,
        categoryId: e.categoryId,
        date: e.date,
        currency: e.currency,
        description: e.note ?? '',
        paymentMethod: e.paymentMethod ?? 'other',
        isRecurring: e.isRecurring,
        tags: [],
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }))
    );

    if (b.rollover) {
      const periodEnd = new Date(b.periodEnd);
      if (now > periodEnd) {
        updatedBudgets[i] = { ...updatedBudgets[i]!, unusedRolloverAmount: Math.max(0, result.remaining) };
      }
    }

    return result;
  });

  return { statuses, updatedBudgets };
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
