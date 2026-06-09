import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePersonalStore } from '../stores/personalStore';

const PAGE_SIZE = 20;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'e_wallet', label: 'E-Wallet' },
  { id: 'other', label: 'Other' },
];

interface Filters {
  search: string;
  categoryId: string | null;
  paymentMethod: string | null;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

export default function ExpenseListPage() {
  const navigate = useNavigate();
  const { expenses, categories, fetchPersonalBlob, isLoading } = usePersonalStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: '',
    categoryId: null,
    paymentMethod: null,
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  });

  useEffect(() => {
    fetchPersonalBlob();
  }, [fetchPersonalBlob]);

  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    for (const cat of categories) map[cat.id] = cat;
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchPayee = e.payee?.toLowerCase().includes(q) ?? false;
        const matchNote = e.note?.toLowerCase().includes(q) ?? false;
        if (!matchPayee && !matchNote) return false;
      }
      if (filters.categoryId && e.categoryId !== filters.categoryId) return false;
      if (filters.paymentMethod && e.paymentMethod !== filters.paymentMethod) return false;
      if (filters.startDate && e.date < filters.startDate) return false;
      if (filters.endDate && e.date > filters.endDate) return false;
      if (filters.minAmount && e.amount < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && e.amount > parseFloat(filters.maxAmount)) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [expenses, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalAmount = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered]
  );

  const activeFilterCount = [
    filters.categoryId,
    filters.paymentMethod,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
  ].filter(Boolean).length;

  function clearFilters() {
    setFilters({
      search: '',
      categoryId: null,
      paymentMethod: null,
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
    });
    setPage(1);
  }

  if (isLoading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Expenses</h1>
        <Link to="/expenses/new" className="btn-primary">
          <span>+</span>
          Add Expense
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by payee or note..."
              value={filters.search}
              onChange={(e) => {
                setFilters((p) => ({ ...p, search: e.target.value }));
                setPage(1);
              }}
              className="input-field"
            />
          </div>

          <select
            value={filters.categoryId || ''}
            onChange={(e) => {
              setFilters((p) => ({ ...p, categoryId: e.target.value || null }));
              setPage(1);
            }}
            className="input-field w-auto min-w-[140px]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          <select
            value={filters.paymentMethod || ''}
            onChange={(e) => {
              setFilters((p) => ({ ...p, paymentMethod: e.target.value || null }));
              setPage(1);
            }}
            className="input-field w-auto min-w-[140px]"
          >
            <option value="">All Methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => {
              setFilters((p) => ({ ...p, startDate: e.target.value }));
              setPage(1);
            }}
            className="input-field w-auto"
            title="Start date"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => {
              setFilters((p) => ({ ...p, endDate: e.target.value }));
              setPage(1);
            }}
            className="input-field w-auto"
            title="End date"
          />

          <input
            type="number"
            placeholder="Min $"
            value={filters.minAmount}
            onChange={(e) => {
              setFilters((p) => ({ ...p, minAmount: e.target.value }));
              setPage(1);
            }}
            className="input-field w-24"
          />

          <input
            type="number"
            placeholder="Max $"
            value={filters.maxAmount}
            onChange={(e) => {
              setFilters((p) => ({ ...p, maxAmount: e.target.value }));
              setPage(1);
            }}
            className="input-field w-24"
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
            {filtered.length > 0 && (
              <span className="ml-2 font-medium text-neutral-700">
                &middot; Total: ${totalAmount.toFixed(2)}
              </span>
            )}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="card overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Payee</th>
              <th className="px-5 py-3">Note</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paged.map((expense) => {
              const cat = categoryMap[expense.categoryId];
              return (
                <tr
                  key={expense.id}
                  onClick={() => navigate(`/expenses/${expense.id}/edit`)}
                  className="cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <td className="whitespace-nowrap px-5 py-3 text-sm text-neutral-600">
                    {new Date(expense.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span>{cat?.icon || 'X'}</span>
                      <span className="text-neutral-700">{cat?.name || expense.categoryId}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-700">
                    {expense.payee || '-'}
                  </td>
                  <td className="max-w-[200px] truncate px-5 py-3 text-sm text-neutral-500">
                    {expense.note || '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-neutral-500">
                    {expense.paymentMethod || '-'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-sm font-semibold text-danger-600">
                    -${expense.amount.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {paged.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-500">No expenses found</p>
            {activeFilterCount > 0 ? (
              <p className="text-xs text-neutral-400 mt-1">Try adjusting your filters</p>
            ) : (
              <Link to="/expenses/new" className="btn-primary mt-3 inline-flex">
                Add your first expense
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="space-y-2 md:hidden">
        {paged.map((expense) => {
          const cat = categoryMap[expense.categoryId];
          return (
            <div
              key={expense.id}
              onClick={() => navigate(`/expenses/${expense.id}/edit`)}
              className="card cursor-pointer p-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: (cat?.color || '#CBD5E1') + '20' }}
                  >
                    <span className="text-base">{cat?.icon || 'X'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {expense.payee || cat?.name || 'Expense'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {expense.paymentMethod && ` · ${expense.paymentMethod}`}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-danger-600">
                  -${expense.amount.toFixed(2)}
                </p>
              </div>
              {expense.note && (
                <p className="mt-2 text-xs text-neutral-400">{expense.note}</p>
              )}
            </div>
          );
        })}

        {paged.length === 0 && (
          <div className="card px-5 py-12 text-center">
            <p className="text-sm text-neutral-500">No expenses found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="btn-secondary text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
