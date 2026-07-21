import { useState, useEffect, useRef, useMemo } from 'react';
import { useRecurringStore, computeBillStatus } from '../../stores/recurringStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '@coldfi/shared';
import type { RecurringBill } from '../../stores/personalStore';
import RecurringBillCard from './RecurringBillCard';
import RecurringBillForm from './RecurringBillForm';
import type { BillFormData } from './RecurringBillForm';

export default function RecurringBillsPage() {
  const {
    recurringBills,
    fetchRecurringBills,
    createRecurringBill,
    updateRecurringBill,
    toggleRecurringBill,
    markAsPaid,
    undoMarkAsPaid,
    processDueBills,
    clearGeneratedCount,
    isLoading,
    error,
  } = useRecurringStore();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');

  const [formVisible, setFormVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<BillFormData | undefined>(undefined);
  const [generatedNames, setGeneratedNames] = useState<string[]>([]);
  const processedRef = useRef(false);

  useEffect(() => {
    fetchRecurringBills();
  }, [fetchRecurringBills]);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;
    processDueBills().then((names) => {
      if (names.length > 0) {
        setGeneratedNames(names);
      }
    });
  }, [processDueBills]);

  const activeBills = recurringBills.filter((b) => b.isActive);
  const totalMonthly = useMemo(() => activeBills.reduce((sum, b) => {
    if (!b.amount || b.amount <= 0) return sum;
    const perMonth = b.frequency === 'weekly' ? b.amount * 4.33 : b.frequency === 'yearly' ? b.amount / 12 : b.amount;
    return sum + perMonth;
  }, 0), [activeBills]);

  const billStatuses = useMemo(() => new Map(activeBills.map((b) => [b.id, computeBillStatus(b)])), [activeBills]);

  const statusCounts = useMemo(() => {
    let overdue = 0, dueSoon = 0, paid = 0;
    for (const s of billStatuses.values()) {
      if (s === 'paid') paid++;
      else if (s === 'overdue') overdue++;
      else if (s === 'due_soon' || s === 'due_today') dueSoon++;
    }
    return { overdue, dueSoon, paid };
  }, [billStatuses]);

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleAdd = () => {
    setEditingBill(undefined);
    setFormVisible(true);
  };

  const handleEdit = (bill: RecurringBill) => {
    setEditingBill({
      id: bill.id,
      name: bill.name,
      amount: bill.amount.toFixed(2),
      frequency: bill.frequency,
      category: bill.category,
      nextDueDate: bill.nextDueDate,
    });
    setFormVisible(true);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { await toggleRecurringBill(id, active); } catch (e) { showError(e instanceof Error ? e.message : 'Failed to toggle'); }
  };

  const handleMarkPaid = async (id: string) => {
    try { await markAsPaid(id); } catch (e) { showError(e instanceof Error ? e.message : 'Failed to mark as paid'); }
  };

  const handleUndoPaid = async (id: string) => {
    try { await undoMarkAsPaid(id); } catch (e) { showError(e instanceof Error ? e.message : 'Failed to undo'); }
  };

  function parseAmount(s: string): number | null {
    const n = parseFloat(s);
    if (isNaN(n) || n < 0) return null;
    return n;
  }

  const handleSave = async (data: BillFormData) => {
    const amount = parseAmount(data.amount);
    if (amount === null) {
      showError('Enter a valid positive amount');
      return;
    }
    try {
      if (data.id) {
        await updateRecurringBill(data.id, {
          name: data.name,
          amount,
          frequency: data.frequency,
          category: data.category,
          nextDueDate: data.nextDueDate,
        });
      } else {
        await createRecurringBill({
          name: data.name,
          amount,
          frequency: data.frequency,
          category: data.category,
          nextDueDate: data.nextDueDate,
        });
      }
      setFormVisible(false);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to save bill');
    }
  };

  const dismissBanner = () => {
    setGeneratedNames([]);
    clearGeneratedCount();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {(errorMessage || error) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage || error}
        </div>
      )}

      {generatedNames.length > 0 && (
        <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-primary-800">
                Auto-generated {generatedNames.length} expense{generatedNames.length > 1 ? 's' : ''}
              </p>
              <p className="mt-1 text-sm text-primary-600">
                {generatedNames.join(', ')}
              </p>
            </div>
            <button type="button" onClick={dismissBanner} aria-label="Dismiss" className="text-primary-500 hover:text-primary-700">&times;</button>
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Recurring Bills</h1>
        <button type="button" onClick={handleAdd} className="btn-primary">+ Add Bill</button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">Monthly Total</p>
          <p className="text-lg font-bold text-neutral-900">{formatCurrency(totalMonthly, defaultCurrency)}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">Paid</p>
          <p className="text-lg font-bold text-green-600">{statusCounts.paid}/{activeBills.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">Due Soon</p>
          <p className={`text-lg font-bold ${statusCounts.dueSoon > 0 ? 'text-orange-600' : 'text-neutral-900'}`}>
            {statusCounts.dueSoon}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <p className="text-xs text-neutral-400">Overdue</p>
          <p className={`text-lg font-bold ${statusCounts.overdue > 0 ? 'text-red-600' : 'text-neutral-900'}`}>
            {statusCounts.overdue}
          </p>
        </div>
      </div>

      {isLoading && recurringBills.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : recurringBills.length === 0 && !isLoading ? (
        <div className="py-20 text-center">
          <p className="mb-2 text-xl font-bold text-neutral-900">No Recurring Bills</p>
          <p className="text-sm text-neutral-500">
            Add recurring bills to automatically track and manage regular payments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recurringBills.map((bill: RecurringBill) => (
            <RecurringBillCard
              key={bill.id}
              bill={bill}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onMarkPaid={handleMarkPaid}
              onUndoPaid={handleUndoPaid}
            />
          ))}
        </div>
      )}

      <RecurringBillForm
        visible={formVisible}
        initialData={editingBill}
        onSave={handleSave}
        onClose={() => setFormVisible(false)}
      />
    </div>
  );
}
