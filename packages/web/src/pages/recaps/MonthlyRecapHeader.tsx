import { formatCurrency } from '@coldfi/shared';

interface MonthlyRecapHeaderProps {
  periodLabel: string;
  totalSpent: number;
  totalIncome: number;
  netSavings: number;
  dailyAverage: number;
  expenseCount: number;
  averageTransaction: number;
  monthlyAverage: number;
  savingsRate: number;
  monthCount: number;
  defaultCurrency: string;
}

export default function MonthlyRecapHeader({
  periodLabel, totalSpent, totalIncome, netSavings, dailyAverage,
  expenseCount, averageTransaction, monthlyAverage, savingsRate,
  monthCount, defaultCurrency,
}: MonthlyRecapHeaderProps) {
  return (
    <>
      {/* Gradient Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 px-6 py-6 text-white">
        <p className="text-xs font-medium uppercase tracking-wider opacity-80">{periodLabel}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(totalSpent, defaultCurrency)}</p>
        <p className="text-sm opacity-80">Total spent</p>
      </div>

      <div className="p-5 space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-success-50 dark:bg-success-900/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-success-600 dark:text-success-400">Income</p>
            <p className="mt-0.5 text-base font-bold text-success-700 dark:text-success-300">{formatCurrency(totalIncome, defaultCurrency)}</p>
          </div>
          <div className={`rounded-xl p-3 ${netSavings >= 0 ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Net Savings</p>
            <p className="mt-0.5 text-base font-bold">{formatCurrency(netSavings, defaultCurrency)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Daily Avg</p>
            <p className="mt-0.5 text-base font-bold text-neutral-800 dark:text-neutral-200">{formatCurrency(dailyAverage, defaultCurrency)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Transactions</p>
            <p className="mt-0.5 text-base font-bold text-neutral-800 dark:text-neutral-200">{expenseCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Avg Transaction</p>
            <p className="mt-0.5 text-base font-bold text-neutral-800 dark:text-neutral-200">{formatCurrency(averageTransaction, defaultCurrency)}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              Avg {monthCount > 1 ? 'Monthly' : 'Spending'}
            </p>
            <p className="mt-0.5 text-base font-bold text-neutral-800 dark:text-neutral-200">
              {formatCurrency(monthlyAverage, defaultCurrency)}
            </p>
          </div>
        </div>

        {/* Savings Rate */}
        <div className={`rounded-xl p-4 ${savingsRate >= 20
          ? 'bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800'
          : savingsRate >= 10
            ? 'bg-warning-50 dark:bg-amber-900/20 border border-warning-200 dark:border-amber-800'
            : 'bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">Savings Rate</span>
            <span className={`text-lg font-bold ${savingsRate >= 20 ? 'text-success-700 dark:text-success-400'
              : savingsRate >= 10 ? 'text-amber-700 dark:text-amber-400' : 'text-danger-700 dark:text-danger-400'}`}>
              {savingsRate.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/60 dark:bg-neutral-700/60 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${savingsRate >= 20 ? 'bg-success-500'
              : savingsRate >= 10 ? 'bg-amber-500' : 'bg-danger-500'}`}
              style={{ width: `${Math.min(savingsRate, 100)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {savingsRate >= 20 ? 'Great job! You are saving well above target.'
              : savingsRate >= 10 ? 'On track, but try to save a bit more.'
              : 'Your spending is close to your budget.'}</p>
        </div>
      </div>
    </>
  );
}
