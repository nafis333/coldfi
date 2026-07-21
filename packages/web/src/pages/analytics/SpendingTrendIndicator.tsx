import { formatCurrency } from '@coldfi/shared';

interface SpendingTrendIndicatorProps {
  totalSpent: number;
  prevTotalSpent: number;
  trendPercent: number;
  period: string;
  dailyAvg: number;
  topCategory: { name: string; value: number } | null;
  txCount: number;
  projectedThisMonth: number;
  defaultCurrency: string;
}

export default function SpendingTrendIndicator({
  totalSpent, prevTotalSpent, trendPercent, period, dailyAvg,
  topCategory, txCount, projectedThisMonth, defaultCurrency,
}: SpendingTrendIndicatorProps) {
  if (totalSpent === 0) return null;

  return (
    <div className={`rounded-2xl border p-4 ${trendPercent > 10 ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-700' : trendPercent < -10 ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-700' : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-700'}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          trendPercent > 10 ? 'bg-danger-100 dark:bg-danger-800/40 text-danger-600 dark:text-danger-400'
            : trendPercent < -10 ? 'bg-success-100 dark:bg-success-800/40 text-success-600 dark:text-success-400'
            : 'bg-primary-100 dark:bg-primary-800/40 text-primary-600 dark:text-primary-400'
        }`}>
          {trendPercent > 10 ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          ) : trendPercent < -10 ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          )}
        </div>
        <div className="min-w-0">
          {period === '1m' || period === '7d' ? (
            <>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {trendPercent > 10 ? 'Spending increased significantly' : trendPercent < -10 ? 'Spending decreased' : 'Spending is stable'}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                {trendPercent > 0
                  ? `${formatCurrency(totalSpent - prevTotalSpent, defaultCurrency)} more than previous period (${trendPercent.toFixed(1)}%↑)`
                  : trendPercent < 0
                    ? `${formatCurrency(prevTotalSpent - totalSpent, defaultCurrency)} less than previous period (${Math.abs(trendPercent).toFixed(1)}%↓)`
                    : 'Spending is similar to the previous period'}
                {period === '1m' && ` · Projected: ${formatCurrency(projectedThisMonth, defaultCurrency)} this month`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {totalSpent > 0 ? `${txCount} transaction${txCount !== 1 ? 's' : ''} in this period` : 'No spending data'}
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                {topCategory ? `Top category: ${topCategory.name} (${(topCategory.value / totalSpent * 100).toFixed(0)}%)` : 'Add expenses to see insights'}
                · Daily avg: {formatCurrency(dailyAvg, defaultCurrency)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
