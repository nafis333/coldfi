import { formatCurrency } from '@coldfi/shared';

interface SavingsOverviewProps {
  savingsData: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number | null;
    bySource: { source: string; amount: number }[];
  };
  defaultCurrency: string;
}

export default function SavingsOverview({ savingsData, defaultCurrency }: SavingsOverviewProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">Income & Savings</h3>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Income</p>
          <p className="mt-1 text-lg font-bold text-success-600 dark:text-success-400">
            {formatCurrency(savingsData.totalIncome, defaultCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Spent</p>
          <p className="mt-1 text-lg font-bold text-danger-600 dark:text-danger-400">
            {formatCurrency(savingsData.totalExpenses, defaultCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Net Savings</p>
          <p className={`mt-1 text-lg font-bold ${savingsData.netSavings >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
            {savingsData.netSavings >= 0 ? '+' : ''}{formatCurrency(savingsData.netSavings, defaultCurrency)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Savings Rate</p>
          <p className="mt-1 text-lg font-bold text-primary-600 dark:text-primary-400">
            {savingsData.savingsRate !== null ? `${savingsData.savingsRate.toFixed(1)}%` : '\u2014'}
          </p>
        </div>
      </div>
      {savingsData.bySource.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-2">By source</p>
          <div className="flex flex-wrap gap-2">
            {savingsData.bySource.map((s) => (
              <span key={s.source} className="rounded-lg bg-neutral-100 dark:bg-neutral-700/50 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {s.source}: {formatCurrency(s.amount, defaultCurrency)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
