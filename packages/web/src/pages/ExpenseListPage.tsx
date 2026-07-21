import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePersonalStore } from '../stores/personalStore';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '@coldfi/shared';
import { downloadReceiptPDF, type ReceiptData } from '../lib/receiptPDF';
import ExpenseListSkeleton from './expenses/ExpenseListSkeleton';
import ExpenseFilterPanel from './expenses/ExpenseFilterPanel';
import ExpenseDesktopTable from './expenses/ExpenseDesktopTable';
import ExpenseMobileCards from './expenses/ExpenseMobileCards';
import ExpensePagination from './expenses/ExpensePagination';
import GroupExpenseTab from './expenses/GroupExpenseTab';

const PAGE_SIZE = 20;

type Tab = 'personal' | 'groups';

interface Filters {
  search: string;
  categoryId: string | null;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  categoryId: null,
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
};

export default function ExpenseListPage() {
  const navigate = useNavigate();
  const { expenses, categories, fetchPersonalBlob, isLoading: personalLoading } = usePersonalStore();
  const { groups, currentGroup, fetchGroups, isLoading: groupsLoading } = useGroupStore();
  const currentUserEmail = useAuthStore((s) => s.email || '');
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');

  const [tab, setTab] = useState<Tab>('personal');

  function handleDownloadPersonalReceipt(expense: { id: string; amount: number; categoryId: string; date: string; payee: string | null; note: string | null }) {
    const cat = categoryMap[expense.categoryId];
    const receiptData: ReceiptData = {
      type: 'personal',
      receiptNumber: expense.id.slice(0, 8).toUpperCase(),
      date: expense.date,
      description: expense.payee || cat?.name || 'Expense',
      category: cat?.name || expense.categoryId,
      currency: defaultCurrency,
      paidBy: currentUserEmail,
      paidByDisplay: 'You',
      totalAmount: expense.amount,
    };
    downloadReceiptPDF(receiptData);
  }

  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  useEffect(() => {
    fetchPersonalBlob();
  }, [fetchPersonalBlob]);

  useEffect(() => {
    if (tab === 'groups' && groups.length === 0) {
      fetchGroups();
    }
  }, [tab, groups.length, fetchGroups]);

  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    for (const cat of categories) map[cat.id] = cat;
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (tab === 'groups') return [];
    return expenses
      .filter((e) => {
        if (filters.search) {
          const q = filters.search.toLowerCase();
          const matchPayee = e.payee?.toLowerCase().includes(q) ?? false;
          const matchNote = e.note?.toLowerCase().includes(q) ?? false;
          if (!matchPayee && !matchNote) return false;
        }
        if (filters.categoryId && e.categoryId !== filters.categoryId) return false;
        if (filters.startDate && e.date.slice(0, 10) < filters.startDate) return false;
        if (filters.endDate && e.date.slice(0, 10) > filters.endDate) return false;
        if (filters.minAmount) { const min = parseFloat(filters.minAmount); if (!isNaN(min) && e.amount < min) return false; }
        if (filters.maxAmount) { const max = parseFloat(filters.maxAmount); if (!isNaN(max) && e.amount > max) return false; }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [expenses, filters, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const personalTotal = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const groupBalanceTotal = useMemo(() => groups.reduce((s, g) => s + Math.abs(g.yourBalance), 0), [groups]);

  const activeFilterCount = [
    filters.categoryId,
    filters.startDate,
    filters.endDate,
    filters.minAmount,
    filters.maxAmount,
  ].filter(Boolean).length;

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setPage(1);
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((p) => ({ ...p, [key]: value }));
    setPage(1);
  }

  if (personalLoading && expenses.length === 0 && tab === 'personal') return <ExpenseListSkeleton />;

  return (
    <div className="page-container">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">Expenses</h1>
          <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
            {tab === 'personal'
              ? `${expenses.length} personal transactions · ${formatCurrency(personalTotal, defaultCurrency)} total`
              : `${groups.length} groups · ${formatCurrency(groupBalanceTotal, defaultCurrency)} total balance`
            }
          </p>
        </div>
        {tab === 'personal' && (
          <Link to="/expenses/new" className="btn-primary text-sm shrink-0">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">Add Expense</span>
          </Link>
        )}
      </div>

      <div className="mb-5 flex gap-1 p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-700/60 w-fit">
        <button onClick={() => setTab('personal')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'personal' ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
          Personal
        </button>
        <button onClick={() => setTab('groups')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === 'groups' ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
          Groups
        </button>
      </div>

      {tab === 'personal' ? (
        <>
          <ExpenseFilterPanel
            showFilters={showFilters}
            filters={filters}
            categories={categories}
            activeFilterCount={activeFilterCount}
            onToggleFilters={() => setShowFilters(!showFilters)}
            onUpdateFilter={updateFilter}
            onClearFilters={clearFilters}
          />

          <ExpenseDesktopTable
            paged={paged}
            categoryMap={categoryMap}
            defaultCurrency={defaultCurrency}
            activeFilterCount={activeFilterCount}
            onNavigate={(path) => navigate(path)}
            onDownloadReceipt={handleDownloadPersonalReceipt}
          />

          <ExpenseMobileCards
            paged={paged}
            categoryMap={categoryMap}
            defaultCurrency={defaultCurrency}
            activeFilterCount={activeFilterCount}
            onNavigate={(path) => navigate(path)}
            onDownloadReceipt={handleDownloadPersonalReceipt}
          />

          <ExpensePagination
            safePage={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      ) : (
        <GroupExpenseTab
          groups={groups}
          groupsLoading={groupsLoading}
          currentGroup={currentGroup}
          defaultCurrency={defaultCurrency}
          onNavigate={(path) => navigate(path)}
        />
      )}
    </div>
  );
}