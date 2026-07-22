import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePersonalStore } from '../stores/personalStore';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';
import { formatCurrency } from '@coldfi/shared';
import { useOverview } from '../hooks/useOverview';
import QuickActions from '../components/dashboard/QuickActions';
import OverviewCards from '../components/dashboard/OverviewCards';
import SpendingTrendChart from '../components/dashboard/SpendingTrendChart';
import BudgetHealthWidget from '../components/dashboard/BudgetHealthWidget';
import IncomeWidget from '../components/dashboard/IncomeWidget';
import SavingsTargetsWidget from '../components/dashboard/SavingsTargetsWidget';

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 rounded-2xl bg-gradient-to-r from-neutral-200 to-neutral-100 dark:from-neutral-700 dark:to-neutral-800" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 space-y-3">
            <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-8 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-neutral-700" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-32 rounded bg-neutral-100 dark:bg-neutral-700" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-neutral-700" />
                </div>
                <div className="h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { fetchPersonalBlob, isLoading, personalBlob } = usePersonalStore();
  const displayName = useAuthStore((s) => s.displayName);
  const { expenses, budgetStatuses, categories } = usePersonalStore();
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');
  const [hasLoaded, setHasLoaded] = useState(() => personalBlob !== null);

  const { groups, groupDataVersions, isLoading: groupsLoading, fetchGroups } = useGroupStore();

  useEffect(() => {
    if (!hasLoaded) {
      fetchPersonalBlob().finally(() => setHasLoaded(true));
    }
  }, [fetchPersonalBlob, hasLoaded]);

  useEffect(() => {
    if (groups.length === 0 && !groupsLoading) fetchGroups();
  }, [fetchGroups, groups.length, groupsLoading]);

  const data = useOverview();

  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    for (const cat of categories) map[cat.id] = cat;
    return map;
  }, [categories]);

  if (!hasLoaded || (isLoading && expenses.length === 0)) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <QuickActions data={data} />
      <OverviewCards data={data} />

      <div className="grid gap-6 sm:grid-cols-2">
        <SpendingTrendChart data={data} />
        <BudgetHealthWidget data={data} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <IncomeWidget data={data} />
        <SavingsTargetsWidget data={data} />
      </div>

      {/* Groups Overview */}
      {groups.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Groups Overview</h3>
            <Link to="/expenses" onClick={() => { const el = document.querySelector('[data-tab="groups"]'); if (el) (el as HTMLButtonElement).click(); }}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Active Groups</p>
              <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">{groups.length}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">You're Owed</p>
              <p className="mt-1 text-xl font-bold text-success-600 dark:text-success-400">
                {formatCurrency(groups.filter(g => g.yourBalance > 0).reduce((s, g) => s + g.yourBalance, 0), defaultCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">You Owe</p>
              <p className="mt-1 text-xl font-bold text-danger-600 dark:text-danger-400">
                {formatCurrency(groups.filter(g => g.yourBalance < 0).reduce((s, g) => s + Math.abs(g.yourBalance), 0), defaultCurrency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Combined</p>
              <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-white">
                {formatCurrency(groups.reduce((s, g) => s + g.yourBalance, 0), defaultCurrency)}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {groups.slice(0, 3).map((g) => (
              <Link key={g.id} to={`/groups/${g.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-white">
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{g.name}</span>
                </div>
                <span className={`text-sm font-semibold shrink-0 ml-2 ${g.yourBalance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {g.yourBalance >= 0 ? '+' : ''}{formatCurrency(g.yourBalance, defaultCurrency)}
                </span>
              </Link>
            ))}
            {groups.length > 3 && (
              <Link to="/groups" className="block text-center text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 pt-1">
                +{groups.length - 3} more group{groups.length - 3 !== 1 ? 's' : ''}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Recent Expenses</h3>
          {recentExpenses.length > 0 && (
            <Link to="/expenses" className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
              View all &rarr;
            </Link>
          )}
        </div>

        {recentExpenses.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/50">
              <svg className="h-7 w-7 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">No expenses yet</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Start tracking your spending to see insights here</p>
            <Link to="/expenses/new" className="btn-primary mt-5 inline-flex">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add your first expense
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/40">
            {recentExpenses.map((expense) => {
              const cat = categoryMap[expense.categoryId];
              return (
                <Link
                  key={expense.id}
                  to={`/expenses/${expense.id}/edit`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/20 transition-colors group"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: (cat?.color || '#CBD5E1') + '20' }}
                  >
                    {cat?.icon || '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {expense.payee || cat?.name || 'Expense'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      <span>{new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-danger-600 dark:text-danger-400">
                      -{formatCurrency(expense.amount, defaultCurrency)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}