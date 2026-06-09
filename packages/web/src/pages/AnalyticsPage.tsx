import { useEffect, useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { usePersonalStore } from '../stores/personalStore';

type Period = 'week' | 'month' | 'year';

export default function AnalyticsPage() {
  const { expenses, categories, budgetStatuses, fetchPersonalBlob, isLoading } = usePersonalStore();
  const [period, setPeriod] = useState<Period>('month');

  useEffect(() => { fetchPersonalBlob(); }, [fetchPersonalBlob]);

  const categoryColors = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.color;
    return m;
  }, [categories]);

  const categoryNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of categories) m[c.id] = c.icon + ' ' + c.name;
    return m;
  }, [categories]);

  const { start, end } = useMemo(() => {
    const now = new Date();
    let s: Date;
    if (period === 'week') { s = new Date(now); s.setDate(s.getDate() - 7); }
    else if (period === 'month') { s = new Date(now.getFullYear(), now.getMonth(), 1); }
    else { s = new Date(now.getFullYear(), 0, 1); }
    return { start: s.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
  }, [period]);

  const filtered = useMemo(
    () => expenses.filter((e) => e.date >= start && e.date <= end),
    [expenses, start, end]
  );

  const totalSpent = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
  const dailyAvg = useMemo(() => filtered.length > 0 ? totalSpent / filtered.length : 0, [filtered, totalSpent]);
  const projectedMonthly = dailyAvg * 30;

  const pieData = useMemo(() => {
    const catTotals: Record<string, number> = {};
    for (const e of filtered) catTotals[e.categoryId] = (catTotals[e.categoryId] || 0) + e.amount;
    return Object.entries(catTotals)
      .map(([id, val]) => ({ name: categoryNames[id] || id, value: val, fill: categoryColors[id] || '#CBD5E1' }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categoryNames, categoryColors]);

  const barData = useMemo(() => {
    const now = new Date();
    const days = period === 'year' ? 12 : period === 'month' ? 30 : 7;
    const points: { label: string; amount: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const total = filtered.filter((e) => e.date === ds).reduce((s, e) => s + e.amount, 0);
      points.push({
        label: period === 'year' ? d.toLocaleDateString('en', { month: 'short' }) : String(d.getDate()),
        amount: total,
      });
    }
    if (period === 'year') {
      const monthly: { label: string; amount: number }[] = [];
      for (let m = 0; m < 12; m++) {
        const mStart = new Date(now.getFullYear(), m, 1).toISOString().split('T')[0];
        const mEnd = new Date(now.getFullYear(), m + 1, 0).toISOString().split('T')[0];
        const total = filtered.filter((e) => e.date >= mStart && e.date <= mEnd).reduce((s, e) => s + e.amount, 0);
        monthly.push({ label: new Date(now.getFullYear(), m).toLocaleDateString('en', { month: 'short' }), amount: total });
      }
      return monthly;
    }
    return points;
  }, [filtered, period]);

  const topExpenses = useMemo(
    () => [...filtered].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [filtered]
  );

  const totalBudget = useMemo(() => budgetStatuses.reduce((s, b) => s + b.budgetAmount, 0), [budgetStatuses]);
  const savings = totalBudget - projectedMonthly;
  const isUnderBudget = savings > 0;

  if (isLoading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>

      {/* Period Selector */}
      <div className="inline-flex rounded-lg bg-neutral-200 p-1">
        {(['week', 'month', 'year'] as Period[]).map((p) => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              period === p ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-800'
            }`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Total Spent</p>
          <p className="mt-2 text-3xl font-bold text-danger-600">${totalSpent.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">{filtered.length} transactions</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Daily Average</p>
          <p className="mt-2 text-3xl font-bold text-primary-600">${dailyAvg.toFixed(2)}</p>
          <p className="mt-1 text-xs text-neutral-400">per transaction</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Projected Monthly</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">${projectedMonthly.toFixed(0)}</p>
          <p className="mt-1 text-xs text-neutral-400">based on current pace</p>
        </div>
      </div>

      {/* Savings Card */}
      {totalBudget > 0 && (
        <div className={`card p-5 border-l-4 ${isUnderBudget ? 'border-l-success-500' : 'border-l-danger-500'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                 style={{ backgroundColor: isUnderBudget ? '#16A34A' : '#DC2626' }}>
              {isUnderBudget ? '$' : '!'}
            </div>
            <div>
              <p className={`text-sm font-semibold ${isUnderBudget ? 'text-success-700' : 'text-danger-700'}`}>
                {isUnderBudget
                  ? `Potential savings: $${savings.toFixed(0)}`
                  : `Over budget by $${Math.abs(savings).toFixed(0)}`}
              </p>
              <p className="text-xs text-neutral-500">Based on ${totalBudget.toFixed(0)} monthly budget</p>
            </div>
          </div>
        </div>
      )}

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">Spending by Category</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    innerRadius={50} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill || '#CBD5E1'} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {pieData.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <span className="text-neutral-700">{item.name}</span>
                  </span>
                  <span className="font-medium text-neutral-900">${item.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">
          {period === 'year' ? 'Monthly' : 'Daily'} Spending Trend
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }}
              tickFormatter={(v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`} />
            <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spent']} />
            <Bar dataKey="amount" fill="#818CF8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Expenses */}
      {topExpenses.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Top Expenses</h3>
            <span className="badge-info">Top {topExpenses.length}</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {topExpenses.map((expense, i) => {
              const cat = categories.find((c) => c.id === expense.categoryId);
              return (
                <div key={expense.id} className="flex items-center gap-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200">
                    <span className="text-xs font-bold text-neutral-600">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {expense.payee || cat?.name || 'Expense'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {cat && ` · ${cat.icon} ${cat.name}`}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-danger-600">-${expense.amount.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="card px-5 py-12 text-center">
          <p className="text-sm font-medium text-neutral-500">No data for this period</p>
          <p className="mt-1 text-xs text-neutral-400">Add some expenses to see your analytics</p>
        </div>
      )}
    </div>
  );
}
