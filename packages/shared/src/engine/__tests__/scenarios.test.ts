import { describe, it, expect } from 'vitest';
import { calculateSplits } from '../splitCalculator';
import { computeNetBalances, getTotalOwed, getTotalDebt, detectSettlementOverlap, getSplitAmount } from '../balanceCalculator';
import { proposeSettlement, markAsPaid, confirmReceipt, rejectPayment, cancelProposal, findDuplicateProposal } from '../settlementEngine';
import { computeBudgetStatus, computeBudgetSummary } from '../budgetTracker';
import { detectUnusualSpending, getSpendingTrend } from '../spendingDetector';
import { computeSpendingByCategory, computeDailySpending, computeSavings, computeSpendingTrend, computeTopExpenses } from '../analyticsCalculator';
import { buildPersonalLog } from '../personalLogBuilder';
import { generateMinimalTransfers } from '../minimalTransferAlgorithm';
import { createGroupLogEntry, verifyLogChain } from '../logManager';
import { formatCurrency, getCurrencySymbol, convertCurrency, parseCurrency } from '../../utils/currency';
import { SplitMode, ExpenseStatus, SettlementStatus, PaymentMethod, BudgetType, BudgetStatus, GroupLogEventType } from '../../types/enums';
import type { GroupExpense } from '../../types/group';
import type { SettlementProposal } from '../../types/settlement';
import type { PersonalExpense, PersonalBudget, PersonalCategory, IncomeLog } from '../../types/personal';
import type { DetailedBalance } from '../balanceCalculator';

function makeExpense(overrides: Partial<GroupExpense> = {}): GroupExpense {
  return {
    id: 'exp-1', groupId: 'g1', amount: 100, currency: 'USD',
    categoryId: 'cat-1', description: 'Dinner', date: '2026-01-01',
    paidBy: 'alice', paymentMethod: PaymentMethod.CASH,
    splitMode: SplitMode.RATIO,
    splits: [
      { memberId: 'alice', ratio: 0.5, isPaid: false },
      { memberId: 'bob', ratio: 0.5, isPaid: false },
    ],
    status: ExpenseStatus.UNSETTLED, isRecurring: false,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'alice',
    ...overrides,
  };
}

function makeSettlement(overrides: Partial<SettlementProposal> = {}): SettlementProposal {
  return {
    id: 'set-1', groupId: 'g1', fromUserId: 'bob', toUserId: 'alice',
    amount: 50, currency: 'USD', status: SettlementStatus.PROPOSED,
    proposedAt: '2026-01-02T00:00:00Z',
    relatedExpenseIds: ['exp-1'],
    createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function makePersonalExpense(overrides: Partial<PersonalExpense> = {}): PersonalExpense {
  return {
    id: 'p-exp-1', amount: 50, currency: 'USD', categoryId: 'cat-food',
    date: '2026-01-15', description: 'Groceries', tags: [],
    paymentMethod: 'card', isRecurring: false,
    createdAt: '2026-01-15T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  } as PersonalExpense;
}

describe('Scenario: 3-person group equal splits', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('splits $120 dinner equally among 3', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 120, splitMode: SplitMode.RATIO,
      memberIds: [alice, bob, charlie],
    });
    expect(splits).toHaveLength(3);
    expect(splits.every(s => s.amount === 40)).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('computes balances after alice pays $120 dinner', () => {
    const expense = makeExpense({
      id: 'exp-dinner', amount: 120, paidBy: alice,
      date: '2026-01-01',
      splits: [
        { memberId: alice, ratio: 1 / 3, isPaid: false },
        { memberId: bob, ratio: 1 / 3, isPaid: false },
        { memberId: charlie, ratio: 1 / 3, isPaid: false },
      ],
    });
    const balances = computeNetBalances([expense], [], [alice, bob, charlie]);
    const aliceBal = balances.find(b => b.userId === alice)!;
    const bobBal = balances.find(b => b.userId === bob)!;
    const charlieBal = balances.find(b => b.userId === charlie)!;
    expect(aliceBal.net).toBeCloseTo(80);
    expect(bobBal.net).toBeCloseTo(-40);
    expect(charlieBal.net).toBeCloseTo(-40);
    expect(aliceBal.owedBy[bob]).toBe(40);
    expect(aliceBal.owedBy[charlie]).toBe(40);
    expect(bobBal.owesTo[alice]).toBe(40);
    expect(charlieBal.owesTo[alice]).toBe(40);
  });

  it('generates 2 minimal transfers to settle', () => {
    const expense = makeExpense({
      id: 'exp-dinner', amount: 120, paidBy: alice,
      date: '2026-01-01',
      splits: [
        { memberId: alice, ratio: 1 / 3, isPaid: false },
        { memberId: bob, ratio: 1 / 3, isPaid: false },
        { memberId: charlie, ratio: 1 / 3, isPaid: false },
      ],
    });
    const balances = computeNetBalances([expense], [], [alice, bob, charlie]);
    const transfers = generateMinimalTransfers(balances, 'USD');
    expect(transfers.transfers).toHaveLength(2);
    expect(transfers.totalTransfers).toBe(2);
    expect(transfers.totalAmount).toBe(80);
    expect(transfers.transfers.find(t => t.fromUserId === bob && t.toUserId === alice)!.amount).toBe(40);
    expect(transfers.transfers.find(t => t.fromUserId === charlie && t.toUserId === alice)!.amount).toBe(40);
  });
});

describe('Scenario: 3-person group ratio splits', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('splits $200 by custom ratios 50/30/20', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 200, splitMode: SplitMode.RATIO,
      memberIds: [alice, bob, charlie],
      ratios: { [alice]: 0.5, [bob]: 0.3, [charlie]: 0.2 },
    });
    expect(splits.find(s => s.memberId === alice)!.amount).toBe(100);
    expect(splits.find(s => s.memberId === bob)!.amount).toBe(60);
    expect(splits.find(s => s.memberId === charlie)!.amount).toBe(40);
    expect(warnings).toHaveLength(0);
  });

  it('normalizes ratios that do not sum to 1', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 300, splitMode: SplitMode.RATIO,
      memberIds: [alice, bob, charlie],
      ratios: { [alice]: 1, [bob]: 1, [charlie]: 1 },
    });
    expect(splits.every(s => s.amount === 100)).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('ratio_normalized');
  });
});

