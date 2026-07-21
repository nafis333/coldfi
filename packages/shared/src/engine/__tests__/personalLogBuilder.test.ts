import { describe, it, expect } from 'vitest';
import { buildPersonalLog, type PersonalLogEntry } from '../personalLogBuilder';
import type { GroupExpense } from '../../types/group';
import type { SettlementProposal } from '../../types/settlement';
import { SplitMode, ExpenseStatus, SettlementStatus, PaymentMethod } from '../../types/enums';

function makeExpense(overrides: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id: 'exp-1',
    groupId: 'g1',
    amount: 100,
    currency: 'USD',
    categoryId: 'cat-1',
    description: 'Dinner',
    date: '2026-06-01',
    paidBy: 'alice',
    paymentMethod: PaymentMethod.CASH,
    splitMode: SplitMode.RATIO,
    splits: [
      { memberId: 'alice', ratio: 0.5, isPaid: false },
      { memberId: 'bob', ratio: 0.5, isPaid: false },
    ],
    status: ExpenseStatus.UNSETTLED,
    isRecurring: false,
    createdAt: '2026-06-01T00:00:00Z',
    updatedAt: '2026-06-01T00:00:00Z',
    createdBy: 'alice',
    ...overrides,
  };
}

function makeSettlement(overrides: Partial<SettlementProposal> = {}): SettlementProposal {
  return {
    id: 'set-1',
    groupId: 'g1',
    fromUserId: 'alice',
    toUserId: 'bob',
    amount: 50,
    currency: 'USD',
    status: SettlementStatus.APPROVED,
    proposedAt: '2026-06-05T00:00:00Z',
    createdAt: '2026-06-05T00:00:00Z',
    updatedAt: '2026-06-05T00:00:00Z',
    relatedExpenseIds: [],
    ...overrides,
  };
}

