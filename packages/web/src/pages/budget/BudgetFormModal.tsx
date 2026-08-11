import { useState } from 'react';
import { monthBounds } from '../../lib/dates';

interface BudgetData {
  id: string;
  categoryId: string;
  amount: number;
  alertThreshold: number;
  rollover: boolean;
  periodStart?: string;
  periodEnd?: string;
  type?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { id: '__all__', name: 'All Categories', icon: '📊', color: '#6366f1' },
  { id: 'food_drink', name: 'Food & Drink', icon: '🍕', color: '#ef4444' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#f97316' },
  { id: 'accommodation', name: 'Accommodation', icon: '🏠', color: '#eab308' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { id: 'utilities', name: 'Utilities', icon: '💡', color: '#14b8a6' },
  { id: 'health', name: 'Health', icon: '💊', color: '#22c55e' },
  { id: 'other', name: 'Other', icon: '📝', color: '#6366f1' },
];

export interface BudgetFormData {
  categoryId: string;
  amount: string;
  alertThreshold: string;
  rollover: boolean;
  budgetType: 'monthly' | 'custom';
  periodStart: string;
  periodEnd: string;
}

interface BudgetFormModalProps {
  editingId: string | null;
  budgets: BudgetData[];
  categories: Category[];
  onClose: () => void;
  onSave: (data: BudgetFormData) => Promise<void>;
}

export default function BudgetFormModal({ editingId, budgets, categories, onClose, onSave }: BudgetFormModalProps) {
  const existing = editingId ? budgets.find((b) => b.id === editingId) : null;
  const now = new Date();
  const currentMonth = monthBounds(now);
  const [categoryId, setCategoryId] = useState(existing?.categoryId || '');
  const [amount, setAmount] = useState(existing?.amount?.toString() || '');
  const [alertThreshold, setAlertThreshold] = useState(existing?.alertThreshold?.toString() || '80');
  const [rollover, setRollover] = useState(existing?.rollover || false);
  const [budgetType, setBudgetType] = useState<'monthly' | 'custom'>(existing?.type === 'custom' ? 'custom' : 'monthly');
  const [periodStart, setPeriodStart] = useState(existing?.periodStart || currentMonth.start);
  const [periodEnd, setPeriodEnd] = useState(existing?.periodEnd || currentMonth.end);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const existingCatIds = new Set(budgets.filter((b) => b.id !== editingId).map((b) => b.categoryId));
  const allCategories = [...DEFAULT_CATEGORIES, ...categories.filter(
    (c) => !DEFAULT_CATEGORIES.some((dc) => dc.id === c.id)
  )];
  const available = allCategories.filter((c) => !existingCatIds.has(c.id) || c.id === categoryId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!editingId && !categoryId) errs.categoryId = 'Select a category';
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount';
    if (budgetType === 'custom') {
      if (!periodStart || !periodEnd) errs.period = 'Select start and end dates';
      else if (periodStart > periodEnd) errs.period = 'End date must be after start date';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      await onSave({ categoryId, amount, alertThreshold, rollover, budgetType, periodStart, periodEnd });
    } catch { setErrors({ form: 'Failed' }); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-elevated">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{editingId ? 'Edit Budget' : 'Add Budget'}</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingId && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Category</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {available.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCategoryId(c.id); setErrors((p) => ({ ...p, categoryId: '' })); }}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition-colors ${
                      categoryId === c.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}>
                    <span>{c.icon}</span> {c.name}
                  </button>
                ))}
              </div>
              {errors.categoryId && <p className="mt-1 text-xs text-danger-600">{errors.categoryId}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Budget Amount</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: '' })); }}
              className={`input-field mt-1 ${errors.amount ? 'border-danger-500' : ''}`} />
            {errors.amount && <p className="mt-1 text-xs text-danger-600">{errors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Period</label>
            <div className="flex gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-700/60 w-fit mb-3">
              <button type="button" onClick={() => setBudgetType('monthly')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${budgetType === 'monthly' ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
                Monthly
              </button>
              <button type="button" onClick={() => setBudgetType('custom')}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${budgetType === 'custom' ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
                Custom Range
              </button>
            </div>
            {budgetType === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                  className="input-field flex-1 text-sm" title="Start date" />
                <span className="text-neutral-400 dark:text-neutral-500 shrink-0">—</span>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                  className="input-field flex-1 text-sm" title="End date" />
              </div>
            )}
            {errors.period && <p className="mt-1 text-xs text-danger-600">{errors.period}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Alert Threshold (%)</label>
            <input type="number" placeholder="80" value={alertThreshold} onChange={(e) => setAlertThreshold(e.target.value)} className="input-field mt-1" />
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Get notified when spending reaches this %</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Rollover unused budget</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Carry remaining to next month</p>
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