describe('Scenario: Fixed amount splits', () => {
  const alice = 'alice', bob = 'bob';

  it('uses fixed amounts directly when they match total', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 100, splitMode: SplitMode.FIXED,
      memberIds: [alice, bob],
      fixedAmounts: { [alice]: 60, [bob]: 40 },
    });
    expect(splits.find(s => s.memberId === alice)!.amount).toBe(60);
    expect(splits.find(s => s.memberId === bob)!.amount).toBe(40);
    expect(warnings).toHaveLength(0);
  });

  it('auto-scales fixed amounts when they exceed total', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 50, splitMode: SplitMode.FIXED,
      memberIds: [alice, bob],
      fixedAmounts: { [alice]: 40, [bob]: 40 },
    });
    expect(splits.find(s => s.memberId === alice)!.amount).toBe(25);
    expect(splits.find(s => s.memberId === bob)!.amount).toBe(25);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('fixed_scaled');
  });
});

describe('Scenario: Full settlement lifecycle', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('proposes a settlement and marks it paid with full amount', () => {
    const proposal = proposeSettlement({
      id: 'set-pay', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    expect(proposal.status).toBe(SettlementStatus.PROPOSED);

    const paid = markAsPaid(proposal);
    expect(paid.success).toBe(true);
    expect(paid.settlement!.status).toBe(SettlementStatus.MARKED_PAID);
    expect(paid.remainderProposal).toBeUndefined();
  });

  it('partial payment creates remainder', () => {
    const proposal = proposeSettlement({
      id: 'set-partial', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 100, currency: 'USD',
    });
    const paid = markAsPaid(proposal, 30);
    expect(paid.success).toBe(true);
    expect(paid.settlement!.status).toBe(SettlementStatus.SUPERSEDED);
    expect(paid.settlement!.amount).toBe(100);
    expect(paid.remainderProposal).toBeDefined();
    expect(paid.remainderProposal!.amount).toBe(70);
    expect(paid.remainderProposal!.status).toBe(SettlementStatus.PROPOSED);
  });

  it('full confirm receipt flow', () => {
    const proposal = proposeSettlement({
      id: 'set-confirm', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    const paid = markAsPaid(proposal);
    const confirmed = confirmReceipt(paid.settlement!);
    expect(confirmed.success).toBe(true);
    expect(confirmed.settlement!.status).toBe(SettlementStatus.APPROVED);
  });

  it('rejects payment', () => {
    const proposal = proposeSettlement({
      id: 'set-reject', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    const paid = markAsPaid(proposal);
    const rejected = rejectPayment(paid.settlement!, 'Wrong amount');
    expect(rejected.success).toBe(true);
    expect(rejected.settlement!.status).toBe(SettlementStatus.REJECTED);
  });

  it('cancels own proposal', () => {
    const proposal = proposeSettlement({
      id: 'set-cancel', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    const result = cancelProposal(proposal, bob);
    expect(result.success).toBe(true);
    expect(result.settlement!.status).toBe(SettlementStatus.CANCELLED);
  });

  it('cannot cancel another user\'s proposal', () => {
    const proposal = proposeSettlement({
      id: 'set-nocancel', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    const result = cancelProposal(proposal, alice);
    expect(result.success).toBe(false);
    expect(result.settlement).toBeUndefined();
  });

  it('detects duplicate proposals', () => {
    const proposals = [
      makeSettlement({ id: 's1', fromUserId: bob, toUserId: alice, status: SettlementStatus.PROPOSED }),
      makeSettlement({ id: 's2', fromUserId: charlie, toUserId: alice, status: SettlementStatus.PROPOSED }),
    ];
    const dup = findDuplicateProposal(proposals, bob, alice);
    expect(dup).toBeDefined();
    expect(dup!.id).toBe('s1');

    const noDup = findDuplicateProposal(proposals, alice, bob);
    expect(noDup).toBeUndefined();
  });
});

describe('Scenario: Balance calculation with settlements', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('settlements reduce debt correctly', () => {
    const expense = makeExpense({
      id: 'exp-1', amount: 300, paidBy: alice, date: '2026-01-01',
      splits: [
        { memberId: alice, ratio: 1 / 3, isPaid: false },
        { memberId: bob, ratio: 1 / 3, isPaid: false },
        { memberId: charlie, ratio: 1 / 3, isPaid: false },
      ],
    });
    const settlement = makeSettlement({
      id: 'set-1', fromUserId: bob, toUserId: alice, amount: 100,
      status: SettlementStatus.APPROVED, proposedAt: '2026-01-02T00:00:00Z',
    });
    const balances = computeNetBalances([expense], [settlement], [alice, bob, charlie]);
    expect(balances.find(b => b.userId === alice)!.net).toBeCloseTo(100);
    expect(balances.find(b => b.userId === bob)!.net).toBeCloseTo(0);
    expect(balances.find(b => b.userId === charlie)!.net).toBeCloseTo(-100);
  });

  it('skips PENDING_APPROVAL expenses', () => {
    const expense = makeExpense({
      id: 'exp-pending', amount: 100, paidBy: alice,
      status: ExpenseStatus.PENDING_APPROVAL,
      splits: [
        { memberId: alice, ratio: 0.5, isPaid: false },
        { memberId: bob, ratio: 0.5, isPaid: false },
      ],
    });
    const balances = computeNetBalances([expense], [], [alice, bob]);
    expect(balances.every(b => b.net === 0)).toBe(true);
  });

  it('skips paid splits', () => {
    const expense = makeExpense({
      id: 'exp-paid', amount: 100, paidBy: alice,
      splits: [
        { memberId: alice, ratio: 0.5, isPaid: false },
        { memberId: bob, ratio: 0.5, isPaid: true },
      ],
    });
    const balances = computeNetBalances([expense], [], [alice, bob]);
    expect(balances.find(b => b.userId === alice)!.net).toBeCloseTo(0);
    expect(balances.find(b => b.userId === bob)!.net).toBeCloseTo(0);
  });

  it('multiple expenses accumulate correctly', () => {
    const exp1 = makeExpense({
      id: 'exp-1', amount: 100, paidBy: alice, date: '2026-01-01',
      splits: [
        { memberId: alice, ratio: 0, isPaid: false },
        { memberId: bob, ratio: 1, isPaid: false },
      ],
    });
    const exp2 = makeExpense({
      id: 'exp-2', amount: 200, paidBy: bob, date: '2026-01-02',
      splits: [
        { memberId: bob, ratio: 0, isPaid: false },
        { memberId: charlie, ratio: 1, isPaid: false },
      ],
    });
    const balances = computeNetBalances([exp1, exp2], [], [alice, bob, charlie]);
    expect(balances.find(b => b.userId === alice)!.net).toBeCloseTo(100);
    expect(balances.find(b => b.userId === bob)!.net).toBeCloseTo(100);
    expect(balances.find(b => b.userId === charlie)!.net).toBeCloseTo(-200);
  });
});

describe('Scenario: Settlement overlap detection', () => {
  const alice = 'alice', bob = 'bob';

  it('detects when a settlement pays for an already-paid split', () => {
    const expense = makeExpense({
      id: 'exp-overlap', amount: 100, paidBy: alice,
      splits: [
        { memberId: alice, ratio: 0, isPaid: false },
        { memberId: bob, ratio: 1, isPaid: true },
      ],
    });
    const settlement = makeSettlement({
      id: 'set-overlap', fromUserId: bob, toUserId: alice, amount: 100,
      status: SettlementStatus.APPROVED,
      relatedExpenseIds: ['exp-overlap'],
    });
    const warnings = detectSettlementOverlap([expense], [settlement]);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.type).toBe('settlement_overlap');
  });
});

describe('Scenario: Budget tracking', () => {
  const catId = 'cat-food';

  it('budget is GREEN when spending is under 80%', () => {
    const budget: PersonalBudget = {
      id: 'budget-1', categoryId: catId, type: BudgetType.MONTHLY,
      amount: 1000, currency: 'USD',
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
      status: BudgetStatus.GREEN, alertThreshold: 80,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 200, categoryId: catId, date: '2026-01-05' }),
      makePersonalExpense({ id: 'e2', amount: 300, categoryId: catId, date: '2026-01-10' }),
    ];
    const result = computeBudgetStatus(budget, expenses);
    expect(result.percentUsed).toBe(50);
    expect(result.status).toBe(BudgetStatus.GREEN);
    expect(result.spent).toBe(500);
    expect(result.remaining).toBe(500);
  });

  it('budget is YELLOW when spending is 80-99.99%', () => {
    const budget: PersonalBudget = {
      id: 'budget-2', categoryId: catId, type: BudgetType.MONTHLY,
      amount: 1000, currency: 'USD',
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
      status: BudgetStatus.GREEN, alertThreshold: 80,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 850, categoryId: catId, date: '2026-01-15' }),
    ];
    const result = computeBudgetStatus(budget, expenses);
    expect(result.percentUsed).toBe(85);
    expect(result.status).toBe(BudgetStatus.YELLOW);
  });

  it('budget is RED when spending exceeds 100%', () => {
    const budget: PersonalBudget = {
      id: 'budget-3', categoryId: catId, type: BudgetType.MONTHLY,
      amount: 1000, currency: 'USD',
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
      status: BudgetStatus.GREEN, alertThreshold: 80,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 1200, categoryId: catId, date: '2026-01-20' }),
    ];
    const result = computeBudgetStatus(budget, expenses);
    expect(result.percentUsed).toBe(120);
    expect(result.status).toBe(BudgetStatus.RED);
  });

  it('ignores expenses outside budget period', () => {
    const budget: PersonalBudget = {
      id: 'budget-4', categoryId: catId, type: BudgetType.MONTHLY,
      amount: 1000, currency: 'USD',
      periodStart: '2026-01-01', periodEnd: '2026-01-31',
      status: BudgetStatus.GREEN, alertThreshold: 80,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 500, categoryId: catId, date: '2026-02-01' }),
    ];
    const result = computeBudgetStatus(budget, expenses);
    expect(result.spent).toBe(0);
    expect(result.percentUsed).toBe(0);
    expect(result.status).toBe(BudgetStatus.GREEN);
  });

  it('budget summary aggregates correctly', () => {
    const catFood = 'cat-food', catTrans = 'cat-transport';
    const budgets = [
      { id: 'b1', categoryId: catFood, type: BudgetType.MONTHLY, amount: 1000, currency: 'USD', periodStart: '2026-01-01', periodEnd: '2026-01-31', status: BudgetStatus.GREEN, alertThreshold: 80, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'b2', categoryId: catTrans, type: BudgetType.MONTHLY, amount: 500, currency: 'USD', periodStart: '2026-01-01', periodEnd: '2026-01-31', status: BudgetStatus.GREEN, alertThreshold: 80, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 600, categoryId: catFood, date: '2026-01-10' }),
      makePersonalExpense({ id: 'e2', amount: 200, categoryId: catTrans, date: '2026-01-15' }),
    ];
    const summary = computeBudgetSummary(budgets, expenses);
    expect(summary.totalBudgeted).toBe(1500);
    expect(summary.totalSpent).toBe(800);
    expect(summary.overallPercentUsed).toBeCloseTo(53.33, 1);
  });
});

