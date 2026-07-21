import { Link } from 'react-router-dom';
import { formatCurrency } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

export default function QuickActions({ data }: { data: OverviewData }) {
  const { greeting, displayName, totalSpent, totalIncome, defaultCurrency, thisMonthExpenses } = data;

  const now = new Date();
  const label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 dark:from-primary-700 dark:via-primary-800 dark:to-primary-900 p-6 sm:p-8 text-white">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.06] rounded-full -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-white/[0.04] rounded-full translate-y-1/2" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary-100/90">
              {greeting}{displayName ? `, ${displayName} 👋` : ''}
            </p>
            <p className="text-xs text-primary-200/70 mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Link to="/expenses/new" className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-semibold transition-all active:scale-95">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Expense
            </Link>
            <Link to="/expenses" className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold transition-all active:scale-95">
              View History
            </Link>
          </div>
        </div>
        <div className="mt-5 flex items-baseline gap-6 flex-wrap">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary-200/80">Spent</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(totalSpent, defaultCurrency)}</h1>
            <p className="mt-0.5 text-xs text-primary-200/70">{thisMonthExpenses.length} transaction{thisMonthExpenses.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="w-px h-12 bg-white/15" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary-200/80">Income</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{formatCurrency(totalIncome, defaultCurrency)}</h1>
          </div>
        </div>
      </div>
    </div>
  );
}
