import { Link } from 'react-router-dom';
import { formatCurrency } from '@coldfi/shared';
import type { Expense, Category } from '../../lib/personalSync';

interface ExpenseDesktopTableProps {
  paged: Expense[];
  categoryMap: Record<string, Pick<Category, 'name' | 'icon' | 'color'>>;
  defaultCurrency: string;
  activeFilterCount: number;
  onNavigate: (path: string) => void;
  onDownloadReceipt: (expense: Expense) => void;
}

export default function ExpenseDesktopTable({
  paged, categoryMap, defaultCurrency, activeFilterCount,
  onNavigate, onDownloadReceipt,
}: ExpenseDesktopTableProps) {
  return (
    <div className="card overflow-hidden hidden md:block">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Payee</th>
              <th className="px-5 py-3.5 hidden lg:table-cell">Note</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
                    <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {activeFilterCount > 0 ? 'No matching expenses' : 'No expenses yet'}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Add your first expense to get started'}
                  </p>
                  {activeFilterCount === 0 && (
                    <Link to="/expenses/new" className="btn-primary mt-4 inline-flex">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add Expense
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              paged.map((expense) => {
                const cat = categoryMap[expense.categoryId];
                return (
                  <tr key={expense.id} onClick={() => onNavigate(`/expenses/${expense.id}/edit`)} className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                        {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="ml-1.5 text-xs text-neutral-400 dark:text-neutral-500">
                        {new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md text-xs" style={{ backgroundColor: (cat?.color || '#CBD5E1') + '25' }}>
                          {cat?.icon || '📄'}
                        </span>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{cat?.name || expense.categoryId}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-neutral-700 dark:text-neutral-300 font-medium">
                      {expense.payee || <span className="text-neutral-400 dark:text-neutral-500">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-neutral-400 dark:text-neutral-500 max-w-[200px] truncate hidden lg:table-cell">
                      {expense.note || <span className="italic">No note</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-danger-600 dark:text-danger-400">-{formatCurrency(expense.amount, defaultCurrency)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDownloadReceipt(expense); }}
                          className="btn-ghost p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                          title="Download receipt"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
