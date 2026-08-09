import { useState, useMemo } from 'react';
import { usePersonalStore } from '../../stores/personalStore';
import { usePersonalIncomeStore } from '../../stores/personalIncomeStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { localDateString } from '../../lib/dates';
import { formatCurrency, parseLocalDate } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

export default function IncomeWidget({ data }: { data: OverviewData }) {
  const { incomeLogs } = usePersonalStore();
  const { addIncome, deleteIncome } = usePersonalIncomeStore();
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateString(new Date()));
  const [submitting, setSubmitting] = useState(false);

  const recentIncome = useMemo(() => incomeLogs.slice(0, 5), [incomeLogs]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!source.trim() || !amount) return;
    setSubmitting(true);
    try {
      await addIncome({
        source: source.trim(),
        amount: parseFloat(amount),
        currency: defaultCurrency,
        date,
      });
      setSource('');
      setAmount('');
      setShowForm(false);
      addToast('success', 'Income added');
    } catch {
      addToast('error', 'Failed to add income');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
        <h3 className="section-title">Income</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          {showForm ? 'Cancel' : 'Add Income'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-700/20 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input-field"
              placeholder="Salary, Freelance, etc."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
            {submitting ? 'Adding...' : 'Add Income'}
          </button>
        </form>
      )}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {recentIncome.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">No income recorded yet</p>
            <button onClick={() => setShowForm(true)} className="text-xs text-primary-600 dark:text-primary-400 mt-1 hover:underline">
              Add your first income entry
            </button>
          </div>
        ) : (
          recentIncome.map((income) => (
            <div key={income.id} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{income.source}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {parseLocalDate(income.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-success-600 dark:text-success-400">
                  +{formatCurrency(income.amount, income.currency || defaultCurrency)}
                </span>
                <button
                  onClick={async () => {
                    try {
                      await deleteIncome(income.id);
                      addToast('success', 'Income deleted');
                    } catch {
                      addToast('error', 'Failed to delete income');
                    }
                  }}
                  className="text-neutral-300 dark:text-neutral-600 hover:text-danger-500 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
