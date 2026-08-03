import { BudgetStatus, BudgetType } from '../types/enums';
import type { PersonalBudget, PersonalExpense } from '../types/personal';
import { parseLocalDate } from '../utils/dates';

export interface BudgetStatusResult {
  budgetId: string;
  categoryId: string;
  budgetAmount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  status: BudgetStatus;
  projectedTotal: number;
  projectedPercent: number;
  projectedStatus: BudgetStatus;
}

export function computeBudgetStatus(
  budget: PersonalBudget,
  expenses: PersonalExpense[]
): BudgetStatusResult {
  const periodExpenses = expenses.filter((e) => {
    if (e.categoryId !== budget.categoryId) return false;
    if (e.currency !== budget.currency) return false;
    // Date-only strings must be compared by local calendar day; the end day is inclusive.
    const expenseDate = parseLocalDate(e.date);
    const periodStart = parseLocalDate(budget.periodStart);
    const periodEndExclusive = parseLocalDate(budget.periodEnd);
    periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);
    return expenseDate >= periodStart && expenseDate < periodEndExclusive;
  });

  const spent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.amount - spent;
  if (budget.amount === 0) {
    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      budgetAmount: 0,
      spent: Math.round(spent * 100) / 100,
      remaining: -Math.round(spent * 100) / 100,
      percentUsed: spent > 0 ? 100 : 0,
      status: spent > 0 ? BudgetStatus.RED : BudgetStatus.GREEN,
      projectedTotal: Math.round(spent * 100) / 100,
      projectedPercent: spent > 0 ? 100 : 0,
      projectedStatus: spent > 0 ? BudgetStatus.RED : BudgetStatus.GREEN,
    };
  }

  const percentUsed = (spent / budget.amount) * 100;

  const status = determineStatus(percentUsed);

  const now = new Date();
  const periodStart = parseLocalDate(budget.periodStart);
  const periodEnd = parseLocalDate(budget.periodEnd);

  let projectedTotal = spent;
  let projectedPercent = percentUsed;
  let projectedStatus = status;

  if (now > periodStart && now < periodEnd) {
    const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24) + 1;
    const elapsedDays = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

    if (elapsedDays > 0) {
      const dailyRate = spent / elapsedDays;
      projectedTotal = dailyRate * totalDays;
      projectedPercent = (projectedTotal / budget.amount) * 100;
      projectedStatus = determineStatus(projectedPercent);
    }
  }

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    budgetAmount: budget.amount,
    spent,
    remaining: Math.round(remaining * 100) / 100,
    percentUsed: Math.round(percentUsed * 100) / 100,
    status,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    projectedPercent: Math.round(projectedPercent * 100) / 100,
    projectedStatus,
  };
}

export function computeBudgetSummary(
  budgets: PersonalBudget[],
  expenses: PersonalExpense[]
): {
  totalBudgeted: number;
  totalSpent: number;
  overallPercentUsed: number;
  budgetsOverBudget: number;
  budgetsOnTrack: number;
} {
  let totalBudgeted = 0;
  let totalSpent = 0;
  let budgetsOverBudget = 0;
  let budgetsOnTrack = 0;

  for (const budget of budgets) {
    const status = computeBudgetStatus(budget, expenses);
    totalBudgeted += budget.amount;
    totalSpent += status.spent;

    if (status.percentUsed >= 100) {
      budgetsOverBudget++;
    } else {
      budgetsOnTrack++;
    }
  }

  return {
    totalBudgeted,
    totalSpent,
    overallPercentUsed: totalBudgeted > 0
      ? Math.round((totalSpent / totalBudgeted) * 10000) / 100
      : 0,
    budgetsOverBudget,
    budgetsOnTrack,
  };
}

function determineStatus(percentUsed: number): BudgetStatus {
  if (percentUsed >= 100) return BudgetStatus.RED;
  if (percentUsed >= 80) return BudgetStatus.YELLOW;
  return BudgetStatus.GREEN;
}