describe('buildPersonalLog', () => {
  it('returns empty entries when there are no expenses or settlements', () => {
    const log = buildPersonalLog('alice', [], [], ['alice', 'bob']);
    expect(log.entries).toHaveLength(0);
    expect(log.memberId).toBe('alice');
  });

  it('includes a paid expense from the members perspective', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const log = buildPersonalLog('alice', [expense], [], ['alice', 'bob']);
    expect(log.entries).toHaveLength(1);
    const entry = log.entries[0]!;
    expect(entry.type).toBe('expense');
    expect(entry.description).toContain('Paid');
    expect(entry.share).toBe(50); // 100 - 50 (her own split)
    expect(entry.runningBalance).toBe(50);
  });

  it('includes an expense where the member owes money', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const log = buildPersonalLog('bob', [expense], [], ['alice', 'bob']);
    expect(log.entries).toHaveLength(1);
    const entry = log.entries[0]!;
    expect(entry.type).toBe('expense');
    expect(entry.description).toContain('Owes');
    expect(entry.share).toBe(-50);
    expect(entry.runningBalance).toBe(-50);
  });

  it('skips expenses with PENDING_APPROVAL status', () => {
    const expense = makeExpense({ status: ExpenseStatus.PENDING_APPROVAL, paidBy: 'alice' });
    const log = buildPersonalLog('alice', [expense], [], ['alice', 'bob']);
    expect(log.entries).toHaveLength(0);
  });

  it('skips expenses where the member is neither payer nor included in splits', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const log = buildPersonalLog('charlie', [expense], [], ['alice', 'bob', 'charlie']);
    expect(log.entries).toHaveLength(0);
  });

  it('includes settlement where member is sender', () => {
    const settlement = makeSettlement({ fromUserId: 'alice', toUserId: 'bob', amount: 30 });
    const log = buildPersonalLog('alice', [], [settlement], ['alice', 'bob']);
    expect(log.entries).toHaveLength(1);
    const entry = log.entries[0]!;
    expect(entry.type).toBe('settlement');
    expect(entry.description).toContain('Paid settlement');
    expect(entry.share).toBe(30);
  });

  it('includes settlement where member is receiver', () => {
    const settlement = makeSettlement({ fromUserId: 'alice', toUserId: 'bob', amount: 30 });
    const log = buildPersonalLog('bob', [], [settlement], ['alice', 'bob']);
    expect(log.entries).toHaveLength(1);
    const entry = log.entries[0]!;
    expect(entry.type).toBe('settlement');
    expect(entry.description).toContain('Received settlement');
    expect(entry.share).toBe(-30);
  });

  it('skips settlements with non-APPROVED status', () => {
    const settlement = makeSettlement({ status: SettlementStatus.PROPOSED });
    const log = buildPersonalLog('alice', [], [settlement], ['alice', 'bob']);
    expect(log.entries).toHaveLength(0);
  });

  it('skips settlements where member is not involved', () => {
    const settlement = makeSettlement({ fromUserId: 'alice', toUserId: 'bob' });
    const log = buildPersonalLog('charlie', [], [settlement], ['alice', 'bob', 'charlie']);
    expect(log.entries).toHaveLength(0);
  });

  it('computes correct running balance across multiple events', () => {
    const expense1 = makeExpense({ id: 'exp-1', description: 'Dinner', amount: 100, paidBy: 'alice', date: '2026-06-01' });
    const expense2 = makeExpense({ id: 'exp-2', description: 'Lunch', amount: 60, paidBy: 'bob', date: '2026-06-10' });
    const settlement = makeSettlement({ amount: 20, proposedAt: '2026-06-15T00:00:00Z', createdAt: '2026-06-15T00:00:00Z', updatedAt: '2026-06-15T00:00:00Z' });

    const log = buildPersonalLog('alice', [expense1, expense2], [settlement], ['alice', 'bob']);
    expect(log.entries).toHaveLength(3);

    // expense1: alice paid 100, share = 100 - 50 = 50, balance = 50
    expect(log.entries[0]!.share).toBe(50);
    expect(log.entries[0]!.runningBalance).toBe(50);

    // expense2: alice owes 30 (half of 60), share = -30, balance = 50 - 30 = 20
    expect(log.entries[1]!.share).toBe(-30);
    expect(log.entries[1]!.runningBalance).toBe(20);

    // settlement: alice sends 20 to bob, share = 20, balance = 20 + 20 = 40
    expect(log.entries[2]!.share).toBe(20);
    expect(log.entries[2]!.runningBalance).toBe(40);
  });

  it('sorts entries by date ascending', () => {
    const expense1 = makeExpense({ id: 'exp-1', description: 'Late', date: '2026-06-10', paidBy: 'alice' });
    const expense2 = makeExpense({ id: 'exp-2', description: 'Early', date: '2026-06-01', paidBy: 'alice' });

    const log = buildPersonalLog('alice', [expense1, expense2], [], ['alice', 'bob']);
    expect(log.entries[0]!.description).toContain('Early');
    expect(log.entries[1]!.description).toContain('Late');
  });

  it('uses displayNames for counterparty resolution', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const log = buildPersonalLog('bob', [expense], [], ['alice', 'bob'], { alice: 'Alice' });
    expect(log.entries[0]!.counterparty).toBe('Alice');
  });

  it('falls back to raw userId when displayName is missing', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const log = buildPersonalLog('bob', [expense], [], ['alice', 'bob']);
    expect(log.entries[0]!.counterparty).toBe('alice');
  });

  it('includes expenseId and settlementId fields', () => {
    const expense = makeExpense({ paidBy: 'alice' });
    const settlement = makeSettlement({ fromUserId: 'alice', toUserId: 'bob' });

    const log = buildPersonalLog('alice', [expense], [settlement], ['alice', 'bob']);
    const expEntry = log.entries.find((e) => e.type === 'expense')!;
    const setEntry = log.entries.find((e) => e.type === 'settlement')!;

    expect(expEntry.expenseId).toBe('exp-1');
    expect(setEntry.settlementId).toBe('set-1');
  });

  it('provides final balance matching net position', () => {
    const expense = makeExpense({ paidBy: 'alice', amount: 100 });
    const settlement = makeSettlement({ fromUserId: 'bob', toUserId: 'alice', amount: 50, proposedAt: '2026-06-10T00:00:00Z', createdAt: '2026-06-10T00:00:00Z', updatedAt: '2026-06-10T00:00:00Z' });

    const log = buildPersonalLog('alice', [expense], [settlement], ['alice', 'bob']);
    expect(log.finalBalance.userId).toBe('alice');
    const lastEntry = log.entries[log.entries.length - 1]!;
    expect(typeof lastEntry.runningBalance).toBe('number');
    expect(typeof log.finalBalance.net).toBe('number');
  });
});
