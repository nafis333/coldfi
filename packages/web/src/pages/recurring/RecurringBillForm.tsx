import { useState, useEffect } from 'react';
import type { Frequency } from '../../stores/personalStore';

export interface BillFormData {
  id?: string;
  name: string;
  amount: string;
  frequency: Frequency;
  category: string;
  nextDueDate: string;
}

interface RecurringBillFormProps {
  visible: boolean;
  initialData?: BillFormData;
  onSave: (data: BillFormData) => void;
  onClose: () => void;
}

export default function RecurringBillForm({ visible, initialData, onSave, onClose }: RecurringBillFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [amount, setAmount] = useState(initialData?.amount ?? '');
  const [frequency, setFrequency] = useState<Frequency>(initialData?.frequency ?? 'monthly');
  const [category, setCategory] = useState(initialData?.category ?? '');
  const [nextDueDate, setNextDueDate] = useState(initialData?.nextDueDate ?? '');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name); setAmount(initialData.amount);
      setFrequency(initialData.frequency); setCategory(initialData.category);
      setNextDueDate(initialData.nextDueDate);
    } else {
      setName(''); setAmount(''); setFrequency('monthly'); setCategory(''); setNextDueDate('');
    }
  }, [initialData, visible]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: initialData?.id, name: name.trim(), amount, frequency, category, nextDueDate });
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-xl font-bold text-neutral-900">{initialData?.id ? 'Edit Bill' : 'Add Bill'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g., Netflix" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Amount</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field" placeholder="0.00" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="input-field">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="input-field" placeholder="e.g., Utilities" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Next Due Date</label>
            <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="input-field" required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
