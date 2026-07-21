import {
  BudgetType,
  BudgetStatus,
} from './enums';
import type { Invoice } from './invoice';

export interface PersonalBlob {
  version: number;
  updatedAt: string;
  expenses: PersonalExpense[];
  categories: PersonalCategory[];
  budgets: PersonalBudget[];
  recurringBills: PersonalRecurringBill[];
  incomeLogs: IncomeLog[];
  savingsTargets: SavingsTarget[];
  invoices?: Invoice[];
}

export interface PersonalExpense {
  id: string;
  amount: number;
  currency: string;
  categoryId: string;
  description: string;
  date: string;
  paymentMethod: string;
  isRecurring: boolean;
  recurringBillId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PersonalCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PersonalBudget {
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
}

export interface PersonalRecurringBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  categoryId: string;
  paymentMethod: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDueDate: string;
  endDate?: string;
  isActive: boolean;
  reminderDaysBefore: number;
  lastGenerated?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeLog {
  id: string;
  source: string;
  amount: number;
  currency: string;
  date: string;
  isRecurring: boolean;
  frequency?: 'monthly' | 'biweekly' | 'weekly' | 'yearly';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsTarget {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  category?: string;
  priority: number;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}