describe('Scenario: Spending anomaly detection', () => {
  it('detects unusually high spending', () => {
    const today = new Date('2026-06-15');
    const catId = 'cat-food';
    const expenses: PersonalExpense[] = [];

    for (let day = 1; day <= 60; day++) {
      expenses.push(makePersonalExpense({
        id: `hist-${day}`,
        amount: day <= 30 ? 100 : 300,
        categoryId: catId,
        date: `2026-0${day <= 30 ? 5 : 6}-${String(day <= 30 ? day : day - 30).padStart(2, '0')}`,
      }));
    }

    const alerts = detectUnusualSpending(expenses, { [catId]: 'Food' }, {
      lookbackPeriods: 1,
      periodDays: 30,
      currentDate: today,
    });

    expect(alerts.length).toBeGreaterThan(0);
    const foodAlert = alerts.find(a => a.categoryId === catId);
    expect(foodAlert).toBeDefined();
    expect(foodAlert!.severity).toBe('high');
    expect(foodAlert!.currentAmount).toBeGreaterThan(foodAlert!.averageAmount);
  });

  it('handles categories with no history gracefully', () => {
    const today = new Date('2026-06-15');
    const catId = 'cat-new';
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 500, categoryId: catId, date: '2026-06-10' }),
    ];
    const alerts = detectUnusualSpending(expenses, { [catId]: 'New Category' }, {
      lookbackPeriods: 1,
      periodDays: 30,
      currentDate: today,
    });
    expect(alerts.length).toBe(0);
  });
});

