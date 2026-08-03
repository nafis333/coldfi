import { describe, it, expect } from 'vitest';
import { computeNetBalances, getTotalOwed, getTotalDebt } from '../balanceCalculator';
import type { GroupExpense } from '../../types/group';
import type { SettlementProposal } from '../../types/settlement';
import { SplitMode, ExpenseStatus, SettlementStatus, PaymentMethod } from '../../types/enums';

function makeExpense(overrides: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id: 'exp-1',
    groupId: 'g1',
    amount: 100,
    currency: 'INR',
    categoryId: 'cat-1',
    description: 'Dinner',
    date: '2026-01-01',
    paidBy: 'alice',
    paymentMethod: PaymentMethod.CASH,
    splitMode: SplitMode.RATIO,
    splits: [
      { memberId: 'alice', ratio: 0.5, isPaid: false },
      { memberId: 'bob', ratio: 0.5, isPaid: false },
    ],
    status: ExpenseStatus.UNSETTLED,
    isRecurring: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'alice',
    ...overrides,
  };
}

function makeSettlement(overrides: Partial<SettlementProposal> = {}): SettlementProposal {
  return {
    id: 'set-1',
    groupId: 'g1',
    fromUserId: 'bob',
    toUserId: 'alice',
    amount: 50,
    currency: 'INR',
    status: SettlementStatus.APPROVED,
    proposedAt: '2026-01-02T00:00:00Z',
    approvedAt: '2026-01-02T01:00:00Z',
    relatedExpenseIds: [],
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T01:00:00Z',
    ...overrides,
  };
}

describe('computeNetBalances', () => {
  it('should compute net balance for a single expense', () => {
    const expenses = [makeExpense()];
    const balances = computeNetBalances(expenses, [], ['alice', 'bob']);

    const alice = balances.find((b) => b.userId === 'alice')!;
    const bob = balances.find((b) => b.userId === 'bob')!;

    expect(alice.net).toBe(50);
    expect(bob.net).toBe(-50);
    expect(alice.owedBy['bob']).toBe(50);
    expect(bob.owesTo['alice']).toBe(50);
  });

  it('should net out approved settlements', () => {
    const expenses = [makeExpense()];
    const settlements = [makeSettlement()];
    const balances = computeNetBalances(expenses, settlements, ['alice', 'bob']);

    const bob = balances.find((b) => b.userId === 'bob')!;
    expect(bob.net).toBe(0);
  });

  it('should handle three members', () => {
    const expense = makeExpense({
      amount: 300,
      splits: [
        { memberId: 'alice', ratio: 1 / 3, isPaid: false },
        { memberId: 'bob', ratio: 1 / 3, isPaid: false },
        { memberId: 'charlie', ratio: 1 / 3, isPaid: false },
      ],
    });

    const balances = computeNetBalances([expense], [], ['alice', 'bob', 'charlie']);
    const alice = balances.find((b) => b.userId === 'alice')!;
    const bob = balances.find((b) => b.userId === 'bob')!;
    const charlie = balances.find((b) => b.userId === 'charlie')!;

    expect(alice.net).toBe(200);
    expect(bob.net).toBe(-100);
    expect(charlie.net).toBe(-100);
  });

  it('should skip pending approval expenses', () => {
    const expenses = [makeExpense({ status: ExpenseStatus.PENDING_APPROVAL })];
    const balances = computeNetBalances(expenses, [], ['alice', 'bob']);

    expect(balances[0]!.net).toBe(0);
    expect(balances[1]!.net).toBe(0);
  });

  it('should not apply a settlement against debt in a different currency', () => {
    const expenses = [
      makeExpense({
        id: 'exp-usd',
        amount: 100,
        currency: 'USD',
        splits: [
          { memberId: 'alice', ratio: 0.5, isPaid: false },
          { memberId: 'bob', ratio: 0.5, isPaid: false },
        ],
      }),
    ];
    const settlements = [
      makeSettlement({ id: 'set-inr', amount: 50, currency: 'INR' }),
    ];
    const balances = computeNetBalances(expenses, settlements, ['alice', 'bob']);

    const bob = balances.find((b) => b.userId === 'bob')!;
    expect(bob.owesTo['alice']).toBe(50);
  });

  it('should apply a settlement to the only currency with debt when settlement has no currency', () => {
    const expenses = [
      makeExpense({
        id: 'exp-bdt',
        amount: 100,
        currency: 'BDT',
        splits: [
          { memberId: 'alice', ratio: 0.5, isPaid: false },
          { memberId: 'bob', ratio: 0.5, isPaid: false },
        ],
      }),
    ];
    const settlements = [
      makeSettlement({ id: 'set-legacy', amount: 50, currency: '' }),
    ];
    const balances = computeNetBalances(expenses, settlements, ['alice', 'bob']);

    const bob = balances.find((b) => b.userId === 'bob')!;
    expect(bob.net).toBe(0);
  });

  it('should keep multi-currency debts separate', () => {
    const expenses = [
      makeExpense({
        id: 'exp-bdt',
        amount: 100,
        currency: 'BDT',
        splits: [
          { memberId: 'alice', ratio: 0.5, isPaid: false },
          { memberId: 'bob', ratio: 0.5, isPaid: false },
        ],
      }),
      makeExpense({
        id: 'exp-usd',
        amount: 80,
        currency: 'USD',
        splits: [
          { memberId: 'alice', ratio: 0.5, isPaid: false },
          { memberId: 'bob', ratio: 0.5, isPaid: false },
        ],
      }),
    ];
    const balances = computeNetBalances(expenses, [], ['alice', 'bob']);

    const bob = balances.find((b) => b.userId === 'bob')!;
    expect(bob.net).toBe(-90);
    expect(bob.owesTo['alice']).toBe(90);
  });
});

describe('getTotalOwed', () => {
  it('should return total owed to a member', () => {
    const expenses = [makeExpense()];
    const balances = computeNetBalances(expenses, [], ['alice', 'bob']);

    expect(getTotalOwed(balances, 'alice')).toBe(50);
    expect(getTotalOwed(balances, 'bob')).toBe(0);
  });
});

describe('getTotalDebt', () => {
  it('should return total debt of a member', () => {
    const expenses = [makeExpense()];
    const balances = computeNetBalances(expenses, [], ['alice', 'bob']);

    expect(getTotalDebt(balances, 'alice')).toBe(0);
    expect(getTotalDebt(balances, 'bob')).toBe(50);
  });
});
