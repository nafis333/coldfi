import { useEffect, useMemo, useState } from 'react';
import { usePersonalStore } from '../stores/personalStore';
import { usePersonalBudgetStore } from '../stores/personalBudgetStore';
import { useAuthStore } from '../stores/authStore';
import { silentCatch } from '../lib/errorHandler';
import { monthBounds } from '../lib/dates';
import { formatCurrency } from '@coldfi/shared';
import BudgetFormModal from './budget/BudgetFormModal';
import type { BudgetFormData } from './budget/BudgetFormModal';

function getBarColor(percent: number): string {
  if (percent >= 100) return 'bg-danger-500';
  if (percent >= 80) return 'bg-warning-500';
  return 'bg-success-500';
}

function getStatusLabel(percent: number): { label: string; className: string } {
  if (percent >= 100) return { label: 'Over budget', className: 'badge-danger' };
  if (percent >= 80) return { label: 'Almost there', className: 'badge-warning' };
  return { label: 'On track', className: 'badge-success' };
}

export default function BudgetViewPage() {
  const {
    budgets, budgetStatuses, categories, expenses,
    fetchPersonalBlob,
  } = usePersonalStore();
  const { addBudget, updateBudget, deleteBudget } = usePersonalBudgetStore();

  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { fetchPersonalBlob(); }, [fetchPersonalBlob]);

  const categoryMap = useMemo(() => {
    const m: Record<string, { name: string; icon: string; color: string }> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const now = useMemo(() => new Date(), []);
  const { start: monthStart, end: monthEnd } = useMemo(() => monthBounds(now), [now]);

  const defaultCurrencyBudgetStatuses = useMemo(() => {
    const currencyMap = new Map(budgets.map((b) => [b.id, b.currency]));
    return budgetStatuses.filter((bs) => {
      const currency = currencyMap.get(bs.budgetId);
      return !currency || currency === defaultCurrency;
    });
  }, [budgetStatuses, budgets, defaultCurrency]);

  const totalBudgeted = useMemo(() => defaultCurrencyBudgetStatuses.reduce((s, b) => s + b.budgetAmount, 0), [defaultCurrencyBudgetStatuses]);
  const totalSpent = useMemo(() => defaultCurrencyBudgetStatuses.reduce((s, b) => s + b.spent, 0), [defaultCurrencyBudgetStatuses]);
  const overallPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const exp of expenses) {
      if (exp.currency !== defaultCurrency) continue;
      if (exp.date.slice(0, 10) >= monthStart && exp.date.slice(0, 10) <= monthEnd) {
        totals[exp.categoryId] = (totals[exp.categoryId] || 0) + exp.amount;
      }
    }
    return Object.entries(totals)
      .map(([id, t]) => ({ categoryId: id, total: t, category: categoryMap[id] }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, categoryMap, monthStart, monthEnd, defaultCurrency]);

  const maxBreakdown = categoryBreakdown[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Budgets</h1>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary">
          <span>+</span> Add Budget
        </button>
      </div>

      <div className="card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">Monthly Overview</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-primary-600">{formatCurrency(totalSpent, defaultCurrency)}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">of {formatCurrency(totalBudgeted, defaultCurrency)} budgeted</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-neutral-900 dark:text-white">{formatCurrency(totalBudgeted - totalSpent, defaultCurrency)}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">{totalBudgeted - totalSpent >= 0 ? 'remaining' : 'over budget'}</p>
          </div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className={`h-full rounded-full transition-all ${getBarColor(overallPercent)}`}
               style={{ width: `${Math.min(overallPercent, 100)}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">{overallPercent.toFixed(0)}% used</span>
          <span className={getStatusLabel(overallPercent).className}>{getStatusLabel(overallPercent).label}</span>
        </div>
      </div>

      <div className="space-y-3">
        {defaultCurrencyBudgetStatuses.length === 0 ? (
          <div className="card px-5 py-12 text-center">
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 dark:text-neutral-500">No budgets yet</p>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Create a budget to start tracking your spending limits</p>
            <button onClick={() => setShowForm(true)} className="btn-secondary mt-4">Create Budget</button>
          </div>
        ) : defaultCurrencyBudgetStatuses.map((status) => {
          const cat = categoryMap[status.categoryId];
          const budget = budgets.find((b) => b.id === status.budgetId);
          const si = getStatusLabel(status.percentUsed);
          return (
            <div key={status.budgetId} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl"
                       style={{ backgroundColor: (cat?.color || '#CBD5E1') + '20' }}>
                    <span className="text-xl">{cat?.icon || 'X'}</span>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-neutral-900 dark:text-white">{cat?.name || status.categoryId}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={si.className}>{si.label}</span>
                      {budget && budget.type === 'custom' && budget.periodStart && budget.periodEnd && (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          · {budget.periodStart.slice(0, 7)} to {budget.periodEnd.slice(0, 7)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(status.budgetId); setShowForm(true); }}
                          className="rounded-lg p-2 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" title="Edit">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={async () => { if (window.confirm('Delete this budget?')) { try { await deleteBudget(status.budgetId); } catch (err) { silentCatch('BudgetViewPage.delete', err); } } }}
                          className="rounded-lg p-2 text-neutral-400 dark:text-neutral-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:text-danger-600 dark:hover:text-danger-400 transition-colors" title="Delete">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className={`h-full rounded-full transition-all ${getBarColor(status.percentUsed)}`}
                       style={{ width: `${Math.min(status.percentUsed, 100)}%` }} />
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-sm text-neutral-600 dark:text-neutral-400 dark:text-neutral-500">{formatCurrency(status.spent, defaultCurrency)} spent</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">{status.remaining >= 0 ? formatCurrency(status.remaining, defaultCurrency) + ' left' : formatCurrency(Math.abs(status.remaining), defaultCurrency) + ' over'}</span>
                </div>
              </div>
              {status.projectedTotal > status.budgetAmount && (
                <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-3">
                  <p className="text-xs text-warning-700">At current pace: {formatCurrency(status.projectedTotal, defaultCurrency)} projected ({status.projectedPercent?.toFixed(0)}%)</p>
                </div>
              )}
              {budget?.rollover && <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">Rollover enabled</p>}
            </div>
          );
        })}
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">Spending by Category (This Month)</h3>
          <div className="space-y-3">
            {categoryBreakdown.map(({ categoryId, total, category }) => (
              <div key={categoryId} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                     style={{ backgroundColor: (category?.color || '#CBD5E1') + '20' }}>
                  <span className="text-sm">{category?.icon || 'X'}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{category?.name || categoryId}</span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{formatCurrency(total, defaultCurrency)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full rounded-full" style={{ width: `${(total / maxBreakdown) * 100}%`, backgroundColor: category?.color || '#6366F1' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <BudgetFormModal
          editingId={editingId}
          budgets={budgets}
          categories={categories}
          onClose={() => { setShowForm(false); setEditingId(null); }}
          onSave={async (data: BudgetFormData) => {
            const amt = parseFloat(data.amount);
            const ps = data.budgetType === 'custom' ? data.periodStart : monthStart;
            const pe = data.budgetType === 'custom' ? data.periodEnd : monthEnd;
            if (editingId) {
              await updateBudget(editingId, { type: data.budgetType, amount: amt, alertThreshold: parseFloat(data.alertThreshold) || 80, rollover: data.rollover, periodStart: ps, periodEnd: pe });
            } else {
              await addBudget({ categoryId: data.categoryId, type: data.budgetType, amount: amt, currency: defaultCurrency, periodStart: ps, periodEnd: pe, alertThreshold: parseFloat(data.alertThreshold) || 80, rollover: data.rollover, unusedRolloverAmount: 0 });
            }
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}
