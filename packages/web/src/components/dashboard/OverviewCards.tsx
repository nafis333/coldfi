import { formatCurrency } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

function getStatusColor(percent: number): string {
  if (percent >= 100) return 'text-danger-600 dark:text-danger-400';
  if (percent >= 80) return 'text-warning-600 dark:text-warning-400';
  return 'text-success-600 dark:text-success-400';
}

const iconPaths = {
  spent: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  budget: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  topCategory: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
};

export default function OverviewCards({ data }: { data: OverviewData }) {
  const { totalSpent, thisMonthExpenses, budgetPercent, remaining, totalBudget, defaultCurrency, topCategory, categoryMap } = data;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Spent Card */}
      <div className="card p-5 relative overflow-hidden card-hover">
        <div className="absolute top-0 right-0 w-28 h-28 bg-primary-50 dark:bg-primary-900/20 rounded-bl-full" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths.spent} /></svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Spent</p>
          </div>
          <p className="mt-3 text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(totalSpent, defaultCurrency)}</p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{thisMonthExpenses.length} transaction{thisMonthExpenses.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Budget Card */}
      <div className="card p-5 relative overflow-hidden card-hover">
        <div className={`absolute top-0 right-0 w-28 h-28 rounded-bl-full ${budgetPercent >= 100 ? 'bg-danger-50 dark:bg-danger-900/20' : budgetPercent >= 80 ? 'bg-warning-50 dark:bg-warning-900/20' : 'bg-success-50 dark:bg-success-900/20'}`} />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${budgetPercent >= 100 ? 'bg-danger-100 dark:bg-danger-900/40 text-danger-600 dark:text-danger-400' : budgetPercent >= 80 ? 'bg-warning-100 dark:bg-warning-900/40 text-warning-600 dark:text-warning-400' : 'bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400'}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths.budget} /></svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Budget</p>
          </div>
          <p className={`mt-3 text-2xl font-bold ${getStatusColor(budgetPercent)}`}>
            {totalBudget > 0 ? formatCurrency(remaining, defaultCurrency) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            {totalBudget > 0 ? `${budgetPercent.toFixed(0)}% used` : 'No budgets set'}
          </p>
        </div>
      </div>

      {/* Top Category Card */}
      <div className="card p-5 relative overflow-hidden card-hover">
        <div className="absolute top-0 right-0 w-28 h-28 bg-neutral-50 dark:bg-neutral-700/30 rounded-bl-full" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths.topCategory} /></svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Top Category</p>
          </div>
          {topCategory ? (() => {
            const cat = categoryMap[topCategory.id];
            return (
              <>
                <p className="mt-3 text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(topCategory.total, defaultCurrency)}</p>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{cat?.icon} {cat?.name || topCategory.id}</p>
              </>
            );
          })() : (
            <>
              <p className="mt-3 text-2xl font-bold text-neutral-300 dark:text-neutral-600">—</p>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">No data yet</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
