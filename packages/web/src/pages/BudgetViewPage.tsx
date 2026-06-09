import { useEffect, useMemo, useState } from 'react';
import { usePersonalStore } from '../stores/personalStore';

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

function getStatusLabel(percent: number): { label: string; className: string } {
  if (percent >= 100) return { label: 'Over budget', className: 'badge-danger' };
  if (percent >= 80) return { label: 'Almost there', className: 'badge-warning' };
  return { label: 'On track', className: 'badge-success' };
}

interface BudgetFormData {
  categoryId: string;
  amount: string;
  alertThreshold: string;
  rollover: boolean;
}

export default function BudgetViewPage() {
  const {
    budgets, budgetStatuses, categories, expenses,
    fetchPersonalBlob, addBudget, updateBudget, deleteBudget,
  } = usePersonalStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { fetchPersonalBlob(); }, [fetchPersonalBlob]);

  const categoryMap = useMemo(() => {
    const m: Record<string, { name: string; icon: string; color: string }> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const totalBudgeted = useMemo(() => budgetStatuses.reduce((s, b) => s + b.budgetAmount, 0), [budgetStatuses]);
  const totalSpent = useMemo(() => budgetStatuses.reduce((s, b) => s + b.spent, 0), [budgetStatuses]);
  const overallPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const exp of expenses) {
      if (exp.date >= monthStart && exp.date <= monthEnd) {
        totals[exp.categoryId] = (totals[exp.categoryId] || 0) + exp.amount;
      }
    }
    return Object.entries(totals)
      .map(([id, t]) => ({ categoryId: id, total: t, category: categoryMap[id] }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, categoryMap, monthStart, monthEnd]);

  const maxBreakdown = categoryBreakdown[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Budgets</h1>
        <button onClick={() => { setEditingId(null); setShowForm(true); }} className="btn-primary">
          <span>+</span> Add Budget
        </button>
      </div>

      <div className="card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Monthly Overview</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-primary-600">${totalSpent.toFixed(0)}</p>
            <p className="text-sm text-neutral-500">of ${totalBudgeted.toFixed(0)} budgeted</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-neutral-900">${(totalBudgeted - totalSpent).toFixed(0)}</p>
            <p className="text-sm text-neutral-500">remaining</p>
          </div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className={`h-full rounded-full transition-all ${getBarColor(overallPercent)}`}
               style={{ width: `${Math.min(overallPercent, 100)}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-neutral-500">{overallPercent.toFixed(0)}% used</span>
          <span className={getStatusLabel(overallPercent).className}>{getStatusLabel(overallPercent).label}</span>
        </div>
      </div>

      <div className="space-y-3">
        {budgetStatuses.length === 0 ? (
          <div className="card px-5 py-12 text-center">
            <p className="text-sm font-medium text-neutral-500">No budgets yet</p>
            <p className="mt-1 text-xs text-neutral-400">Create a budget to start tracking your spending limits</p>
            <button onClick={() => setShowForm(true)} className="btn-secondary mt-4">Create Budget</button>
          </div>
        ) : budgetStatuses.map((status) => {
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
                    <p className="text-base font-semibold text-neutral-900">{cat?.name || status.categoryId}</p>
                    <span className={si.className}>{si.label}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingId(status.budgetId); setShowForm(true); }}
                          className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors" title="Edit">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => { if (window.confirm('Delete this budget?')) deleteBudget(status.budgetId); }}
                          className="rounded-lg p-2 text-neutral-400 hover:bg-danger-50 hover:text-danger-600 transition-colors" title="Delete">
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
                  <span className="text-sm text-neutral-600">${status.spent.toFixed(2)} spent</span>
                  <span className="text-sm font-medium text-neutral-900">${status.remaining.toFixed(2)} left</span>
                </div>
              </div>
              {status.projectedTotal > status.budgetAmount && (
                <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-3">
                  <p className="text-xs text-warning-700">At current pace: ${status.projectedTotal.toFixed(0)} projected ({status.projectedPercent?.toFixed(0)}%)</p>
                </div>
              )}
              {budget?.rollover && <p className="mt-2 text-xs text-neutral-400">Rollover enabled</p>}
            </div>
          );
        })}
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-neutral-900">Spending by Category (This Month)</h3>
          <div className="space-y-3">
            {categoryBreakdown.map(({ categoryId, total, category }) => (
              <div key={categoryId} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                     style={{ backgroundColor: (category?.color || '#CBD5E1') + '20' }}>
                  <span className="text-sm">{category?.icon || 'X'}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-neutral-700">{category?.name || categoryId}</span>
                    <span className="font-semibold text-neutral-900">${total.toFixed(2)}</span>
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
            const ps = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const pe = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
            if (editingId) {
              await updateBudget(editingId, { amount: amt, alertThreshold: parseFloat(data.alertThreshold) || 80, rollover: data.rollover });
            } else {
              await addBudget({ categoryId: data.categoryId, type: 'monthly', amount: amt, currency: 'USD', periodStart: ps, periodEnd: pe, alertThreshold: parseFloat(data.alertThreshold) || 80, rollover: data.rollover });
            }
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function BudgetFormModal({ editingId, budgets, categories, onClose, onSave }: {
  editingId: string | null;
  budgets: Array<{ id: string; categoryId: string; amount: number; rollover: boolean }>;
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  onClose: () => void;
  onSave: (data: BudgetFormData) => Promise<void>;
}) {
  const existing = editingId ? budgets.find((b) => b.id === editingId) : null;
  const [categoryId, setCategoryId] = useState(existing?.categoryId || '');
  const [amount, setAmount] = useState(existing?.amount?.toString() || '');
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [rollover, setRollover] = useState(existing?.rollover || false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const existingCatIds = new Set(budgets.filter((b) => b.id !== editingId).map((b) => b.categoryId));
  const available = categories.filter((c) => !existingCatIds.has(c.id) || c.id === categoryId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editingId && !categoryId) errs.categoryId = 'Select a category';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try { await onSave({ categoryId, amount, alertThreshold, rollover }); } catch { setErrors({ form: 'Failed' }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{editingId ? 'Edit Budget' : 'Add Budget'}</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-neutral-700">Category</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {available.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCategoryId(c.id); setErrors((p) => ({ ...p, categoryId: '' })); }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                      categoryId === c.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}>
                    <span>{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
              {errors.categoryId && <p className="mt-1 text-xs text-danger-600">{errors.categoryId}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700">Budget Amount</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }}
              className={`input-field mt-1 ${errors.amount ? 'border-danger-500' : ''}`} />
            {errors.amount && <p className="mt-1 text-xs text-danger-600">{errors.amount}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Alert Threshold (%)</label>
            <input type="number" placeholder="80" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="input-field mt-1" />
            <p className="mt-1 text-xs text-neutral-400">Get notified when spending reaches this %</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700">Rollover unused budget</p>
              <p className="text-xs text-neutral-400">Carry remaining to next month</p>
            </div>
            <button type="button" onClick={() => setRollover(!rollover)}
              className={`relative h-7 w-12 rounded-full transition-colors ${rollover ? 'bg-primary-600' : 'bg-neutral-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${rollover ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {errors.form && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3"><p className="text-sm text-danger-700">{errors.form}</p></div>}
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : editingId ? 'Update Budget' : 'Create Budget'}
          </button>
        </form>
      </div>
    </div>
  );
}
