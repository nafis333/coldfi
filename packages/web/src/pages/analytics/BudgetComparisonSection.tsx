import { formatCurrency } from '@coldfi/shared';

interface BudgetComparisonSectionProps {
  budgetComparison: { name: string; budget: number; spent: number }[];
  isEmpty: boolean;
  defaultCurrency: string;
  source: string;
}

export default function BudgetComparisonSection({ budgetComparison, isEmpty, defaultCurrency, source }: BudgetComparisonSectionProps) {
  if (budgetComparison.length === 0 || source === 'groups') return null;

  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">Budget vs Actual</h3>
      {isEmpty ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">No spending data in this period</p>
      ) : (
        <div className="space-y-3">
          {budgetComparison.map((item) => {
            const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
            const isOver = pct > 100;
            return (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate">{item.name}</span>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatCurrency(item.spent, defaultCurrency)} / {formatCurrency(item.budget, defaultCurrency)}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
                  <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-danger-500' : pct > 80 ? 'bg-warning-500' : 'bg-success-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
