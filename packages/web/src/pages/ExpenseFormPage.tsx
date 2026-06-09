import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { usePersonalStore } from '../stores/personalStore';
import { getCurrencySymbol } from '@coldfi/shared';
import ReceiptUpload from '../components/ReceiptUpload';
import type { ReceiptFile } from '../lib/receipt';

const expenseSchema = z.object({
  amount: z
    .string()
    .min(1, 'Amount is required')
    .transform((v) => parseFloat(v))
    .pipe(
      z
        .number()
        .positive('Amount must be greater than 0')
        .max(999999.99, 'Amount cannot exceed 999,999.99')
    ),
  categoryId: z.string().min(1, 'Please select a category'),
  date: z.string().min(1, 'Date is required'),
  payee: z.string().optional(),
  note: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptUri: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'e_wallet', label: 'E-Wallet' },
  { id: 'other', label: 'Other' },
];

export default function ExpenseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { expenses, categories, fetchPersonalBlob, addExpense, updateExpense } =
    usePersonalStore();

  const existingExpense = useMemo(
    () => (id ? expenses.find((e) => e.id === id) : undefined),
    [id, expenses]
  );

  const [form, setForm] = useState(() => ({
    amount: existingExpense?.amount?.toString() || '',
    categoryId: existingExpense?.categoryId || '',
    date: existingExpense?.date || new Date().toISOString().split('T')[0],
    payee: existingExpense?.payee || '',
    note: existingExpense?.note || '',
    paymentMethod: existingExpense?.paymentMethod || '',
    receiptUri: existingExpense?.receiptUri || '',
  }));

  useEffect(() => {
    if (id && existingExpense) {
      setForm({
        amount: existingExpense.amount?.toString() || '',
        categoryId: existingExpense.categoryId || '',
        date: existingExpense.date || new Date().toISOString().split('T')[0],
        payee: existingExpense.payee || '',
        note: existingExpense.note || '',
        paymentMethod: existingExpense.paymentMethod || '',
        receiptUri: existingExpense.receiptUri || '',
      });
    }
  }, [id, existingExpense]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptFile, setReceiptFile] = useState<ReceiptFile | null>(null);

  useEffect(() => {
    fetchPersonalBlob();
  }, [fetchPersonalBlob]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = expenseSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const expenseData = {
        amount: result.data.amount,
        currency: 'USD',
        categoryId: result.data.categoryId,
        date: result.data.date,
        payee: result.data.payee || null,
        note: result.data.note || null,
        paymentMethod: result.data.paymentMethod || null,
        receiptUri: result.data.receiptUri || null,
        isRecurring: false,
      };

      if (isEditing && id) {
        await updateExpense(id, expenseData);
      } else {
        await addExpense(expenseData);
      }

      navigate('/expenses');
    } catch (err) {
      setErrors({
        form: err instanceof Error ? err.message : 'Failed to save expense',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">
          {isEditing ? 'Edit Expense' : 'Add Expense'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isEditing
            ? 'Update the expense details below'
            : 'Enter the details of your expense'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Amount <span className="text-danger-500">*</span>
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <span className="text-neutral-400 sm:text-sm">{getCurrencySymbol('USD')}</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
              className={`input-field pl-7 ${errors.amount ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
              autoFocus
            />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-danger-600">{errors.amount}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Category <span className="text-danger-500">*</span>
          </label>
          <select
            value={form.categoryId}
            onChange={(e) => setField('categoryId', e.target.value)}
            className={`input-field mt-1 ${errors.categoryId ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && <p className="mt-1 text-xs text-danger-600">{errors.categoryId}</p>}
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Date <span className="text-danger-500">*</span>
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className={`input-field mt-1 ${errors.date ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
          />
          {errors.date && <p className="mt-1 text-xs text-danger-600">{errors.date}</p>}
        </div>

        {/* Payee */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Payee
          </label>
          <input
            type="text"
            placeholder="Where did you spend?"
            value={form.payee}
            onChange={(e) => setField('payee', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Note
          </label>
          <textarea
            placeholder="Add a note (optional)"
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
            rows={3}
            className="input-field mt-1 resize-none"
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            Payment Method
          </label>
          <select
            value={form.paymentMethod}
            onChange={(e) => setField('paymentMethod', e.target.value)}
            className="input-field mt-1"
          >
            <option value="">Select payment method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Receipt */}
        <div>
          <ReceiptUpload
            onReceiptChange={(file) => {
              setReceiptFile(file);
              if (file) {
                setField('receiptUri', file.base64);
              } else {
                setField('receiptUri', '');
              }
            }}
            existingUri={form.receiptUri}
          />
        </div>

        {/* Form error */}
        {errors.form && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
            <p className="text-sm text-danger-700">{errors.form}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </span>
            ) : isEditing ? (
              'Update Expense'
            ) : (
              'Add Expense'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/expenses')}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
