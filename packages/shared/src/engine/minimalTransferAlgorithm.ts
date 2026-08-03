import { TransferProposal } from '../types/settlement';
import { DetailedBalance } from './balanceCalculator';

export interface TransferResult {
  transfers: TransferProposal[];
  totalTransfers: number;
  totalAmount: number;
}

export function generateMinimalTransfers(
  balances: DetailedBalance[],
  currency: string,
  relatedExpenseIdsByUser?: Record<string, string[]>
): TransferResult {
  const netBalances: { userId: string; amount: number }[] = [];

  for (const balance of balances) {
    const rounded = Math.round(balance.net * 100) / 100;
    if (Math.abs(rounded) > 0.001) {
      netBalances.push({ userId: balance.userId, amount: rounded });
    }
  }

  const transfers: TransferProposal[] = [];
  let totalAmount = 0;

  const creditors = netBalances
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const debtors = netBalances
    .filter((b) => b.amount < 0)
    .map((b) => ({ userId: b.userId, amount: Math.abs(b.amount) }))
    .sort((a, b) => b.amount - a.amount);

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;

    const settleAmount = Math.min(creditor.amount, debtor.amount);
    const roundedAmount = Math.round(settleAmount * 100) / 100;

    if (roundedAmount > 0) {
      const expenseIds = [
        ...new Set([
          ...(relatedExpenseIdsByUser?.[debtor.userId] || []),
          ...(relatedExpenseIdsByUser?.[creditor.userId] || []),
        ]),
      ];
      transfers.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: roundedAmount,
        currency,
        relatedExpenseIds: expenseIds,
      });
      totalAmount += roundedAmount;
    }

    creditor.amount -= settleAmount;
    debtor.amount -= settleAmount;

    if (creditor.amount < 0.001) ci++;
    if (debtor.amount < 0.001) di++;
  }

  return {
    transfers,
    totalTransfers: transfers.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}
