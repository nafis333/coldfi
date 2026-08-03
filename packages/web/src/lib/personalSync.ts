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

function advancePeriod(type: string, periodStart: string, periodEnd: string): { periodStart: string; periodEnd: string } {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (type === 'monthly') {
    start.setMonth(start.getMonth() + 1);
    end.setMonth(end.getMonth() + 1);
  } else {
    // Custom range: advance by the range's own duration
    const duration = end.getTime() - start.getTime();
    start.setTime(start.getTime() + duration);
    end.setTime(end.getTime() + duration);
  }
  return { periodStart: start.toISOString().split('T')[0], periodEnd: end.toISOString().split('T')[0] };
}

function toEngineBudget(b: Budget, amount: number): {
  id: string;
  categoryId: string;
  type: BudgetType;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  status: BudgetStatus;
  alertThreshold: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: b.id,
    categoryId: b.categoryId,
    type: b.type as BudgetType,
    amount,
    currency: b.currency,
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    status: BudgetStatus.GREEN,
    alertThreshold: b.alertThreshold,
    createdAt: '',
    updatedAt: '',
  };
}

function toEngineExpenses(expenses: Expense[]): {
  id: string;
  amount: number;
  categoryId: string;
  date: string;
  currency: string;
  description: string;
  paymentMethod: string;
  isRecurring: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}[] {
  return expenses.map((e) => ({
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
  }));
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
    let effective: Budget = updatedBudgets[i]!;
    let rolloverAmount = b.rollover ? (b.unusedRolloverAmount || 0) : 0;

    if (b.rollover && new Date(b.periodEnd) < now) {
      // Period ended: roll the unused amount into the next period(s), advancing
      // the range until it covers "now" (handles multi-period gaps).
      const expiredResult = computeBudgetStatus(
        toEngineBudget({ ...b, unusedRolloverAmount: 0 }, b.amount + rolloverAmount),
        toEngineExpenses(expenses)
      );
      const carry = Math.max(0, expiredResult.remaining);

      let next = advancePeriod(b.type, b.periodStart, b.periodEnd);
      let guard = 0;
      while (new Date(next.periodEnd) < now && guard < 60) {
        next = advancePeriod(b.type, next.periodStart, next.periodEnd);
        guard++;
      }

      effective = { ...b, ...next, unusedRolloverAmount: carry };
      rolloverAmount = carry;
      updatedBudgets[i] = effective;
    }

    const result = computeBudgetStatus(
      toEngineBudget(effective, effective.amount + rolloverAmount),
      toEngineExpenses(expenses)
    );

    return result;
  });

  return { statuses, updatedBudgets };
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
