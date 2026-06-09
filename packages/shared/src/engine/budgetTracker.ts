import { BudgetStatus, BudgetType } from '../types/enums';
import type { PersonalBudget, PersonalExpense } from '../types/personal';

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

export interface BudgetAlert {
  budgetId: string;
  categoryId: string;
  type: 'threshold_exceeded' | 'budget_exceeded' | 'projection_warning';
  message: string;
  percentUsed: number;
  threshold: number;
}

export function computeBudgetStatus(
  budget: PersonalBudget,
  expenses: PersonalExpense[]
): BudgetStatusResult {
  const periodExpenses = expenses.filter((e) => {
    if (e.categoryId !== budget.categoryId) return false;
    const expenseDate = new Date(e.date);
    const periodStart = new Date(budget.periodStart);
    const periodEnd = new Date(budget.periodEnd);
    return expenseDate >= periodStart && expenseDate <= periodEnd;
  });

  const spent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.amount - spent;
  const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

  const status = determineStatus(percentUsed);

  const now = new Date();
  const periodStart = new Date(budget.periodStart);
  const periodEnd = new Date(budget.periodEnd);

  let projectedTotal = spent;
  let projectedPercent = percentUsed;
  let projectedStatus = status;

  if (now > periodStart && now < periodEnd) {
    const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);

    if (budget.amount === 0) {
      projectedPercent = 0;
      projectedStatus = BudgetStatus.GREEN;
    } else if (elapsedDays > 0) {
      const dailyRate = spent / elapsedDays;
      projectedTotal = dailyRate * totalDays;
      projectedPercent = budget.amount > 0 ? (projectedTotal / budget.amount) * 100 : 0;
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

export function checkBudgetAlerts(
  budgets: PersonalBudget[],
  expenses: PersonalExpense[]
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  for (const budget of budgets) {
    const statusResult = computeBudgetStatus(budget, expenses);

    if (
      statusResult.percentUsed >= budget.alertThreshold &&
      statusResult.percentUsed < 100
    ) {
      alerts.push({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        type: 'threshold_exceeded',
        message: `Budget is ${statusResult.percentUsed.toFixed(1)}% used (threshold: ${budget.alertThreshold}%)`,
        percentUsed: statusResult.percentUsed,
        threshold: budget.alertThreshold,
      });
    }

    if (statusResult.percentUsed >= 100) {
      alerts.push({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        type: 'budget_exceeded',
        message: `Budget exceeded! Spent ${statusResult.spent} of ${budget.amount}`,
        percentUsed: statusResult.percentUsed,
        threshold: 100,
      });
    }

    if (
      statusResult.projectedPercent > 100 &&
      statusResult.percentUsed < 100
    ) {
      alerts.push({
        budgetId: budget.id,
        categoryId: budget.categoryId,
        type: 'projection_warning',
        message: `At current rate, projected spending is ${statusResult.projectedTotal.toFixed(2)} (${statusResult.projectedPercent.toFixed(1)}% of budget)`,
        percentUsed: statusResult.projectedPercent,
        threshold: 100,
      });
    }
  }

  return alerts;
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
  if (percentUsed >= 75) return BudgetStatus.YELLOW;
  return BudgetStatus.GREEN;
}
