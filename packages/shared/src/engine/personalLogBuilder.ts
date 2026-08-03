import { GroupExpense } from '../types/group';
import { SettlementProposal } from '../types/settlement';
import { SettlementStatus, ExpenseStatus } from '../types/enums';
import { computeNetBalances, getSplitAmount, DetailedBalance } from './balanceCalculator';

export interface PersonalLogEntry {
  id: string;
  type: 'expense' | 'settlement';
  description: string;
  amount: number;
  share: number;
  runningBalance: number;
  counterparty: string;
  date: string;
  expenseId?: string;
  settlementId?: string;
}

export interface PersonalLog {
  memberId: string;
  entries: PersonalLogEntry[];
  finalBalance: DetailedBalance;
  generatedAt: string;
}

export function buildPersonalLog(
  memberId: string,
  expenses: GroupExpense[],
  settlements: SettlementProposal[],
  allMemberIds: string[],
  displayNames?: Record<string, string>
): PersonalLog {
  const resolveName = (userId: string): string =>
    displayNames?.[userId] ?? userId;

  const events: Array<{
    id: string;
    type: 'expense' | 'settlement';
    date: string;
    description: string;
    amount: number;
    share: number;
    counterparty: string;
    expenseId?: string;
    settlementId?: string;
  }> = [];

  for (const expense of expenses) {
    if (expense.status === ExpenseStatus.PENDING_APPROVAL) continue;

    const mySplit = expense.splits.find((s) => s.memberId === memberId);
    if (!mySplit && expense.paidBy !== memberId) continue;

    const share = mySplit ? getSplitAmount(expense, mySplit) : 0;

    if (expense.paidBy === memberId) {
      const othersOwe = expense.splits
        .filter((s) => s.memberId !== memberId && !s.isPaid)
        .reduce((sum, s) => sum + getSplitAmount(expense, s), 0);

      events.push({
        id: `exp-${expense.id}`,
        type: 'expense',
        date: expense.date,
        description: `Paid: ${expense.description}`,
        amount: expense.amount,
        share: othersOwe,
        counterparty: expense.splits
          .filter((s) => s.memberId !== memberId)
          .map((s) => resolveName(s.memberId))
          .join(', '),
        expenseId: expense.id,
      });
    } else if (mySplit && !mySplit.isPaid) {
      events.push({
        id: `exp-${expense.id}-${memberId}`,
        type: 'expense',
        date: expense.date,
        description: `Owes: ${expense.description}`,
        amount: expense.amount,
        share: -share,
        counterparty: resolveName(expense.paidBy),
        expenseId: expense.id,
      });
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== SettlementStatus.APPROVED) continue;
    if (
      settlement.fromUserId !== memberId &&
      settlement.toUserId !== memberId
    ) {
      continue;
    }

    const isSender = settlement.fromUserId === memberId;
    const counterpartyId = isSender ? settlement.toUserId : settlement.fromUserId;
    events.push({
      id: `set-${settlement.id}`,
      type: 'settlement',
      date: settlement.markedPaidAt || settlement.proposedAt || settlement.createdAt,
      description: isSender
        ? `Paid settlement to ${resolveName(counterpartyId)}`
        : `Received settlement from ${resolveName(counterpartyId)}`,
      amount: settlement.amount,
      share: isSender ? -settlement.amount : settlement.amount,
      counterparty: resolveName(counterpartyId),
      settlementId: settlement.id,
    });
  }

  events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let runningBalance = 0;
  const entries: PersonalLogEntry[] = events.map((event) => {
    runningBalance += event.share;
    return {
      id: event.id,
      type: event.type,
      description: event.description,
      amount: event.amount,
      share: event.share,
      runningBalance: Math.round(runningBalance * 100) / 100,
      counterparty: event.counterparty,
      date: event.date,
      expenseId: event.expenseId,
      settlementId: event.settlementId,
    };
  });

  const allBalances = computeNetBalances(expenses, settlements, allMemberIds);
  const finalBalance = allBalances.find((b) => b.userId === memberId) || {
    userId: memberId,
    net: 0,
    owesTo: {},
    owedBy: {},
  };

  return {
    memberId,
    entries,
    finalBalance,
    generatedAt: new Date().toISOString(),
  };
}
