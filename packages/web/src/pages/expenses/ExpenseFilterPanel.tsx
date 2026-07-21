import type { Category } from '../../lib/personalSync';

interface Filters {
  search: string;
  categoryId: string | null;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

interface ExpenseFilterPanelProps {
  showFilters: boolean;
  filters: Filters;
  categories: Category[];
  activeFilterCount: number;
  onToggleFilters: () => void;
  onUpdateFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onClearFilters: () => void;
}

export default function ExpenseFilterPanel({
  showFilters, filters, categories, activeFilterCount,
  onToggleFilters, onUpdateFilter, onClearFilters,
}: ExpenseFilterPanelProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 dark:text-neutral-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search payee or note..." value={filters.search}
            onChange={(e) => onUpdateFilter('search', e.target.value)} className="input-field pl-9" />
        </div>
        <button onClick={onToggleFilters}
          className={`btn-secondary text-sm relative ${activeFilterCount > 0 ? 'border-primary-400 dark:border-primary-500 text-primary-600 dark:text-primary-400' : ''}`}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="card p-4 space-y-3 mb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select value={filters.categoryId || ''} onChange={(e) => onUpdateFilter('categoryId', e.target.value || null)} className="input-field">
              <option value="">All Categories</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}
            </select>
            <div className="flex items-center gap-2">
              <input type="date" value={filters.startDate} onChange={(e) => onUpdateFilter('startDate', e.target.value)} className="input-field flex-1" title="From" />
              <span className="text-neutral-400 dark:text-neutral-500 shrink-0">—</span>
              <input type="date" value={filters.endDate} onChange={(e) => onUpdateFilter('endDate', e.target.value)} className="input-field flex-1" title="To" />
            </div>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.minAmount} onChange={(e) => onUpdateFilter('minAmount', e.target.value)} className="input-field w-full" />
              <span className="text-neutral-400 dark:text-neutral-500 shrink-0">—</span>
              <input type="number" placeholder="Max" value={filters.maxAmount} onChange={(e) => onUpdateFilter('maxAmount', e.target.value)} className="input-field w-full" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active` : 'No filters active'}</p>
            {activeFilterCount > 0 && (<button onClick={onClearFilters} className="text-xs font-semibold text-danger-600 dark:text-danger-400 hover:text-danger-700">Clear all</button>)}
          </div>
        </div>
      )}
    </>
  );
}
