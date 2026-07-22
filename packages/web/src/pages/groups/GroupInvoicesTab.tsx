import { useState, useMemo, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { computeNetBalances, generateMinimalTransfers, formatCurrency, SettlementStatus, type DetailedBalance, type TransferProposal } from '@coldfi/shared';
import { useAuthStore } from '../../stores/authStore';
import { useGroupSettlementStore } from '../../stores/groupSettlementStore';
import { useGroupStore } from '../../stores/groupStore';
import { silentCatch } from '../../lib/errorHandler';
import TimeRangeFilter from './TimeRangeFilter';
import InvoiceSummaryCards from './InvoiceSummaryCards';
import SpentByPersonSection from './SpentByPersonSection';
import BalanceOverviewSection from './BalanceOverviewSection';
import SettlementSection from './SettlementSection';

interface Member {
  userId: string;
  displayName: string;
  email?: string;
}

interface ExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  payerId: string;
  date: string;
  createdAt: string;
  splits: { userId: string; amount: number }[];
  displayId?: string;
}

interface TabContext {
  groupId: string;
  group: {
    name: string;
    members: Member[];
    defaultCurrency: string;
    expenses: ExpenseData[];
    settlements: any[];
    balances?: DetailedBalance[];
  };
  currentUserId: string;
}

