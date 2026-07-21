import { formatCurrency } from '@coldfi/shared';

interface StatCardsProps {
  totalSpent: number;
  prevTotalSpent: number;
  dailyAvg: number;
  txCount: number;
  prevTxCount: number;
  biggestDay: { date: string; amount: number } | null;
  isEmpty: boolean;
  trendPercent: number;
  isTrendUp: boolean;
  defaultCurrency: string;
}

export default function StatCards({
  totalSpent, prevTotalSpent, dailyAvg, txCount, prevTxCount,
  biggestDay, isEmpty, trendPercent, isTrendUp, defaultCurrency,
}: StatCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-danger-50 dark:bg-danger-900/20 rounded-bl-full" />
        <p className="relative text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Total Spent</p>
        <p className="relative mt-1.5 text-xl sm:text-2xl font-bold text-danger-600 dark:text-danger-400">
          {formatCurrency(totalSpent, defaultCurrency)}
        </p>
        <div className="relative mt-1 flex items-center gap-1">
          {!isEmpty && prevTotalSpent > 0 && (
            <span className={`inline-flex items-center text-xs font-medium ${isTrendUp ? 'text-danger-500' : 'text-success-500'}`}>
              <svg className={`h-3 w-3 mr-0.5 ${isTrendUp ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              {Math.abs(trendPercent).toFixed(1)}%
            </span>
          )}
          <span className="text-xs text-neutral-400 dark:text-neutral-500">vs prev</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-bl-full" />
        <p className="relative text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Avg / Day</p>
        <p className="relative mt-1.5 text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400">
          {formatCurrency(dailyAvg, defaultCurrency)}
        </p>
        <p className="relative mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {txCount} transaction{txCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Transactions</p>
        <p className="mt-1.5 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">{txCount}</p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {prevTxCount > 0 ? (
            <span className={txCount > prevTxCount ? 'text-danger-500' : 'text-success-500'}>
              {txCount > prevTxCount ? '+' : ''}{txCount - prevTxCount} vs prev
            </span>
          ) : <span>No prior data</span>}
        </p>
      </div>

      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Biggest Day</p>
        {biggestDay ? (
          <>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatCurrency(biggestDay.amount, defaultCurrency)}
            </p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              {new Date(biggestDay.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1.5 text-xl sm:text-2xl font-bold text-neutral-300 dark:text-neutral-600">{'\u2014'}</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">No data</p>
          </>
        )}
      </div>
    </div>
  );
}