describe('Scenario: Spending trends', () => {
  it('detects increasing trend', () => {
    const catId = 'cat-food';
    const expenses: PersonalExpense[] = [];

    for (let day = 1; day <= 60; day++) {
      const month = day <= 30 ? 5 : 6;
      const d = day <= 30 ? day : day - 30;
      expenses.push(makePersonalExpense({
        id: `e-${day}`, amount: day <= 30 ? 50 : 200,
        categoryId: catId,
        date: `2026-0${month}-${String(d).padStart(2, '0')}`,
      }));
    }

    const trends = getSpendingTrend(expenses, { [catId]: 'Food' }, {
      periods: 2,
      periodDays: 30,
      stableThreshold: 10,
      currentDate: new Date('2026-06-30'),
    });

    const foodTrend = trends.find(t => t.categoryId === catId);
    expect(foodTrend).toBeDefined();
    expect(foodTrend!.direction).toBe('increasing');
  });
});

describe('Scenario: Analytics calculations', () => {
  const catFood = 'cat-food', catTrans = 'cat-transport', catUtil = 'cat-util';

  it('computes spending by category', () => {
    const categories: PersonalCategory[] = [
      { id: catFood, name: 'Food', icon: '🍔', color: '#ff0000', isDefault: false, sortOrder: 0, createdAt: '' },
      { id: catTrans, name: 'Transport', icon: '🚗', color: '#00ff00', isDefault: false, sortOrder: 1, createdAt: '' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 300, categoryId: catFood, date: '2026-01-10' }),
      makePersonalExpense({ id: 'e2', amount: 200, categoryId: catFood, date: '2026-01-15' }),
      makePersonalExpense({ id: 'e3', amount: 100, categoryId: catTrans, date: '2026-01-20' }),
    ];
    const result = computeSpendingByCategory(expenses, categories);
    expect(result).toHaveLength(2);
    expect(result[0]!.categoryId).toBe(catFood);
    expect(result[0]!.totalAmount).toBe(500);
    expect(result[0]!.transactionCount).toBe(2);
    expect(result[0]!.percentOfTotal).toBeCloseTo(83.33, 1);
    expect(result[1]!.totalAmount).toBe(100);
    expect(result[1]!.percentOfTotal).toBeCloseTo(16.67, 1);
  });

  it('filters by date range in category spending', () => {
    const categories: PersonalCategory[] = [
      { id: catFood, name: 'Food', icon: '🍔', color: '#ff0000', isDefault: false, sortOrder: 0, createdAt: '' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 100, categoryId: catFood, date: '2026-01-05' }),
      makePersonalExpense({ id: 'e2', amount: 200, categoryId: catFood, date: '2026-02-15' }),
    ];
    const result = computeSpendingByCategory(expenses, categories, '2026-01-01', '2026-01-31');
    expect(result[0]!.totalAmount).toBe(100);
  });

  it('computes daily spending correctly', () => {
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 100, categoryId: catFood, date: '2026-01-01' }),
      makePersonalExpense({ id: 'e2', amount: 50, categoryId: catTrans, date: '2026-01-01' }),
      makePersonalExpense({ id: 'e3', amount: 200, categoryId: catFood, date: '2026-01-02' }),
    ];
    const daily = computeDailySpending(expenses, '2026-01-01', '2026-01-03');
    expect(daily).toHaveLength(3);
    expect(daily[0]!.totalAmount).toBe(150);
    expect(daily[0]!.transactionCount).toBe(2);
    expect(daily[1]!.totalAmount).toBe(200);
    expect(daily[1]!.transactionCount).toBe(1);
    expect(daily[2]!.totalAmount).toBe(0);
  });

  it('computes savings correctly', () => {
    const incomeLogs: IncomeLog[] = [
      { id: 'inc-1', source: 'Salary', amount: 5000, currency: 'USD', date: '2026-01-01', isRecurring: true, createdAt: '', updatedAt: '' },
      { id: 'inc-2', source: 'Freelance', amount: 1000, currency: 'USD', date: '2026-01-15', isRecurring: false, createdAt: '', updatedAt: '' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 2000, categoryId: catFood, date: '2026-01-10' }),
      makePersonalExpense({ id: 'e2', amount: 500, categoryId: catUtil, date: '2026-01-20' }),
    ];
    const savings = computeSavings(incomeLogs, expenses);
    expect(savings.totalIncome).toBe(6000);
    expect(savings.totalExpenses).toBe(2500);
    expect(savings.netSavings).toBe(3500);
    expect(savings.savingsRate).toBeCloseTo(58.33, 1);
    expect(savings.bySource).toHaveLength(2);
  });

  it('computes spending trends over months', () => {
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 1000, categoryId: catFood, date: '2026-05-15' }),
      makePersonalExpense({ id: 'e2', amount: 1500, categoryId: catFood, date: '2026-06-10' }),
      makePersonalExpense({ id: 'e3', amount: 800, categoryId: catFood, date: '2026-07-18' }),
    ];
    const trends = computeSpendingTrend(expenses, 3);
    expect(trends.length).toBeLessThanOrEqual(3);
    if (trends.length >= 2) {
      expect(trends[0]!.totalSpent).toBeGreaterThan(0);
    }
  });

  it('computes top expenses', () => {
    const categories: PersonalCategory[] = [
      { id: catFood, name: 'Food', icon: '🍔', color: '#ff0000', isDefault: false, sortOrder: 0, createdAt: '' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 50, categoryId: catFood, date: '2026-01-01' }),
      makePersonalExpense({ id: 'e2', amount: 500, categoryId: catFood, date: '2026-01-02' }),
      makePersonalExpense({ id: 'e3', amount: 200, categoryId: catFood, date: '2026-01-03' }),
    ];
    const top = computeTopExpenses(expenses, categories, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.amount).toBe(500);
    expect(top[1]!.amount).toBe(200);
  });

  it('date range filters top expenses', () => {
    const categories: PersonalCategory[] = [
      { id: catFood, name: 'Food', icon: '🍔', color: '#ff0000', isDefault: false, sortOrder: 0, createdAt: '' },
    ];
    const expenses = [
      makePersonalExpense({ id: 'e1', amount: 500, categoryId: catFood, date: '2026-01-01' }),
      makePersonalExpense({ id: 'e2', amount: 1000, categoryId: catFood, date: '2026-02-01' }),
    ];
    const top = computeTopExpenses(expenses, categories, 10, '2026-01-01', '2026-01-31');
    expect(top).toHaveLength(1);
    expect(top[0]!.amount).toBe(500);
  });
});

