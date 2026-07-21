import { describe, it, expect } from 'vitest';
import { detectUnusualSpending, getSpendingTrend } from '../spendingDetector';
import type { PersonalExpense } from '../../types/personal';


const makeExpense = (overrides: Partial<PersonalExpense> = {}): PersonalExpense => ({
  id: 'exp-1',
  amount: 50,
  currency: 'USD',
  categoryId: 'cat-food',
  description: 'Groceries',
  date: '2024-06-15',
  paymentMethod: 'card',
  isRecurring: false,
  tags: [],
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-06-15T10:00:00Z',
  ...overrides,
});

describe('detectUnusualSpending', () => {
  it('detects high severity when spending is 2x average', () => {
    const historical = Array.from({ length: 3 }, (_, i) =>
      makeExpense({
        id: `exp-hist-${i}`,
        amount: 100,
        date: `2024-${String(3 - i).padStart(2, '0')}-15`,
      })
    );
    const current = makeExpense({ amount: 250, date: '2024-06-15' });
    const alerts = detectUnusualSpending(
      [...historical, current],
      { 'cat-food': 'Food' },
      { currentDate: new Date('2024-06-30') }
    );
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]!.severity).toBe('high');
  });

  it('returns empty when spending is normal', () => {
    const expenses = Array.from({ length: 4 }, (_, i) =>
      makeExpense({
        id: `exp-${i}`,
        amount: 100,
        date: `2024-${String(3 + i).padStart(2, '0')}-15`,
      })
    );
    const alerts = detectUnusualSpending(
      expenses,
      { 'cat-food': 'Food' },
      { currentDate: new Date('2024-06-30') }
    );
    expect(alerts).toHaveLength(0);
  });

  it('returns empty for no expenses', () => {
    const alerts = detectUnusualSpending([], {});
    expect(alerts).toHaveLength(0);
  });
});

describe('getSpendingTrend', () => {
  it('detects increasing trend', () => {
    const expenses = [
      makeExpense({ amount: 50, date: '2024-03-15' }),
      makeExpense({ id: 'e2', amount: 100, date: '2024-04-15' }),
      makeExpense({ id: 'e3', amount: 150, date: '2024-05-15' }),
      makeExpense({ id: 'e4', amount: 200, date: '2024-06-15' }),
    ];
    const trends = getSpendingTrend(
      expenses,
      { 'cat-food': 'Food' },
      { currentDate: new Date('2024-06-30') }
    );
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]!.direction).toBe('increasing');
    expect(trends[0]!.percentChange).toBeGreaterThan(0);
  });

  it('detects decreasing trend', () => {
    const expenses = [
      makeExpense({ amount: 200, date: '2024-03-15' }),
      makeExpense({ id: 'e2', amount: 150, date: '2024-04-15' }),
      makeExpense({ id: 'e3', amount: 100, date: '2024-05-15' }),
      makeExpense({ id: 'e4', amount: 50, date: '2024-06-15' }),
    ];
    const trends = getSpendingTrend(
      expenses,
      { 'cat-food': 'Food' },
      { currentDate: new Date('2024-06-30') }
    );
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]!.direction).toBe('decreasing');
  });

  it('detects stable trend when within threshold', () => {
    const expenses = [
      makeExpense({ amount: 100, date: '2024-03-15' }),
      makeExpense({ id: 'e2', amount: 102, date: '2024-04-15' }),
      makeExpense({ id: 'e3', amount: 98, date: '2024-05-15' }),
      makeExpense({ id: 'e4', amount: 101, date: '2024-06-15' }),
    ];
    const trends = getSpendingTrend(
      expenses,
      { 'cat-food': 'Food' },
      { currentDate: new Date('2024-06-30'), stableThreshold: 5 }
    );
    expect(trends.length).toBeGreaterThanOrEqual(1);
    expect(trends[0]!.direction).toBe('stable');
  });

  it('returns empty for single period', () => {
    const expenses = [makeExpense({ date: '2024-06-15' })];
    const trends = getSpendingTrend(
      expenses,
      { 'cat-food': 'Food' },
      { periods: 1, currentDate: new Date('2024-06-30') }
    );
    expect(trends).toHaveLength(0);
  });
});
