import { formatCurrency } from '@coldfi/shared';

interface TopExpensesListProps {
  topExpenses: {
    id: string; description: string; date: string;
    categoryId: string; categoryName: string; amount: number;
  }[];
  categoryLookup: Record<string, { name: string; icon: string; color: string }>;
  defaultCurrency: string;
}

export default function TopExpensesList({ topExpenses, categoryLookup, defaultCurrency }: TopExpensesListProps) {
  if (topExpenses.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Top Expenses</h3>
        <span className="rounded-full bg-primary-50 dark:bg-primary-900/30 px-2.5 py-0.5 text-xs font-medium text-primary-600 dark:text-primary-400">Highest</span>
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {topExpenses.map((expense, i) => {
          const cat = categoryLookup[expense.categoryId];
          return (
            <div key={expense.id} className="flex items-center gap-3 px-5 py-3.5">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : i === 1 ? 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'
                    : i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500'
              }`}>{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                  {expense.description}
                </p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {cat && <span className="ml-1.5">· {cat.icon} {expense.categoryName}</span>}
                </p>
              </div>
              <p className="text-sm font-semibold text-danger-600 dark:text-danger-400 shrink-0">
                -{formatCurrency(expense.amount, defaultCurrency)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
