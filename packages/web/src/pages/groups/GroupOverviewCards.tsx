import { formatCurrency } from '@coldfi/shared';

interface GroupOverviewCardsProps {
  totalSpent: number;
  expenseCount: number;
  totalSettled: number;
  outstandingDebt: number;
  memberCount: number;
  defaultCurrency: string;
}

export default function GroupOverviewCards({
  totalSpent, expenseCount, totalSettled, outstandingDebt, memberCount, defaultCurrency,
}: GroupOverviewCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-bl-full" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Total Spent</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(totalSpent, defaultCurrency)}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{expenseCount} expenses</p>
        </div>
      </div>
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-success-50 dark:bg-success-900/20 rounded-bl-full" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Settled</p>
          <p className="text-2xl font-bold text-success-600 dark:text-success-400">{formatCurrency(totalSettled, defaultCurrency)}</p>
        </div>
      </div>
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-danger-50 dark:bg-danger-900/20 rounded-bl-full" />
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Outstanding</p>
          <p className={`text-2xl font-bold ${outstandingDebt > 0 ? 'text-danger-500 dark:text-danger-400' : 'text-neutral-900 dark:text-white'}`}>
            {formatCurrency(outstandingDebt, defaultCurrency)}
          </p>
        </div>
      </div>
      <div className="card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1">Members</p>
        <p className="text-2xl font-bold text-neutral-900 dark:text-white">{memberCount}</p>
      </div>
    </div>
  );
}