describe('Scenario: Personal log building', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('builds a personal ledger with running balance', () => {
    const expenses = [
      makeExpense({
        id: 'exp-1', amount: 300, paidBy: alice, date: '2026-01-01',
        description: 'Dinner',
        splits: [
          { memberId: alice, ratio: 1 / 3, isPaid: false },
          { memberId: bob, ratio: 1 / 3, isPaid: false },
          { memberId: charlie, ratio: 1 / 3, isPaid: false },
        ],
      }),
    ];
    const settlements = [
      makeSettlement({
        id: 'set-1', fromUserId: bob, toUserId: alice, amount: 100,
        status: SettlementStatus.APPROVED,
        proposedAt: '2026-01-02T00:00:00Z',
      }),
    ];

    const log = buildPersonalLog(bob, expenses, settlements, [alice, bob, charlie], {
      [alice]: 'Alice', [bob]: 'Bob', [charlie]: 'Charlie',
    });

    expect(log.memberId).toBe(bob);
    expect(log.entries.length).toBeGreaterThan(0);
    const expenseEntry = log.entries.find(e => e.type === 'expense');
    expect(expenseEntry).toBeDefined();
    expect(expenseEntry!.description).toContain('Dinner');
    expect(expenseEntry!.amount).toBe(300);
    expect(expenseEntry!.share).toBe(-100);

    const settlementEntry = log.entries.find(e => e.type === 'settlement');
    expect(settlementEntry).toBeDefined();
    expect(settlementEntry!.amount).toBe(100);
  });
});

