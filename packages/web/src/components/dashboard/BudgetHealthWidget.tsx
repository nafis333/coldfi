import { Link } from 'react-router-dom';
import { formatCurrency, type BudgetStatusResult } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-danger-500';
  if (percent >= 80) return 'bg-warning-500';
  return 'bg-success-500';
}

function getStatusColor(percent: number): string {
  if (percent >= 100) return 'text-danger-600 dark:text-danger-400';
  if (percent >= 80) return 'text-warning-600 dark:text-warning-400';
  return 'text-success-600 dark:text-success-400';
}

function getBudgetLabel(percent: number): string {
  if (percent >= 100) return 'Over budget';
  if (percent >= 80) return 'Almost there';
  return 'On track';
}

export default function BudgetHealthWidget({ data }: { data: OverviewData }) {
  const { totalBudget, totalBudgetedSpent, budgetPercent, budgetStatuses, categoryMap, defaultCurrency } = data;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title">Budget Progress</h3>
        {totalBudget > 0 && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            budgetPercent >= 100
              ? 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300'
              : budgetPercent >= 80
                ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                : 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              budgetPercent >= 100 ? 'bg-danger-500' : budgetPercent >= 80 ? 'bg-warning-500' : 'bg-success-500'
            }`} />
            {getBudgetLabel(budgetPercent)}
          </span>
        )}
      </div>

      {totalBudget > 0 ? (
        <>
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>{formatCurrency(totalBudgetedSpent, defaultCurrency)}</span>
            <span>{formatCurrency(totalBudget, defaultCurrency)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(budgetPercent)}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>

          {budgetStatuses.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {budgetStatuses.slice(0, 4).map((status: BudgetStatusResult) => {
                const cat = status.categoryId === '__all__'
                  ? { name: 'All Categories', icon: '📊' }
                  : categoryMap[status.categoryId];
                return (
                  <div key={status.budgetId}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">
                        {cat?.icon} {cat?.name || status.categoryId}
                      </span>
                      <span className={`text-xs font-medium ${getStatusColor(status.percentUsed)}`}>
                        {status.percentUsed.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${getBarColor(status.percentUsed)}`}
                        style={{ width: `${Math.min(status.percentUsed, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center py-6 text-center">
          <svg className="h-10 w-10 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">No budgets set yet</p>
          <Link to="/budgets" className="btn-secondary mt-3 text-sm">
            Create Budget
          </Link>
        </div>
      )}
    </div>
  );
}
