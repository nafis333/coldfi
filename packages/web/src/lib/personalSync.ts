import { computeBudgetStatus, BudgetStatus, BudgetType, type BudgetStatusResult, parseLocalDate } from '@coldfi/shared';

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

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function advancePeriod(type: string, periodStart: string, periodEnd: string): { periodStart: string; periodEnd: string } {
  const start = parseLocalDate(periodStart);
  const end = parseLocalDate(periodEnd);
  if (type === 'monthly') {
    // Advance the calendar month without overflowing (Jan 31 → Feb 28/29).
    const startDay = start.getDate();
    const nextMonthFirst = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const daysInNextMonth = new Date(nextMonthFirst.getFullYear(), nextMonthFirst.getMonth() + 1, 0).getDate();
    const nextStart = new Date(
      nextMonthFirst.getFullYear(),
      nextMonthFirst.getMonth(),
      Math.min(startDay, daysInNextMonth)
    );
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
    return { periodStart: localDateString(nextStart), periodEnd: localDateString(nextEnd) };
  }
  // Custom range: advance by the range's own duration
  const duration = end.getTime() - start.getTime();
  return { periodStart: localDateString(new Date(start.getTime() + duration)), periodEnd: localDateString(new Date(end.getTime() + duration)) };
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

function periodEndLocal(period: { periodEnd: string }): Date {
  const end = parseLocalDate(period.periodEnd);
  end.setDate(end.getDate() + 1);
  return end;
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

    if (b.rollover && periodEndLocal(b) < now) {
      // Period ended: roll the unused amount into the next period(s), advancing
      // the range until it covers "now" (handles multi-period gaps).
      const expiredResult = computeBudgetStatus(
        toEngineBudget({ ...b, unusedRolloverAmount: 0 }, b.amount + rolloverAmount),
        toEngineExpenses(expenses)
      );
      const carry = Math.max(0, expiredResult.remaining);

      let next = advancePeriod(b.type, b.periodStart, b.periodEnd);
      let guard = 0;
      while (periodEndLocal(next) < now && guard < 60) {
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