export default function GroupInvoicesTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const defaultCurrency = group.defaultCurrency || useAuthStore.getState().defaultCurrency;
  const markSettlementAsPaid = useGroupSettlementStore((s) => s.markSettlementAsPaid);
  const acceptSettlement = useGroupSettlementStore((s) => s.acceptSettlement);
  const rejectSettlement = useGroupSettlementStore((s) => s.rejectSettlement);
  const cancelSettlement = useGroupSettlementStore((s) => s.cancelSettlement);
  const proposeSettlement = useGroupSettlementStore((s) => s.proposeSettlement);
  const [actionMsg, setActionMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [simplifiedTransfers, setSimplifiedTransfers] = useState<TransferProposal[] | null>(null);
  const [settleAllLoading, setSettleAllLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const [now, setNow] = useState(() => Date.now());

  async function handleMarkPaid(settlementId: string) {
    setActionMsg(null);
    await markSettlementAsPaid(groupId, settlementId);
    const err = useGroupSettlementStore.getState().error;
    setActionMsg(err ? { text: err, isError: true } : { text: 'Marked as paid', isError: false });
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function handleAccept(settlementId: string) {
    setActionMsg(null);
    await acceptSettlement(groupId, settlementId);
    const err = useGroupSettlementStore.getState().error;
    setActionMsg(err ? { text: err, isError: true } : { text: 'Settlement approved', isError: false });
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function handleReject(settlementId: string) {
    setActionMsg(null);
    await rejectSettlement(groupId, settlementId);
    const err = useGroupSettlementStore.getState().error;
    setActionMsg(err ? { text: err, isError: true } : { text: 'Settlement rejected', isError: false });
    setTimeout(() => setActionMsg(null), 3000);
  }

  async function handleCancel(settlementId: string) {
    setActionMsg(null);
    await cancelSettlement(groupId, settlementId);
    const err = useGroupSettlementStore.getState().error;
    setActionMsg(err ? { text: err, isError: true } : { text: 'Settlement cancelled', isError: false });
    setTimeout(() => setActionMsg(null), 3000);
  }

  const overdueSettlements = useMemo(() => {
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    return (group.settlements || []).filter((s: any) => {
      if (s.status !== SettlementStatus.PROPOSED && s.status !== SettlementStatus.MARKED_PAID) return false;
      const proposedAt = new Date(s.proposedAt || s.createdAt).getTime();
      if (isNaN(proposedAt)) return false;
      return (now - proposedAt) > SEVEN_DAYS;
    });
  }, [group.settlements, now]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const filteredExpenses = useMemo(() => {
    const cutoff = rangeDays > 0 ? new Date(now - rangeDays * 86400000).toISOString() : null;
    const customStartMs = customStart ? new Date(customStart).getTime() : 0;
    const customEndMs = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Infinity;

    return (group.expenses || []).filter((e) => {
      const d = new Date(e.date || e.createdAt).getTime();
      if (cutoff && d < new Date(cutoff).getTime()) return false;
      if (customStart && d < customStartMs) return false;
      if (customEnd && d > customEndMs) return false;
      return true;
    });
  }, [group.expenses, rangeDays, customStart, customEnd, now]);

  const totalSpent = useMemo(() =>
    filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  const spentByPerson = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of filteredExpenses) {
      map[e.payerId] = (map[e.payerId] || 0) + e.amount;
    }
    return map;
  }, [filteredExpenses]);

  const balances = useMemo(() => {
    const mockMemberIds = group.members.map((m) => m.userId);
    const mockExpenses = filteredExpenses.map((e) => ({
      id: e.id,
      groupId,
      amount: e.amount,
      currency: defaultCurrency,
      categoryId: e.category || 'other',
      description: e.description,
      date: e.date || e.createdAt,
      paidBy: e.payerId,
      paymentMethod: 'cash' as any,
      splitMode: 'ratio' as any,
      splits: e.splits.map((s) => ({
        memberId: s.userId,
        ratio: e.amount > 0 ? s.amount / e.amount : 0,
        isPaid: false,
        fixedAmount: s.amount,
      })),
      status: 'unsettled' as any,
      isRecurring: false,
      createdAt: e.createdAt,
      updatedAt: e.createdAt,
      createdBy: e.payerId,
    }));
    return computeNetBalances(mockExpenses, [], mockMemberIds);
  }, [filteredExpenses, group.members, defaultCurrency, groupId]);

  const currentBalance = balances.find((b) => b.userId === currentUserId);

  function handleSimplifyDebts() {
    const result = generateMinimalTransfers(balances, defaultCurrency);
    setSimplifiedTransfers(result.transfers.length > 0 ? result.transfers : []);
  }

  async function handleSettleAll() {
    setSettleAllLoading(true);
    setActionMsg(null);
    try {
      const debts: { fromUserId: string; toUserId: string; amount: number }[] = [];
      for (const bal of balances) {
        for (const [otherId, amt] of Object.entries(bal.owesTo)) {
          if (amt > 0.01) debts.push({ fromUserId: bal.userId, toUserId: otherId, amount: amt });
        }
      }
      if (debts.length === 0) {
        setActionMsg({ text: 'No outstanding debts to settle', isError: false });
        setTimeout(() => setActionMsg(null), 3000);
        return;
      }
      for (const d of debts) {
        try {
          await proposeSettlement(groupId, { fromUserId: d.fromUserId, toUserId: d.toUserId, amount: Math.round(d.amount * 100) / 100 });
        } catch (e) {
          silentCatch('GroupInvoicesTab.settleAll', e);
        }
      }
      await useGroupStore.getState().fetchGroupById(groupId);
      setActionMsg({ text: `${debts.length} settlement${debts.length > 1 ? 's' : ''} proposed`, isError: false });
      setTimeout(() => setActionMsg(null), 3000);
    } catch (e) {
      setActionMsg({ text: e instanceof Error ? e.message : 'Failed to settle all', isError: true });
    } finally {
      setSettleAllLoading(false);
    }
  }

  function applyPreset(days: number) {
    setRangeDays(days);
    setShowCustom(days === 0 ? false : showCustom);
  }

  function applyCustom() {
    if (customStart && customEnd) {
      setRangeDays(0);
      setShowCustom(false);
    }
  }

  return (
    <div className="space-y-5">
      <TimeRangeFilter
        rangeDays={rangeDays}
        showCustom={showCustom}
        onPreset={applyPreset}
        onCustomStart={setCustomStart}
        onCustomEnd={setCustomEnd}
        onApplyCustom={applyCustom}
        onToggleCustom={() => setShowCustom(!showCustom)}
      />

      <InvoiceSummaryCards
        totalSpent={totalSpent}
        expenseCount={filteredExpenses.length}
        currentBalance={currentBalance}
        defaultCurrency={defaultCurrency}
      />

      <SpentByPersonSection
        members={group.members}
        spentByPerson={spentByPerson}
        totalSpent={totalSpent}
        currentUserId={currentUserId}
        defaultCurrency={defaultCurrency}
      />

      <BalanceOverviewSection
        balances={balances}
        members={group.members}
        currentUserId={currentUserId}
        defaultCurrency={defaultCurrency}
      />

      <div className="flex flex-wrap gap-2">
        <button onClick={handleSimplifyDebts} className="btn-secondary text-sm">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          Simplify Debts
        </button>
        <button onClick={handleSettleAll} disabled={settleAllLoading} className="btn-primary text-sm">
          {settleAllLoading ? 'Proposing...' : 'Settle All'}
        </button>
      </div>

      {simplifiedTransfers !== null && simplifiedTransfers.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Simplified Settlement Plan</h3>
            <button onClick={() => setSimplifiedTransfers(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Dismiss</button>
          </div>
          <div className="space-y-2">
            {simplifiedTransfers.map((t, i) => {
              const from = group.members.find((m) => m.userId === t.fromUserId)?.displayName || t.fromUserId.slice(0, 6);
              const to = group.members.find((m) => m.userId === t.toUserId)?.displayName || t.toUserId.slice(0, 6);
              return (
                <div key={i} className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-700/30 px-3 py-2 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {from} <span className="text-neutral-400">→</span> {to}
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(t.amount, defaultCurrency)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-neutral-400">Use "Settle All" above to create settlement proposals for these transfers</p>
        </div>
      )}

      {simplifiedTransfers !== null && simplifiedTransfers.length === 0 && (
        <div className="card p-4 text-center text-sm text-neutral-500">
          All balances are already settled.
          <button onClick={() => setSimplifiedTransfers(null)} className="ml-2 text-xs text-primary-600 hover:text-primary-700">Dismiss</button>
        </div>
      )}

      <SettlementSection
        settlements={group.settlements || []}
        overdueSettlements={overdueSettlements}
        members={group.members}
        currentUserId={currentUserId}
        defaultCurrency={defaultCurrency}
        actionMsg={actionMsg}
        onMarkPaid={handleMarkPaid}
        onAccept={handleAccept}
        onReject={handleReject}
        onCancel={handleCancel}
      />

      {filteredExpenses.length === 0 && (
        <div className="card p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
            <svg className="h-7 w-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">No expenses in this period</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Try selecting a different time range</p>
        </div>
      )}
    </div>
  );
}