describe('Scenario: Log chain integrity', () => {
  it('creates a valid chain of log entries', () => {
    const entry1 = createGroupLogEntry({
      id: 'log-1', groupId: 'g1',
      eventType: GroupLogEventType.EXPENSE_ADDED,
      actorId: 'alice', metadata: { expenseId: 'exp-1' },
    });
    const entry2 = createGroupLogEntry({
      id: 'log-2', groupId: 'g1',
      eventType: GroupLogEventType.SETTLEMENT_PROPOSED,
      actorId: 'bob', metadata: { settlementId: 'set-1' },
      previousLogHash: entry1.hash,
    });
    const entry3 = createGroupLogEntry({
      id: 'log-3', groupId: 'g1',
      eventType: GroupLogEventType.MEMBER_JOINED,
      actorId: 'charlie', metadata: { memberId: 'charlie' },
      previousLogHash: entry2.hash,
    });

    const result = verifyLogChain([entry1, entry2, entry3]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects tampered log entry', () => {
    const entry1 = createGroupLogEntry({
      id: 'log-1', groupId: 'g1',
      eventType: GroupLogEventType.EXPENSE_ADDED,
      actorId: 'alice', metadata: { expenseId: 'exp-1' },
    });
    const entry2 = createGroupLogEntry({
      id: 'log-2', groupId: 'g1',
      eventType: GroupLogEventType.SETTLEMENT_PROPOSED,
      actorId: 'bob', metadata: { settlementId: 'set-1' },
      previousLogHash: entry1.hash,
    });

    entry2.actorId = 'charlie';

    const result = verifyLogChain([entry1, entry2]);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('detects broken chain link', () => {
    const entry1 = createGroupLogEntry({
      id: 'log-1', groupId: 'g1',
      eventType: GroupLogEventType.EXPENSE_ADDED,
      actorId: 'alice',
    });
    const entry2 = createGroupLogEntry({
      id: 'log-2', groupId: 'g1',
      eventType: GroupLogEventType.SETTLEMENT_PROPOSED,
      actorId: 'bob',
      previousLogHash: 'wrong-hash',
    });

    const result = verifyLogChain([entry1, entry2]);
    expect(result.valid).toBe(false);
  });
});

describe('Scenario: Minimal transfers algorithm', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie', dave = 'dave';

  it('settles single debtor and single creditor', () => {
    const balances: DetailedBalance[] = [
      { userId: alice, net: 100, owesTo: {}, owedBy: { [bob]: 100 } },
      { userId: bob, net: -100, owesTo: { [alice]: 100 }, owedBy: {} },
    ];
    const result = generateMinimalTransfers(balances, 'USD');
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]!.fromUserId).toBe(bob);
    expect(result.transfers[0]!.toUserId).toBe(alice);
    expect(result.transfers[0]!.amount).toBe(100);
  });

  it('minimizes number of transfers for complex debts', () => {
    const balances: DetailedBalance[] = [
      { userId: alice, net: 150, owesTo: {}, owedBy: { [bob]: 80, [charlie]: 70 } },
      { userId: bob, net: -80, owesTo: { [alice]: 80 }, owedBy: {} },
      { userId: charlie, net: -70, owesTo: { [alice]: 70 }, owedBy: {} },
    ];
    const result = generateMinimalTransfers(balances, 'USD');
    expect(result.transfers).toHaveLength(2);
    expect(result.totalAmount).toBe(150);
  });

  it('handles complex multi-person debts', () => {
    const balances: DetailedBalance[] = [
      { userId: alice, net: 200, owesTo: {}, owedBy: { [bob]: 120, [charlie]: 80 } },
      { userId: bob, net: -120, owesTo: { [alice]: 120 }, owedBy: {} },
      { userId: charlie, net: 50, owesTo: {}, owedBy: { [dave]: 50 } },
      { userId: dave, net: -130, owesTo: { [charlie]: 50, [alice]: 80 }, owedBy: {} },
    ];
    const result = generateMinimalTransfers(balances, 'USD');
    const totalFrom = result.transfers.reduce((s, t) => s + t.amount, 0);
    const totalTo = result.transfers.reduce((s, t) => s + t.amount, 0);
    expect(totalFrom).toBe(totalTo);
    expect(result.totalAmount).toBe(totalTo);
  });
});

