import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePersonalStore } from '../stores/personalStore';
import { formatCurrency } from '@coldfi/shared';



function getStatusColor(percent: number): string {
  if (percent >= 100) return 'text-danger-600';
  if (percent >= 80) return 'text-warning-600';
  return 'text-success-600';
}

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-danger-500';
  if (percent >= 80) return 'bg-warning-500';
  return 'bg-success-500';
}

export default function DashboardPage() {
  const { expenses, budgetStatuses, categories, fetchPersonalBlob, isLoading } =
    usePersonalStore();

  useEffect(() => {
    fetchPersonalBlob();
  }, [fetchPersonalBlob]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];

  const thisMonthExpenses = useMemo(
    () => expenses.filter((e) => e.date >= monthStart && e.date <= monthEnd),
    [expenses, monthStart, monthEnd]
  );

  const totalSpent = useMemo(
    () => thisMonthExpenses.reduce((s, e) => s + e.amount, 0),
    [thisMonthExpenses]
  );

  const totalBudget = useMemo(
    () => budgetStatuses.reduce((s, b) => s + b.budgetAmount, 0),
    [budgetStatuses]
  );

  const totalBudgetedSpent = useMemo(
    () => budgetStatuses.reduce((s, b) => s + b.spent, 0),
    [budgetStatuses]
  );

  const budgetPercent = totalBudget > 0 ? (totalBudgetedSpent / totalBudget) * 100 : 0;
  const remaining = totalBudget - totalBudgetedSpent;

  const recentExpenses = useMemo(() => expenses.slice(0, 5), [expenses]);

  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string; color: string }> = {};
    for (const cat of categories) {
      map[cat.id] = cat;
    }
    return map;
  }, [categories]);

  const dailySpending = useMemo(() => {
    const last7: { date: string; total: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const total = expenses
        .filter((e) => e.date === dateStr)
        .reduce((s, e) => s + e.amount, 0);
      last7.push({
        date: dateStr,
        total,
        label: d.toLocaleDateString('en', { weekday: 'short' }),
      });
    }
    return last7;
  }, [expenses, now]);

  const maxDaily = Math.max(...dailySpending.map((d) => d.total), 1);

  if (isLoading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Spent This Month
          </p>
          <p className="mt-2 text-3xl font-bold text-primary-600">
            {formatCurrency(totalSpent, 'USD')}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            {thisMonthExpenses.length} transactions
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Budget Remaining
          </p>
          <p className={`mt-2 text-3xl font-bold ${getStatusColor(budgetPercent)}`}>
            {formatCurrency(remaining, 'USD')}
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            of {formatCurrency(totalBudget, 'USD')} budgeted
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">
            Budget Used
          </p>
          <p className={`mt-2 text-3xl font-bold ${getStatusColor(budgetPercent)}`}>
            {budgetPercent.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-neutral-400">
{formatCurrency(totalBudgetedSpent, 'USD')} spent
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link to="/expenses/new" className="btn-primary">
          <span>+</span>
          Add Expense
        </Link>
        <Link to="/budgets" className="btn-secondary">
          View Budgets
        </Link>
        <Link to="/groups" className="btn-secondary">
          View Groups
        </Link>
      </div>

      {/* Budget Progress */}
      {totalBudget > 0 && (
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Overall Budget Progress
            </h3>
            <span className={`text-sm font-medium ${getStatusColor(budgetPercent)}`}>
              {budgetPercent.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getBarColor(budgetPercent)}`}
              style={{ width: `${Math.min(budgetPercent, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500">
            <span>{formatCurrency(totalBudgetedSpent, 'USD')} spent</span>
            <span>{formatCurrency(totalBudget, 'USD')} budget</span>
          </div>

          {budgetStatuses.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {budgetStatuses.slice(0, 6).map((status) => {
                const cat = categoryMap[status.categoryId];
                return (
                  <div key={status.budgetId} className="rounded-lg bg-neutral-50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-700">
                        {cat?.icon} {cat?.name || status.categoryId}
                      </span>
                      <span className={`text-xs font-medium ${getStatusColor(status.percentUsed)}`}>
                        {status.percentUsed.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className={`h-full rounded-full ${getBarColor(status.percentUsed)}`}
                        style={{ width: `${Math.min(status.percentUsed, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-neutral-400">
                      <span>{formatCurrency(status.spent, 'USD')}</span>
                      <span>{formatCurrency(status.budgetAmount, 'USD')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7-Day Spending Trend */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">
          Last 7 Days
        </h3>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {dailySpending.map((day) => {
            const barHeight = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
            return (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                {day.total > 0 && (
                  <span className="text-[10px] text-neutral-500">
                    {formatCurrency(day.total, 'USD')}
                  </span>
                )}
                <div
                  className={`w-full rounded-sm ${day.total > 0 ? 'bg-primary-400' : 'bg-neutral-200'}`}
                  style={{ height: Math.max(barHeight, 4) }}
                />
                <span className="text-[10px] text-neutral-400">{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-neutral-900">
            Recent Expenses
          </h3>
          <Link
            to="/expenses"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            See all
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-neutral-500">
              No expenses yet.
            </p>
            <Link
              to="/expenses/new"
              className="btn-primary mt-4 inline-flex"
            >
              Add your first expense
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {recentExpenses.map((expense) => {
              const cat = categoryMap[expense.categoryId];
              return (
                <Link
                  key={expense.id}
                  to={`/expenses/${expense.id}/edit`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-neutral-50 transition-colors"
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: (cat?.color || '#CBD5E1') + '20' }}
                  >
                    <span className="text-base">{cat?.icon || 'X'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {expense.payee || cat?.name || 'Expense'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(expense.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-danger-600">
                    {formatCurrency(-expense.amount, 'USD')}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
