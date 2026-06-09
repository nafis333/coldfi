import { describe, it, expect } from 'vitest';
import {
  computeSpendingByCategory,
  computeDailySpending,
  computeTopExpenses,
} from '../analyticsCalculator';
import type { PersonalExpense, PersonalCategory } from '../../types/personal';
import { PaymentMethod } from '../../types/enums';

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

const makeCategory = (overrides: Partial<PersonalCategory> = {}): PersonalCategory => ({
  id: 'cat-food',
  name: 'Food',
  icon: '🍔',
  color: '#ff6384',
  isDefault: false,
  sortOrder: 0,
  createdAt: '',
});

describe('computeSpendingByCategory', () => {
  it('groups expenses by category with correct totals', () => {
    const expenses = [
      makeExpense({ amount: 50, categoryId: 'cat-food' }),
      makeExpense({ id: 'e2', amount: 30, categoryId: 'cat-food' }),
      makeExpense({ id: 'e3', amount: 100, categoryId: 'cat-transport' }),
    ];
    const categories = [
      makeCategory({ id: 'cat-food', name: 'Food' }),
      makeCategory({ id: 'cat-transport', name: 'Transport', icon: '🚗', color: '#36a2eb' }),
    ];
    const breakdown = computeSpendingByCategory(expenses, categories);
    expect(breakdown).toHaveLength(2);
    const food = breakdown.find((b) => b.categoryId === 'cat-food');
    expect(food!.totalAmount).toBe(80);
    expect(food!.transactionCount).toBe(2);
  });

  it('returns empty array for no expenses', () => {
    const breakdown = computeSpendingByCategory([], []);
    expect(breakdown).toHaveLength(0);
  });

  it('calculates percentages correctly', () => {
    const expenses = [
      makeExpense({ amount: 75, categoryId: 'cat-food' }),
      makeExpense({ id: 'e2', amount: 25, categoryId: 'cat-transport' }),
    ];
    const categories = [
      makeCategory({ id: 'cat-food', name: 'Food' }),
      makeCategory({ id: 'cat-transport', name: 'Transport', icon: '🚗', color: '#36a2eb' }),
    ];
    const breakdown = computeSpendingByCategory(expenses, categories);
    const food = breakdown.find((b) => b.categoryId === 'cat-food');
    const transport = breakdown.find((b) => b.categoryId === 'cat-transport');
    expect(food!.percentOfTotal).toBe(75);
    expect(transport!.percentOfTotal).toBe(25);
  });
});

describe('computeDailySpending', () => {
  it('fills all days in range', () => {
    const expenses = [
      makeExpense({ amount: 50, date: '2024-06-15' }),
      makeExpense({ id: 'e2', amount: 30, date: '2024-06-20' }),
    ];
    const daily = computeDailySpending(expenses, '2024-06-15', '2024-06-17');
    expect(daily).toHaveLength(3);
    expect(daily[0]!.totalAmount).toBe(50);
    expect(daily[1]!.totalAmount).toBe(0);
    expect(daily[2]!.totalAmount).toBe(0);
  });

  it('returns empty range for no matching expenses', () => {
    const daily = computeDailySpending(
      [makeExpense({ date: '2024-05-01' })],
      '2024-06-01',
      '2024-06-05'
    );
    expect(daily).toHaveLength(5);
    expect(daily.every((d) => d.totalAmount === 0)).toBe(true);
  });
});

describe('computeTopExpenses', () => {
  it('returns top N expenses sorted by amount', () => {
    const expenses = [
      makeExpense({ amount: 200, categoryId: 'cat-food' }),
      makeExpense({ id: 'e2', amount: 50, categoryId: 'cat-transport' }),
      makeExpense({ id: 'e3', amount: 150, categoryId: 'cat-entertainment' }),
    ];
    const categories = [
      makeCategory({ id: 'cat-food', name: 'Food' }),
      makeCategory({ id: 'cat-transport', name: 'Transport', icon: '🚗', color: '#36a2eb' }),
      makeCategory({ id: 'cat-entertainment', name: 'Entertainment', icon: '🎬', color: '#ffce56' }),
    ];
    const top = computeTopExpenses(expenses, categories, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.amount).toBe(200);
    expect(top[1]!.amount).toBe(150);
  });

  it('returns empty array for no expenses', () => {
    const top = computeTopExpenses([], [], 5);
    expect(top).toHaveLength(0);
  });

  it('respects limit parameter', () => {
    const expenses = Array.from({ length: 10 }, (_, i) =>
      makeExpense({ id: `e${i}`, amount: i * 10, categoryId: 'cat-food' })
    );
    const categories = [makeCategory()];
    const top = computeTopExpenses(expenses, categories, 3);
    expect(top).toHaveLength(3);
  });
});
