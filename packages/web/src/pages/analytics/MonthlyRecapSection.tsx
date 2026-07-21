import { formatCurrency } from '@coldfi/shared';

interface MonthlyRecapSectionProps {
  currentRecap: {
    savingsRate: number;
    totalSpent: number;
    topCategory: { name: string; amount: number };
    biggestExpense: { description: string; amount: number };
  } | null;
  defaultCurrency: string;
}

export default function MonthlyRecapSection({ currentRecap, defaultCurrency }: MonthlyRecapSectionProps) {
  if (!currentRecap) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-r from-primary-500/10 to-primary-600/5 dark:from-primary-800/20 dark:to-primary-900/10 border border-primary-200 dark:border-primary-800/50 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Recap
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          currentRecap.savingsRate >= 20 ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
            : currentRecap.savingsRate >= 10 ? 'bg-warning-100 text-warning-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
        }`}>
          {currentRecap.savingsRate.toFixed(0)}% saved
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white/60 dark:bg-neutral-800/60 p-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Spent</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">{formatCurrency(currentRecap.totalSpent, defaultCurrency)}</p>
        </div>
        <div className="rounded-xl bg-white/60 dark:bg-neutral-800/60 p-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Top Category</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white truncate">{currentRecap.topCategory.name}</p>
          <p className="text-xs text-neutral-400">{formatCurrency(currentRecap.topCategory.amount, defaultCurrency)}</p>
        </div>
        <div className="rounded-xl bg-white/60 dark:bg-neutral-800/60 p-3">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Biggest Expense</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-white truncate">{currentRecap.biggestExpense.description}</p>
          <p className="text-xs text-neutral-400">{formatCurrency(currentRecap.biggestExpense.amount, defaultCurrency)}</p>
        </div>
      </div>
    </div>
  );
}
