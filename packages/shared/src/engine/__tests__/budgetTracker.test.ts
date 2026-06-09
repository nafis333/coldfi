import { describe, it, expect } from 'vitest';
import { computeBudgetStatus, computeBudgetSummary } from '../budgetTracker';
import type { PersonalBudget, PersonalExpense } from '../../types/personal';
import { PaymentMethod, BudgetType, BudgetStatus } from '../../types/enums';

const makeExpense = (overrides: Partial<PersonalExpense> = {}): PersonalExpense => ({
  id: 'exp-1',
  amount: 50,
  currency: 'USD',
  categoryId: 'cat-food',
  description: 'Groceries',
  date: '2024-06-15',
  paymentMethod: PaymentMethod.CARD,
  isRecurring: false,
  tags: [],
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-06-15T10:00:00Z',
  ...overrides,
});

const makeBudget = (overrides: Partial<PersonalBudget> = {}): PersonalBudget => ({
  id: 'budget-1',
  categoryId: 'cat-food',
  type: BudgetType.MONTHLY,
  amount: 200,
  currency: 'USD',
  periodStart: '2024-06-01',
  periodEnd: '2024-06-30',
  status: BudgetStatus.GREEN,
  alertThreshold: 80,
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  ...overrides,
});

describe('computeBudgetStatus', () => {
  it('returns remaining amount when under budget', () => {
    const expenses = [makeExpense({ amount: 50 }), makeExpense({ id: 'exp-2', amount: 30 })];
    const budget = makeBudget({ amount: 200 });
    const result = computeBudgetStatus(budget, expenses);
    expect(result.spent).toBe(80);
    expect(result.remaining).toBe(120);
    expect(result.percentUsed).toBe(40);
    expect(result.status).toBe('green');
  });

  it('returns red status when over budget', () => {
    const expenses = [makeExpense({ amount: 250 })];
    const budget = makeBudget({ amount: 200 });
    const result = computeBudgetStatus(budget, expenses);
    expect(result.spent).toBe(250);
    expect(result.remaining).toBe(-50);
    expect(result.status).toBe('red');
  });

  it('ignores expenses outside the budget period', () => {
    const expenses = [
      makeExpense({ amount: 100, date: '2024-06-15' }),
      makeExpense({ id: 'exp-2', amount: 500, date: '2024-05-15' }),
    ];
    const budget = makeBudget();
    const result = computeBudgetStatus(budget, expenses);
    expect(result.spent).toBe(100);
  });

  it('ignores expenses in different categories', () => {
    const expenses = [
      makeExpense({ amount: 100, categoryId: 'cat-food' }),
      makeExpense({ id: 'exp-2', amount: 500, categoryId: 'cat-transport' }),
    ];
    const budget = makeBudget({ categoryId: 'cat-food' });
    const result = computeBudgetStatus(budget, expenses);
    expect(result.spent).toBe(100);
  });

  it('returns zero spent with no expenses', () => {
    const budget = makeBudget();
    const result = computeBudgetStatus(budget, []);
    expect(result.spent).toBe(0);
    expect(result.remaining).toBe(200);
    expect(result.percentUsed).toBe(0);
  });
});

describe('computeBudgetSummary', () => {
  it('returns summary for multiple budgets', () => {
    const budgets = [
      makeBudget({ categoryId: 'cat-food', amount: 200 }),
      makeBudget({ id: 'b2', categoryId: 'cat-transport', amount: 100 }),
    ];
    const expenses = [
      makeExpense({ amount: 150, categoryId: 'cat-food' }),
      makeExpense({ id: 'e2', amount: 80, categoryId: 'cat-transport' }),
    ];
    const summary = computeBudgetSummary(budgets, expenses);
    expect(summary.totalBudgeted).toBe(300);
    expect(summary.totalSpent).toBe(230);
    expect(summary.budgetsOverBudget).toBe(0);
    expect(summary.budgetsOnTrack).toBe(2);
  });

  it('handles empty budgets array', () => {
    const summary = computeBudgetSummary([], []);
    expect(summary.totalBudgeted).toBe(0);
    expect(summary.totalSpent).toBe(0);
    expect(summary.budgetsOverBudget).toBe(0);
    expect(summary.budgetsOnTrack).toBe(0);
  });
});