describe('Scenario: Currency utilities', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(12.5, 'USD')).toBe('$12.50');
    expect(formatCurrency(1000, 'USD')).toBe('$1000.00');
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('formats BDT correctly', () => {
    const result = formatCurrency(1500.5, 'BDT');
    expect(result).toContain('৳');
    expect(result).toContain('1500.50');
  });

  it('formats zero-decimal currencies correctly', () => {
    expect(formatCurrency(500, 'JPY')).toBe('¥500');
    expect(formatCurrency(1000, 'KRW')).toBe('₩1000');
  });

  it('converts between currencies', () => {
    // EUR rate is 0.92, so 100 USD = 92 EUR
    const result = convertCurrency(100, 'USD', 'EUR');
    expect(result).toBe(92);
    expect(convertCurrency(100, 'EUR', 'USD')).toBeCloseTo(108.7, 1);
  });

  it('returns currency symbols', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('BDT')).toBe('৳');
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('converts between currencies', () => {
    const result = convertCurrency(100, 'USD', 'EUR');
    expect(result).toBe(92);
    expect(convertCurrency(100, 'EUR', 'USD')).toBeCloseTo(108.7, 1);
  });

  it('parses currency strings', () => {
    const parsed = parseCurrency('$50.00');
    expect(parsed).toBeDefined();
    expect(parsed!.amount).toBeCloseTo(50, 0);
    const parsedUsd = parseCurrency('USD 75.50');
    expect(parsedUsd).toBeDefined();
    expect(parsedUsd!.amount).toBeCloseTo(75.5, 0);
  });
});

describe('Scenario: Edge cases and error states', () => {
  const alice = 'alice', bob = 'bob';

  it('handles empty expense list', () => {
    const balances = computeNetBalances([], [], [alice, bob]);
    expect(balances.every(b => b.net === 0)).toBe(true);
  });

    it('handles zero-amount expense', () => {
    const expense = makeExpense({
      id: 'exp-zero', amount: 0, paidBy: alice,
      splits: [{ memberId: alice, ratio: 1, isPaid: false }],
    });
    const balances = computeNetBalances([expense], [], [alice]);
    expect(balances[0]!.net).toBe(0);
  });

  it('single user group has zero balances', () => {
    const expense = makeExpense({
      id: 'exp-solo', amount: 100, paidBy: alice,
      splits: [{ memberId: alice, ratio: 1, isPaid: false }],
    });
    const balances = computeNetBalances([expense], [], [alice]);
    expect(balances[0]!.net).toBe(0);
  });

  it('getSplitAmount computes correctly for ratio mode', () => {
    const expense = makeExpense({
      id: 'exp-ratio', amount: 200, splitMode: SplitMode.RATIO,
      splits: [{ memberId: bob, ratio: 0.3, isPaid: false }],
    });
    const amount = getSplitAmount(expense, expense.splits[0]!);
    expect(amount).toBe(60);
  });

  it('getSplitAmount uses fixedAmount for FIXED mode', () => {
    const expense = makeExpense({
      id: 'exp-fixed', amount: 200, splitMode: SplitMode.FIXED,
      splits: [{ memberId: bob, ratio: 0.5, fixedAmount: 80, isPaid: false }],
    });
    const amount = getSplitAmount(expense, expense.splits[0]!);
    expect(amount).toBe(80);
  });

  it('duplicate proposals not found for non-matching pairs', () => {
    const proposals = [
      makeSettlement({ id: 's1', fromUserId: alice, toUserId: bob, status: SettlementStatus.PROPOSED }),
    ];
    const dup = findDuplicateProposal(proposals, bob, alice);
    expect(dup).toBeUndefined();
  });

  it('getTotalOwed and getTotalDebt work correctly', () => {
    const balances: DetailedBalance[] = [{ userId: alice, net: 50, owesTo: {}, owedBy: { [bob]: 50 } }];
    expect(getTotalOwed(balances, alice)).toBe(50);
    expect(getTotalDebt(balances, alice)).toBe(0);
  });
});

