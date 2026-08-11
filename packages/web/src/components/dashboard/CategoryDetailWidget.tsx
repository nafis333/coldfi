import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePersonalStore } from '../../stores/personalStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, BudgetStatus, type BudgetStatusResult } from '@coldfi/shared';
import { monthBounds } from '../../lib/dates';

interface CategoryChip {
  id: string;
  name: string;
  icon: string;
  color: string;
}

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

export default function CategoryDetailWidget() {
  const { expenses, budgets, budgetStatuses, categories } = usePersonalStore();
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');

  const now = new Date();
  const { start: monthStart, end: monthEnd } = monthBounds(now);

  const monthExpenses = useMemo(
    () => expenses.filter((e) => (e.currency || defaultCurrency) === defaultCurrency && e.date >= monthStart && e.date <= monthEnd),
    [expenses, defaultCurrency, monthStart, monthEnd]
  );

  const categoryMap = useMemo(() => {
    const m: Record<string, { name: string; icon: string; color: string }> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const chips = useMemo(() => {
    const ids = new Set<string>();
    const bySpend = new Map<string, number>();
    for (const e of monthExpenses) {
      ids.add(e.categoryId);
      bySpend.set(e.categoryId, (bySpend.get(e.categoryId) || 0) + e.amount);
    }
    for (const b of budgets) ids.add(b.categoryId);
    const chipsList: CategoryChip[] = [{ id: '__all__', name: 'All Categories', icon: '📊', color: '#6366f1' }];
    for (const id of ids) {
      if (id === '__all__') continue;
      const c = categoryMap[id];
      chipsList.push({ id, name: c?.name || id, icon: c?.icon || '📄', color: c?.color || '#6366f1' });
    }
    return chipsList.sort((a, b) => (b.id === '__all__' ? 1 : a.id === '__all__' ? -1 : (bySpend.get(b.id) || 0) - (bySpend.get(a.id) || 0)));
  }, [monthExpenses, budgets, categoryMap]);

  const [selected, setSelected] = useState<string>('__all__');

  const detail = useMemo(() => {
    const spent = selected === '__all__'
      ? monthExpenses.reduce((s, e) => s + e.amount, 0)
      : monthExpenses.filter((e) => e.categoryId === selected).reduce((s, e) => s + e.amount, 0);

    let status: BudgetStatusResult | undefined;
    if (selected === '__all__') {
      const allStatuses = budgetStatuses.filter((bs) => {
        const b = budgets.find((x) => x.id === bs.budgetId);
        return !!b && b.categoryId === '__all__' && (b.currency || defaultCurrency) === defaultCurrency;
      });
      if (allStatuses.length > 0) {
        status = allStatuses[0];
      } else {
        const currencyStatuses = budgetStatuses.filter((bs) => {
          const b = budgets.find((x) => x.id === bs.budgetId);
          return !!b && (b.currency || defaultCurrency) === defaultCurrency;
        });
        if (currencyStatuses.length > 0) {
          const budgetAmount = currencyStatuses.reduce((s, bs) => s + bs.budgetAmount, 0);
          const spent = currencyStatuses.reduce((s, bs) => s + bs.spent, 0);
          status = {
            budgetId: 'overview',
            categoryId: '__all__',
            budgetAmount,
            spent,
            remaining: budgetAmount - spent,
            percentUsed: budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0,
            status: BudgetStatus.GREEN,
            projectedTotal: 0,
            projectedPercent: 0,
            projectedStatus: BudgetStatus.GREEN,
          };
        }
      }
    } else {
      status = budgetStatuses.find((bs) => {
        const b = budgets.find((x) => x.id === bs.budgetId);
        return !!b && b.categoryId === selected && (b.currency || defaultCurrency) === defaultCurrency;
      });
    }

    const budgetAmount = status?.budgetAmount ?? 0;
    const remaining = status ? status.remaining : 0;
    const percentUsed = status?.percentUsed ?? 0;

    return { spent, budgetAmount, remaining, percentUsed, hasBudget: !!status };
  }, [selected, monthExpenses, budgetStatuses, budgets, defaultCurrency]);

  const chip = chips.find((c) => c.id === selected);
  const label = chip?.name || selected;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title">Category Budget</h3>
        <Link to="/budgets" className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
          Manage &rarr;
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.slice(0, 12).map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setSelected(chip.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
              selected === chip.id
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
            }`}
          >
            <span>{chip.icon}</span> {chip.name}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {detail.hasBudget ? (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Spent this month</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(detail.spent, defaultCurrency)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Budget</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">{formatCurrency(detail.budgetAmount, defaultCurrency)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{detail.remaining >= 0 ? 'Remaining' : 'Over by'}</p>
                <p className={`mt-1 text-lg font-semibold ${detail.remaining >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {formatCurrency(Math.abs(detail.remaining), defaultCurrency)}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div className={`h-full rounded-full transition-all ${getBarColor(detail.percentUsed)}`}
                   style={{ width: `${Math.min(detail.percentUsed, 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">{detail.percentUsed.toFixed(0)}% used</span>
              <span className={getStatusLabel(detail.percentUsed).className}>{getStatusLabel(detail.percentUsed).label}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-neutral-50 dark:bg-neutral-700/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Spent this month</p>
              <p className="mt-0.5 text-lg font-semibold text-neutral-900 dark:text-white">{formatCurrency(detail.spent, defaultCurrency)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">No budget set for {label}</p>
              <Link to="/budgets" className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 mt-1 inline-block">
                Create a budget &rarr;
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
