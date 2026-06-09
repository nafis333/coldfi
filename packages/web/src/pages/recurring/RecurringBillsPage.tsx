import { useState, useEffect, useCallback } from 'react';
import { useRecurringStore } from '../../stores/recurringStore';
import type { RecurringBill, Frequency } from '../../stores/personalStore';

interface BillFormData {
  id?: string;
  name: string;
  amount: string;
  frequency: Frequency;
  category: string;
  nextDueDate: string;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const FREQUENCY_STYLES: Record<Frequency, string> = {
  weekly: 'bg-blue-100 text-blue-800',
  monthly: 'bg-green-100 text-green-800',
  yearly: 'bg-purple-100 text-purple-800',
};

function BillCard({
  bill,
  onToggle,
  onEdit,
}: {
  bill: RecurringBill;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (bill: RecurringBill) => void;
}) {
  const dueDate = new Date(bill.nextDueDate).toLocaleDateString();

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${!bill.isActive ? 'opacity-60' : ''}`}>
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1 mr-3">
          <h3 className="truncate text-base font-bold text-neutral-900">{bill.name}</h3>
          <div className="mt-1 flex gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${FREQUENCY_STYLES[bill.frequency]}`}>
              {FREQUENCY_LABELS[bill.frequency]}
            </span>
            {!bill.isActive && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                Paused
              </span>
            )}
          </div>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={bill.isActive}
            onChange={(e) => onToggle(bill.id, e.target.checked)}
            className="peer sr-only"
          />
          <div className="h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300" />
        </label>
      </div>

      <p className="mb-3 text-2xl font-bold text-neutral-900">${bill.amount.toFixed(2)}</p>

      <div className="mb-3 flex gap-4">
        <div>
          <p className="text-xs text-neutral-400">Category</p>
          <p className="text-sm font-semibold text-neutral-700">{bill.category}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-400">Next Due</p>
          <p className="text-sm font-semibold text-neutral-700">{dueDate}</p>
        </div>
      </div>

      <button
        onClick={() => onEdit(bill)}
        className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200"
      >
        Edit
      </button>
    </div>
  );
}

function BillFormModal({
  visible,
  initialData,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialData?: BillFormData;
  onSave: (data: BillFormData) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [amount, setAmount] = useState(initialData?.amount ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initialData?.frequency ?? 'monthly');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [nextDueDate, setNextDueDate] = useState(initialData?.nextDueDate ?? '');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAmount(initialData.amount);
      setFrequency(initialData.frequency);
      setCategory(initialData.category);
      setNextDueDate(initialData.nextDueDate);
    } else {
      setName('');
      setAmount('');
      setFrequency('monthly');
      setCategory('');
      setNextDueDate('');
    }
  }, [initialData, visible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialData?.id,
      name: name.trim(),
      amount,
      frequency,
      category,
      nextDueDate,
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-bold text-neutral-900">
          {initialData?.id ? 'Edit Bill' : 'Add Bill'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g., Netflix"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Amount</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="input-field"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field"
              placeholder="e.g., Utilities"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Next Due Date</label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RecurringBillsPage() {
  const {
    recurringBills,
    fetchRecurringBills,
    createRecurringBill,
    updateRecurringBill,
    toggleRecurringBill,
    isLoading,
  } = useRecurringStore();

  const [formVisible, setFormVisible] = useState(false);
  const [editingBill, setEditingBill] = useState<BillFormData | undefined>(undefined);

  useEffect(() => {
    fetchRecurringBills();
  }, [fetchRecurringBills]);

  const handleAdd = () => {
    setEditingBill(undefined);
    setFormVisible(true);
  };

  const handleEdit = (bill: RecurringBill) => {
    setEditingBill({
      id: bill.id,
      name: bill.name,
      amount: bill.amount.toString(),
      frequency: bill.frequency,
      category: bill.category,
      nextDueDate: bill.nextDueDate,
    });
    setFormVisible(true);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { await toggleRecurringBill(id, active); } catch {}
  };

  const handleSave = async (data: BillFormData) => {
    try {
      if (data.id) {
        await updateRecurringBill(data.id, {
          name: data.name,
          amount: parseFloat(data.amount),
          frequency: data.frequency,
          category: data.category,
          nextDueDate: data.nextDueDate,
        });
      } else {
        await createRecurringBill({
          name: data.name,
          amount: parseFloat(data.amount),
          frequency: data.frequency,
          category: data.category,
          nextDueDate: data.nextDueDate,
        });
      }
      setFormVisible(false);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Recurring Bills</h1>
        <button
          onClick={handleAdd}
          className="btn-primary"
        >
          + Add Bill
        </button>
      </div>

      {isLoading && recurringBills.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : recurringBills.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-2 text-xl font-bold text-neutral-900">No Recurring Bills</p>
          <p className="text-sm text-neutral-500">
            Add recurring bills to automatically track and manage regular payments.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {recurringBills.map((bill: RecurringBill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onToggle={handleToggle}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      <BillFormModal
        visible={formVisible}
        initialData={editingBill}
        onSave={handleSave}
        onClose={() => setFormVisible(false)}
      />
    </div>
  );
}
