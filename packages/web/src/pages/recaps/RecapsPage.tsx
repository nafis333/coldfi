import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { silentCatch } from '../../lib/errorHandler';
import { useAnalyticsStore, activeDaysInMonth } from '../../stores/analyticsStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';
import MonthlyRecapHeader from './MonthlyRecapHeader';
import RecapSectionList from './RecapSectionList';

const PRESET_RANGES = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: 'All', months: 0 },
] as const;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_OPTIONS = MONTH_NAMES.map((name, i) => ({ value: String(i + 1).padStart(2, '0'), label: name }));
const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const y = new Date().getFullYear() - 5 + i;
  return { value: String(y), label: String(y) };
});

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function formatRangeLabel(months: string[]) {
  if (months.length === 0) return '';
  if (months.length === 1) return formatMonthLabel(months[0]);
  return `${formatMonthLabel(months[0])} – ${formatMonthLabel(months[months.length - 1])}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsInRange(monthsBack: number): string[] {
  const now = new Date();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (monthsBack === 0) {
    const start = new Date(now.getFullYear() - 10, 0, 1);
    const result: string[] = [];
    let cur = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    while (cur <= end) { result.push(cur); cur = shiftMonth(cur, 1); }
    return result;
  }
  const start = shiftMonth(end, -(monthsBack - 1));
  const result: string[] = [];
  let cur = start;
  while (cur <= end) { result.push(cur); cur = shiftMonth(cur, 1); }
  return result;
}

function monthHasData(month: string, recaps: any[]) {
  return recaps.some((r) => r.month === month);
}

interface AggregatedRecap {
  month: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  expenseCount: number;
  dailyAverage: number;
  averageTransaction: number;
  topCategory: { name: string; amount: number };
  biggestExpense: { description: string; amount: number };
  weekdayTotal: number;
  weekendTotal: number;
  personalTopExpenses: { description: string; amount: number; date: string }[];
  groupTopExpenses: { groupName: string; description: string; amount: number; date: string }[];
  savingsRate: number;
  categories: { id: string; name: string; amount: number; percentage: number }[];
  incomeSources: { source: string; amount: number }[];
  budgets: { name: string; budgeted: number; spent: number; remaining: number; percentage: number }[];
}

function aggregateRecaps(recapList: any[]): AggregatedRecap | null {
  if (recapList.length === 0) return null;

  const totalSpent = recapList.reduce((s, r) => s + r.totalSpent, 0);
  const totalIncome = recapList.reduce((s, r) => s + r.totalIncome, 0);
  const expenseCount = recapList.reduce((s, r) => s + r.expenseCount, 0);
  const totalDays = recapList.reduce((s, r) => {
    return s + activeDaysInMonth(r.month);
  }, 0);

  const catTotals: Record<string, { name: string; amount: number }> = {};
  for (const r of recapList) for (const c of r.categories || []) {
    if (!catTotals[c.id]) catTotals[c.id] = { name: c.name, amount: 0 };
    catTotals[c.id].amount += c.amount;
  }
  const catEntries = Object.entries(catTotals).sort(([, a], [, b]) => b.amount - a.amount);
  const categories = catEntries.map(([id, c]) => ({ id, name: c.name, amount: c.amount, percentage: totalSpent > 0 ? Math.round((c.amount / totalSpent) * 100) : 0 }));
  const topCategory = categories.length > 0 ? { name: categories[0].name, amount: categories[0].amount } : { name: 'None', amount: 0 };

  let biggestExpense = { description: 'None', amount: 0 };
  for (const r of recapList) if (r.biggestExpense?.amount > biggestExpense.amount) biggestExpense = r.biggestExpense;

  const allPersonal = recapList.flatMap((r) => r.personalTopExpenses || []).sort((a: any, b: any) => b.amount - a.amount).slice(0, 5);
  const allGroup = recapList.flatMap((r) => r.groupTopExpenses || []).sort((a: any, b: any) => b.amount - a.amount).slice(0, 5);

  const srcTotals: Record<string, number> = {};
  for (const r of recapList) for (const s of r.incomeSources || []) srcTotals[s.source] = (srcTotals[s.source] || 0) + s.amount;
  const incomeSources = Object.entries(srcTotals).sort(([, a], [, b]) => b - a).map(([source, amount]) => ({ source, amount }));

  const budgetMap: Record<string, { name: string; budgeted: number; spent: number }> = {};
  for (const r of recapList) for (const b of r.budgets || []) {
    if (!budgetMap[b.name]) budgetMap[b.name] = { name: b.name, budgeted: 0, spent: 0 };
    budgetMap[b.name].budgeted += b.budgeted;
    budgetMap[b.name].spent += b.spent;
  }
  const budgets = Object.values(budgetMap).map((b) => ({ ...b, remaining: Math.max(0, b.budgeted - b.spent), percentage: b.budgeted > 0 ? Math.min(100, Math.round((b.spent / b.budgeted) * 100)) : 0 }));

  const weekdayTotal = recapList.reduce((s, r) => s + (r.weekdayTotal || 0), 0);
  const weekendTotal = recapList.reduce((s, r) => s + (r.weekendTotal || 0), 0);
  const savingsRate = totalIncome > 0 ? Math.max(0, ((totalIncome - totalSpent) / totalIncome) * 100) : 0;

  return {
    month: recapList.length === 1 ? recapList[0].month : 'range',
    totalSpent, totalIncome, netSavings: totalIncome - totalSpent, expenseCount,
    dailyAverage: totalDays > 0 ? totalSpent / totalDays : 0,
    averageTransaction: expenseCount > 0 ? totalSpent / expenseCount : 0,
    topCategory, biggestExpense, weekdayTotal, weekendTotal,
    personalTopExpenses: allPersonal, groupTopExpenses: allGroup,
    savingsRate, categories, incomeSources, budgets,
  };
}

export default function RecapsPage() {
  const { recaps, fetchRecap, isLoading } = useAnalyticsStore();
  const recapRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [selectedMonthNum, setSelectedMonthNum] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [rangeMonths, setRangeMonths] = useState(1);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const monthList = useMemo(() => {
    if (showCustom && customStart && customEnd) {
      const result: string[] = [];
      let cur = customStart;
      while (cur <= customEnd) { result.push(cur); cur = shiftMonth(cur, 1); }
      return result;
    }
    if (rangeMonths === 1) return [`${selectedYear}-${selectedMonthNum}`];
    return monthsInRange(rangeMonths);
  }, [rangeMonths, showCustom, customStart, customEnd, selectedYear, selectedMonthNum]);

  useEffect(() => {
    const missing = monthList.filter((m) => !monthHasData(m, recaps));
    if (missing.length > 0) missing.forEach((m) => fetchRecap(m));
  }, [fetchRecap, monthList]);

  const aggregatedRecap = useMemo(() => {
    const available = monthList.filter((m) => monthHasData(m, recaps));
    if (available.length === 0) return null;
    return aggregateRecaps(available.map((m) => recaps.find((r) => r.month === m)));
  }, [recaps, monthList]);

  const defaultCurrency = useAuthStore((s) => s.defaultCurrency);

  const goPrevMonth = () => {
    const next = shiftMonth(`${selectedYear}-${selectedMonthNum}`, -1);
    const [y, m] = next.split('-');
    setSelectedYear(y); setSelectedMonthNum(m); setRangeMonths(1); setShowCustom(false);
  };

  const goNextMonth = () => {
    const next = shiftMonth(`${selectedYear}-${selectedMonthNum}`, 1);
    const [y, m] = next.split('-');
    setSelectedYear(y); setSelectedMonthNum(m); setRangeMonths(1); setShowCustom(false);
  };

  const canGoNext = `${selectedYear}-${selectedMonthNum}` < `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const handleShareAsImage = useCallback(async () => {
    if (!recapRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(recapRef.current);
      const link = document.createElement('a');
      link.download = `recap-${monthList[0] || 'range'}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) { silentCatch('RecapsPage.shareAsImage', err); }
  }, [monthList]);

  const isLoadingAny = isLoading && !aggregatedRecap;
  const hasPartialData = aggregatedRecap && monthList.some((m) => !monthHasData(m, recaps));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_RANGES.map((r) => (
            <button key={r.label} onClick={() => { setRangeMonths(r.months); setShowCustom(false); setCustomStart(''); setCustomEnd('');
              if (r.months === 1) { setSelectedYear(String(now.getFullYear())); setSelectedMonthNum(String(now.getMonth() + 1).padStart(2, '0')); }
            }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${!showCustom && rangeMonths === r.months ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>{r.label}</button>
          ))}
          <button onClick={() => setShowCustom(!showCustom)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${showCustom ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>Custom</button>
          {showCustom && (
            <div className="flex items-center gap-2 ml-1">
              <input type="month" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setRangeMonths(1); }} className="input text-xs py-1 px-2 w-36" />
              <span className="text-xs text-neutral-400">to</span>
              <input type="month" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setRangeMonths(1); }} className="input text-xs py-1 px-2 w-36" />
            </div>
          )}
        </div>
      </div>

      {rangeMonths === 1 && !showCustom ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={goPrevMonth} className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white min-w-[200px] text-center select-none">{formatMonthLabel(`${selectedYear}-${selectedMonthNum}`)}</h1>
            <button onClick={goNextMonth} disabled={!canGoNext} className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500">
              {YEAR_OPTIONS.map((y) => (<option key={y.value} value={y.value}>{y.label}</option>))}
            </select>
            <select value={selectedMonthNum} onChange={(e) => setSelectedMonthNum(e.target.value)} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500">
              {MONTH_OPTIONS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
            </select>
          </div>
        </div>
      ) : monthList.length > 0 && (
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{formatRangeLabel(monthList)}</h1>
          <p className="text-xs text-neutral-500 mt-0.5">{monthList.length} months</p>
        </div>
      )}

      {isLoadingAny ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : !aggregatedRecap ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-600 p-12 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-7 w-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">No data for this period</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Add expenses and income to see your recap.</p>
        </div>
      ) : (
        <>
          <div ref={recapRef} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            {hasPartialData && (
              <div className="flex items-center justify-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800/50">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                Loading more data...
              </div>
            )}
            <MonthlyRecapHeader
              periodLabel={formatRangeLabel(monthList)}
              totalSpent={aggregatedRecap.totalSpent}
              totalIncome={aggregatedRecap.totalIncome}
              netSavings={aggregatedRecap.netSavings}
              dailyAverage={aggregatedRecap.dailyAverage}
              expenseCount={aggregatedRecap.expenseCount}
              averageTransaction={aggregatedRecap.averageTransaction}
              monthlyAverage={monthList.length > 0 ? aggregatedRecap.totalSpent / monthList.length : 0}
              savingsRate={aggregatedRecap.savingsRate}
              monthCount={monthList.length}
              defaultCurrency={defaultCurrency}
            />
            <RecapSectionList
              groupTopExpenses={aggregatedRecap.groupTopExpenses}
              personalTopExpenses={aggregatedRecap.personalTopExpenses}
              biggestExpense={aggregatedRecap.biggestExpense}
              weekdayTotal={aggregatedRecap.weekdayTotal}
              weekendTotal={aggregatedRecap.weekendTotal}
              totalSpent={aggregatedRecap.totalSpent}
              categories={aggregatedRecap.categories}
              incomeSources={aggregatedRecap.incomeSources}
              budgets={aggregatedRecap.budgets}
              defaultCurrency={defaultCurrency}
            />
          </div>

          <button onClick={handleShareAsImage}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 font-bold text-white transition-colors hover:bg-primary-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download as Image
          </button>
        </>
      )}
    </div>
  );
}
