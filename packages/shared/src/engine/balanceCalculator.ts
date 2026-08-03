import { GroupExpense, ExpenseSplit } from '../types/group';
import { SettlementProposal } from '../types/settlement';
import { SettlementStatus, ExpenseStatus } from '../types/enums';

export interface BalanceMap {
  [userId: string]: number;
}

export interface DetailedBalance {
  userId: string;
  net: number;
  owesTo: Record<string, number>;
  owedBy: Record<string, number>;
}

export interface BalanceWarning {
  type: 'settlement_overlap' | 'unlinked_settlement';
  message: string;
  settlementId: string;
  expenseId?: string;
}

export function detectSettlementOverlap(
  expenses: GroupExpense[],
  settlements: SettlementProposal[]
): BalanceWarning[] {
  const warnings: BalanceWarning[] = [];
  const expenseById = new Map(expenses.map((e) => [e.id, e]));

  for (const settlement of settlements) {
    if (settlement.status !== SettlementStatus.APPROVED) continue;

    if (settlement.relatedExpenseIds.length === 0) {
      warnings.push({
        type: 'unlinked_settlement',
        message: `Settlement ${settlement.id} has no related expense IDs — cannot verify split overlap`,
        settlementId: settlement.id,
      });
      continue;
    }

    for (const expId of settlement.relatedExpenseIds) {
      const expense = expenseById.get(expId);
      if (!expense) continue;

      const overlappingSplit = expense.splits.find(
        (s) =>
          s.memberId === settlement.fromUserId && s.isPaid
      );
      if (overlappingSplit) {
        warnings.push({
          type: 'settlement_overlap',
          message: `Settlement ${settlement.id} pays for expense ${expId} which already has split.isPaid=true for user ${settlement.fromUserId} — potential double-count`,
          settlementId: settlement.id,
          expenseId: expId,
        });
      }
    }
  }

  return warnings;
}

export function currencyBucket(currency?: string | null): string {
  const c = (currency || '').trim().toUpperCase();
  return c || 'default';
}

export function computeNetBalances(
  expenses: GroupExpense[],
  settlements: SettlementProposal[],
  memberIds: string[]
): DetailedBalance[] {
  // pairwise[currency][from][to] — debts are tracked per currency so that a
  // settlement never clears debt in a different currency (S6).
  const pairwise: Record<string, Record<string, Record<string, number>>> = {};

  function initMemberPairs(currency: string) {
    if (!pairwise[currency]) pairwise[currency] = {};
    for (const id of memberIds) {
      if (!pairwise[currency][id]) pairwise[currency][id] = {};
      for (const other of memberIds) {
        if (other !== id && pairwise[currency][id]![other] === undefined) {
          pairwise[currency][id]![other] = 0;
        }
      }
    }
  }

  function bucketHasDebt(currency: string): boolean {
    const pairs = pairwise[currency];
    if (!pairs) return false;
    return Object.values(pairs).some((owed) =>
      Object.values(owed).some((amt) => amt > 0)
    );
  }

  initMemberPairs('default');

  const expenseById = new Map(expenses.map((e) => [e.id, e]));

  for (const expense of expenses) {
    if (expense.status === ExpenseStatus.PENDING_APPROVAL) continue;
    if (typeof expense.amount !== 'number' || isNaN(expense.amount) || expense.amount <= 0) continue;

    const paidBy = expense.paidBy;
    if (!memberIds.includes(paidBy)) continue;

    const currency = currencyBucket(expense.currency);
    initMemberPairs(currency);

    for (const split of expense.splits) {
      if (split.isPaid) continue;
      if (!memberIds.includes(split.memberId)) continue;

      const amount = getSplitAmount(expense, split);
      if (amount <= 0) continue;

      pairwise[currency]![split.memberId]![paidBy] =
        (pairwise[currency]![split.memberId]![paidBy] || 0) + amount;
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== SettlementStatus.APPROVED) continue;
    if (!memberIds.includes(settlement.fromUserId) || !memberIds.includes(settlement.toUserId)) continue;

    let currency = currencyBucket(settlement.currency);
    // Legacy settlements carry no currency — apply them against the only
    // currency that has outstanding debt when the default bucket is empty.
    if (currency === 'default' && !bucketHasDebt('default')) {
      const nonDefaultWithDebt = Object.keys(pairwise).filter(
        (c) => c !== 'default' && bucketHasDebt(c)
      );
      if (nonDefaultWithDebt.length === 1) {
        currency = nonDefaultWithDebt[0]!;
      }
    }
    initMemberPairs(currency);

    const from = settlement.fromUserId;
    const to = settlement.toUserId;
    const amount = settlement.amount;

    const currentDebt = pairwise[currency]![from]![to] || 0;
    const remaining = currentDebt - amount;

    if (remaining >= 0) {
      pairwise[currency]![from]![to] = remaining;
    } else {
      pairwise[currency]![from]![to] = 0;
      pairwise[currency]![to]![from] = (pairwise[currency]![to]![from] || 0) + Math.abs(remaining);
    }
  }

  for (const bucket of Object.values(pairwise)) {
    for (const a of memberIds) {
      for (const b of memberIds) {
        if (a === b) continue;
        const aOwesB = bucket[a]![b] || 0;
        const bOwesA = bucket[b]![a] || 0;
        if (aOwesB > 0 && bOwesA > 0) {
          const net = aOwesB - bOwesA;
          if (net > 0) {
            bucket[a]![b] = net;
            bucket[b]![a] = 0;
          } else if (net < 0) {
            bucket[b]![a] = -net;
            bucket[a]![b] = 0;
          } else {
            bucket[a]![b] = 0;
            bucket[b]![a] = 0;
          }
        }
      }
    }
  }

  const results: DetailedBalance[] = [];

  for (const id of memberIds) {
    const owesTo: Record<string, number> = {};
    const owedBy: Record<string, number> = {};
    let totalOwes = 0;
    let totalOwed = 0;

    for (const other of memberIds) {
      if (other === id) continue;
      let owes = 0;
      let owed = 0;
      for (const bucket of Object.values(pairwise)) {
        owes += bucket[id]![other] || 0;
        owed += bucket[other]![id] || 0;
      }

      if (owes > 0) {
        owesTo[other] = Math.round(owes * 100) / 100;
        totalOwes += owes;
      }
      if (owed > 0) {
        owedBy[other] = Math.round(owed * 100) / 100;
        totalOwed += owed;
      }
    }

    results.push({
      userId: id,
      net: Math.round((totalOwed - totalOwes) * 100) / 100,
      owesTo,
      owedBy,
    });
  }

  return results;
}

export function getTotalOwed(
  balances: DetailedBalance[],
  userId: string
): number {
  const balance = balances.find((b) => b.userId === userId);
  if (!balance) return 0;

  return Object.values(balance.owedBy).reduce((sum, amt) => sum + amt, 0);
}

export function getTotalDebt(
  balances: DetailedBalance[],
  userId: string
): number {
  const balance = balances.find((b) => b.userId === userId);
  if (!balance) return 0;

  return Object.values(balance.owesTo).reduce((sum, amt) => sum + amt, 0);
}

export function getSplitAmount(expense: GroupExpense, split: ExpenseSplit): number {
  if (split.fixedAmount !== undefined) {
    return split.fixedAmount;
  }
  return roundToCents(expense.amount * split.ratio);
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
