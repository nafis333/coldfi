import { formatCurrency, parseLocalDate } from '@coldfi/shared';

interface RecapSectionListProps {
  groupTopExpenses: { groupName: string; description: string; amount: number; date: string }[];
  personalTopExpenses: { description: string; amount: number; date: string }[];
  biggestExpense: { description: string; amount: number };
  weekdayTotal: number;
  weekendTotal: number;
  totalSpent: number;
  categories: { id: string; name: string; amount: number; percentage: number }[];
  incomeSources: { source: string; amount: number }[];
  budgets: { name: string; budgeted: number; spent: number; remaining: number; percentage: number }[];
  defaultCurrency: string;
}

export default function RecapSectionList({
  groupTopExpenses, personalTopExpenses, biggestExpense,
  weekdayTotal, weekendTotal, totalSpent,
  categories, incomeSources, budgets, defaultCurrency,
}: RecapSectionListProps) {
  return (
    <div className="p-5 space-y-6">
      {/* Top Group Expenses */}
      {groupTopExpenses.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Top Group Expense Sheets</h3>
          </div>
          <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 overflow-hidden divide-y divide-amber-100 dark:divide-amber-800/20">
            {groupTopExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-bold text-amber-700 dark:text-amber-300">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{e.description}</p>
                    <p className="text-[11px] text-neutral-400">{e.groupName} · {parseLocalDate(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <span className="text-base font-bold text-amber-700 dark:text-amber-300 shrink-0 ml-3">{formatCurrency(e.amount, defaultCurrency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Personal Expenses */}
      {personalTopExpenses.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <svg className="h-4 w-4 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Top Personal Expenses</h3>
          </div>
          <div className="rounded-xl border border-primary-200 dark:border-primary-800/50 bg-primary-50/50 dark:bg-primary-900/10 overflow-hidden divide-y divide-primary-100 dark:divide-primary-800/20">
            {personalTopExpenses.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30 text-xs font-bold text-primary-700 dark:text-primary-300">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{e.description}</p>
                    <p className="text-[11px] text-neutral-400">{parseLocalDate(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
                <span className="text-base font-bold text-danger-600 dark:text-danger-400 shrink-0 ml-3">{formatCurrency(e.amount, defaultCurrency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Biggest Expense Highlight */}
      {biggestExpense.amount > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-danger-50 to-danger-50/50 dark:from-danger-900/20 dark:to-danger-900/10 border border-danger-200 dark:border-danger-800/50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-100 dark:bg-danger-800/40">
              <svg className="h-5 w-5 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Biggest Single Expense</p>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{biggestExpense.description}</p>
            </div>
            <span className="text-lg font-bold text-danger-600 dark:text-danger-400 shrink-0 ml-auto">{formatCurrency(biggestExpense.amount, defaultCurrency)}</span>
          </div>
        </div>
      )}

      {/* Spending Pattern */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Spending Pattern</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-4 text-center">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Weekdays</p>
            <p className="mt-1 text-lg font-bold text-neutral-800 dark:text-neutral-200">{formatCurrency(weekdayTotal, defaultCurrency)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-600 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${totalSpent > 0 ? (weekdayTotal / totalSpent) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-neutral-400">{totalSpent > 0 ? `${Math.round((weekdayTotal / totalSpent) * 100)}% of total` : '0%'}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-700/30 p-4 text-center">
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Weekends</p>
            <p className="mt-1 text-lg font-bold text-neutral-800 dark:text-neutral-200">{formatCurrency(weekendTotal, defaultCurrency)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-600 overflow-hidden">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${totalSpent > 0 ? (weekendTotal / totalSpent) * 100 : 0}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-neutral-400">{totalSpent > 0 ? `${Math.round((weekendTotal / totalSpent) * 100)}% of total` : '0%'}</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Spending by Category</h3>
          <div className="space-y-3">
            {categories.slice(0, 8).map((cat) => (
              <div key={cat.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate mr-2">{cat.name}</span>
                  <span className="text-neutral-900 dark:text-white font-semibold shrink-0">
                    {formatCurrency(cat.amount, defaultCurrency)} <span className="text-xs text-neutral-400">({cat.percentage}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                  <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(cat.percentage, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Income Sources */}
      {incomeSources.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Income Sources</h3>
          <div className="space-y-2">
            {incomeSources.map((src) => (
              <div key={src.source} className="flex items-center justify-between rounded-xl bg-success-50 dark:bg-success-900/20 px-4 py-2.5">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{src.source}</span>
                <span className="text-sm font-bold text-success-600 dark:text-success-400">{formatCurrency(src.amount, defaultCurrency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Progress */}
      {budgets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">Budget vs Actual</h3>
          <div className="space-y-3">
            {budgets.map((b, i) => {
              const isOver = b.percentage > 100;
              const isClose = b.percentage >= 85 && b.percentage <= 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium truncate mr-2">{b.name}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                      {formatCurrency(b.spent, defaultCurrency)} / {formatCurrency(b.budgeted, defaultCurrency)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-danger-500' : isClose ? 'bg-warning-500' : 'bg-success-500'}`}
                      style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className={`text-[10px] ${isOver ? 'text-danger-600 dark:text-danger-400' : 'text-neutral-400'}`}>
                      {isOver ? `${b.percentage}% · Overspent by ${formatCurrency(b.spent - b.budgeted, defaultCurrency)}` : `${b.percentage}% used`}
                    </span>
                    <span className="text-[10px] text-neutral-400">{formatCurrency(b.remaining, defaultCurrency)} left</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