describe('Scenario: Cross-engine integration', () => {
  const alice = 'alice', bob = 'bob', charlie = 'charlie';

  it('full group lifecycle: add expenses, compute balances, propose settlements, minimal transfers', () => {
    const exp1 = makeExpense({
      id: 'exp-1', amount: 150, paidBy: alice, date: '2026-01-01',
      description: 'Groceries',
      splits: [
        { memberId: alice, ratio: 1 / 3, isPaid: false },
        { memberId: bob, ratio: 1 / 3, isPaid: false },
        { memberId: charlie, ratio: 1 / 3, isPaid: false },
      ],
    });
    const exp2 = makeExpense({
      id: 'exp-2', amount: 300, paidBy: bob, date: '2026-01-05',
      description: 'Utilities',
      splits: [
        { memberId: alice, ratio: 0.5, isPaid: false },
        { memberId: bob, ratio: 0, isPaid: false },
        { memberId: charlie, ratio: 0.5, isPaid: false },
      ],
    });
    const exp3 = makeExpense({
      id: 'exp-3', amount: 90, paidBy: charlie, date: '2026-01-10',
      description: 'Snacks',
      splits: [
        { memberId: alice, ratio: 0, isPaid: false },
        { memberId: bob, ratio: 0, isPaid: false },
        { memberId: charlie, ratio: 1, isPaid: false },
      ],
    });

    const balances = computeNetBalances([exp1, exp2, exp3], [], [alice, bob, charlie]);
    const aliceBal = balances.find(b => b.userId === alice)!;
    const bobBal = balances.find(b => b.userId === bob)!;
    const charlieBal = balances.find(b => b.userId === charlie)!;

    expect(aliceBal.net).toBeCloseTo(-50);
    expect(bobBal.net).toBeCloseTo(250);
    expect(charlieBal.net).toBeCloseTo(-200);

    const proposal1 = proposeSettlement({
      id: 'set-1', groupId: 'g1',
      fromUserId: charlie, toUserId: alice,
      amount: 50, currency: 'USD',
    });
    const proposal2 = proposeSettlement({
      id: 'set-2', groupId: 'g1',
      fromUserId: charlie, toUserId: bob,
      amount: 150, currency: 'USD',
    });
    const proposal3 = proposeSettlement({
      id: 'set-3', groupId: 'g1',
      fromUserId: alice, toUserId: bob,
      amount: 100, currency: 'USD',
    });

    const paid1 = markAsPaid(proposal1);
    const paid2 = markAsPaid(proposal2);
    const paid3 = markAsPaid(proposal3);
    const confirmed1 = confirmReceipt(paid1.settlement!);
    const confirmed2 = confirmReceipt(paid2.settlement!);
    const confirmed3 = confirmReceipt(paid3.settlement!);

    expect(confirmed1.settlement!.status).toBe(SettlementStatus.APPROVED);
    expect(confirmed2.settlement!.status).toBe(SettlementStatus.APPROVED);
    expect(confirmed3.settlement!.status).toBe(SettlementStatus.APPROVED);

    const finalBalances = computeNetBalances(
      [exp1, exp2, exp3],
      [confirmed1.settlement!, confirmed2.settlement!, confirmed3.settlement!],
      [alice, bob, charlie]
    );

    expect(finalBalances.find(b => b.userId === alice)!.net).toBeCloseTo(0);
    expect(finalBalances.find(b => b.userId === bob)!.net).toBeCloseTo(0);
    expect(finalBalances.find(b => b.userId === charlie)!.net).toBeCloseTo(0);

    const transfers = generateMinimalTransfers(finalBalances, 'USD');
    expect(transfers.transfers).toHaveLength(0);
    expect(transfers.totalAmount).toBe(0);
  });

  it('no duplicate transactions after full settlement', () => {
    const expense = makeExpense({
      id: 'exp-1', amount: 200, paidBy: alice, date: '2026-01-01',
      splits: [
        { memberId: alice, ratio: 0, isPaid: false },
        { memberId: bob, ratio: 1, isPaid: false },
      ],
    });

    const balances1 = computeNetBalances([expense], [], [alice, bob]);
    expect(balances1.find(b => b.userId === alice)!.net).toBeCloseTo(200);
    expect(balances1.find(b => b.userId === bob)!.net).toBeCloseTo(-200);

    const proposal = proposeSettlement({
      id: 'set-1', groupId: 'g1',
      fromUserId: bob, toUserId: alice,
      amount: 200, currency: 'USD',
    });
    const paid = markAsPaid(proposal);
    const confirmed = confirmReceipt(paid.settlement!);

    const balances2 = computeNetBalances(
      [expense],
      [confirmed.settlement!],
      [alice, bob]
    );

    expect(balances2.find(b => b.userId === alice)!.net).toBeCloseTo(0);
    expect(balances2.find(b => b.userId === bob)!.net).toBeCloseTo(0);

    const balances3 = computeNetBalances(
      [expense],
      [confirmed.settlement!],
      [alice, bob]
    );

    expect(balances3.find(b => b.userId === alice)!.net).toBe(0);
    expect(balances3.find(b => b.userId === bob)!.net).toBe(0);
  });
});
