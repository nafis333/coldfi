import { formatCurrency } from '@coldfi/shared';
import type { Expense, Category } from '../../lib/personalSync';

interface ExpenseMobileCardsProps {
  paged: Expense[];
  categoryMap: Record<string, Pick<Category, 'name' | 'icon' | 'color'>>;
  defaultCurrency: string;
  activeFilterCount: number;
  onNavigate: (path: string) => void;
  onDownloadReceipt: (expense: Expense) => void;
}

export default function ExpenseMobileCards({
  paged, categoryMap, defaultCurrency, activeFilterCount,
  onNavigate, onDownloadReceipt,
}: ExpenseMobileCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {paged.length === 0 ? (
        <div className="card px-5 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
            <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            {activeFilterCount > 0 ? 'No matching expenses' : 'No expenses yet'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Tap + to add your first expense'}
          </p>
        </div>
      ) : (
        paged.map((expense) => {
          const cat = categoryMap[expense.categoryId];
          return (
              <div key={expense.id} onClick={() => onNavigate(`/expenses/${expense.id}/edit`)} className="card card-hover p-4 cursor-pointer transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base" style={{ backgroundColor: (cat?.color || '#CBD5E1') + '20' }}>
                      {cat?.icon || '📄'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{expense.payee || cat?.name || 'Expense'}</p>
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                        <span>{new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {expense.note && (<><span className="text-neutral-300 dark:text-neutral-600">·</span><span className="truncate max-w-[80px]">{expense.note}</span></>)}
                      </div>
                      {expense.items && expense.items.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {expense.items.map((item, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-neutral-100 dark:bg-neutral-700/40 px-1.5 py-0.5 text-xs text-neutral-600 dark:text-neutral-300">
                              {item.name} {formatCurrency(item.amount, defaultCurrency)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  <p className="text-sm font-bold text-danger-600 dark:text-danger-400">-{formatCurrency(expense.amount, defaultCurrency)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDownloadReceipt(expense); }}
                    className="btn-ghost p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    title="Download receipt"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
