import { useState, useMemo } from 'react';
import { usePersonalStore } from '../../stores/personalStore';
import { usePersonalIncomeStore } from '../../stores/personalIncomeStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { formatCurrency } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

export default function SavingsTargetsWidget({ data }: { data: OverviewData }) {
  const { savingsTargets } = usePersonalStore();
  const { addSavingsTarget, updateSavingsTarget, deleteSavingsTarget } = usePersonalIncomeStore();
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');
  const addToast = useToastStore((s) => s.addToast);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('0');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    try {
      await addSavingsTarget({
        name: name.trim(),
        targetAmount: parseFloat(targetAmount),
        currentAmount: parseFloat(currentAmount || '0'),
        currency: defaultCurrency,
      });
      setName('');
      setTargetAmount('');
      setCurrentAmount('0');
      setShowForm(false);
      addToast('success', 'Savings target created');
    } catch {
      addToast('error', 'Failed to create savings target');
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-700/50">
        <h3 className="section-title">Savings Targets</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          {showForm ? 'Cancel' : 'Add Target'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-700/20 space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="Emergency Fund, Vacation, etc."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Target Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Saved So Far</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="input-field"
                placeholder="0.00"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full text-sm">
            Create Target
          </button>
        </form>
      )}

      <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {savingsTargets.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">No savings targets yet</p>
            <button onClick={() => setShowForm(true)} className="text-xs text-primary-600 dark:text-primary-400 mt-1 hover:underline">
              Create your first savings target
            </button>
          </div>
        ) : (
          savingsTargets.map((target) => {
            const percent = target.targetAmount > 0 ? Math.min((target.currentAmount / target.targetAmount) * 100, 100) : 0;
            const isComplete = target.currentAmount >= target.targetAmount;

            return (
              <div key={target.id} className="px-5 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{target.name}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await deleteSavingsTarget(target.id);
                        addToast('success', 'Target deleted');
                      } catch {
                        addToast('error', 'Failed to delete target');
                      }
                    }}
                    className="text-neutral-300 dark:text-neutral-600 hover:text-danger-500 transition-colors ml-2 shrink-0"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1.5">
                  <span>{formatCurrency(target.currentAmount, target.currency || defaultCurrency)} saved</span>
                  <span>Goal: {formatCurrency(target.targetAmount, target.currency || defaultCurrency)}</span>
                </div>
                <div className="relative h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      isComplete ? 'bg-success-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${Math.min(percent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  {isComplete ? 'Goal reached! 🎉' : `${percent.toFixed(1)}% complete`}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
