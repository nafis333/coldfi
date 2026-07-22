import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { usePersonalStore } from '../stores/personalStore';
import { usePersonalExpenseStore } from '../stores/personalExpenseStore';
import { useAuthStore } from '../stores/authStore';
import { getCurrencySymbol } from '@coldfi/shared';
import ReceiptUpload from '../components/ReceiptUpload';
import CategoryPicker from './expenses/CategoryPicker';
import type { ReceiptFile } from '../lib/receipt';
import type { ExpenseItem } from '../lib/personalSync';

interface ItemRow {
  id: string; name: string; amount: string;
}

const itemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required'),
  amount: z.string().transform((v) => parseFloat(v)).pipe(z.number().positive('Amount must be greater than 0')),
});

const expenseSchema = z.object({
  items: z.array(itemSchema).min(1, 'Add at least one item'),
  categoryId: z.string().min(1, 'Please select a category'),
  date: z.string().min(1, 'Date is required'),
  payee: z.string().optional(),
  note: z.string().optional(),
  receiptUri: z.string().optional(),
});

export default function ExpenseFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;

  const { expenses, categories, fetchPersonalBlob } = usePersonalStore();
  const { addExpense, updateExpense } = usePersonalExpenseStore();

  const existingExpense = useMemo(
    () => (id ? expenses.find((e) => e.id === id) : undefined),
    [id, expenses]
  );

  function itemsFromExpense(): ItemRow[] {
    if (!existingExpense?.items?.length) return [{ id: 'item_0', name: '', amount: '' }];
    return existingExpense.items.map((item, i) => ({
      id: `item_${i}`, name: item.name, amount: item.amount.toString(),
    }));
  }

  const [items, setItems] = useState<ItemRow[]>(() => itemsFromExpense());
  const [form, setForm] = useState(() => ({
    categoryId: existingExpense?.categoryId || '',
    date: existingExpense?.date || new Date().toISOString().split('T')[0],
    payee: existingExpense?.payee || '',
    note: existingExpense?.note || '',
    receiptUri: existingExpense?.receiptUri || '',
  }));

  useEffect(() => {
    if (id && existingExpense) {
      setItems(itemsFromExpense());
      setForm({
        categoryId: existingExpense.categoryId || '',
        date: existingExpense.date || new Date().toISOString().split('T')[0],
        payee: existingExpense.payee || '',
        note: existingExpense.note || '',
        receiptUri: existingExpense.receiptUri || '',
      });
    }
  }, [id, existingExpense]);

  const totalAmount = useMemo(() =>
    items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [items]
  );

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

  function addItem() {
    setItems((prev) => [...prev, { id: `item_${Date.now()}_${prev.length}`, name: '', amount: '' }]);
  }

  function updateItem(id: string, field: 'name' | 'amount', value: string) {
    setItems((prev) => prev.map((item) => item.id !== id ? item : { ...item, [field]: value }));
    if (errors[id]) setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.length > 1 ? prev.filter((item) => item.id !== id) : prev);
  }

  const defaultCurrency = useAuthStore((s) => s.defaultCurrency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const result = expenseSchema.safeParse({
      items: items.map((i) => ({ name: i.name, amount: i.amount })),
      categoryId: form.categoryId,
      date: form.date,
      payee: form.payee || undefined,
      note: form.note || undefined,
      receiptUri: form.receiptUri || undefined,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string;
        if (path === 'items') {
          const idx = issue.path[1] as number;
          const sub = issue.path[2] as string;
          fieldErrors[`items_${idx}_${sub}`] = issue.message;
        } else if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const expenseItems: ExpenseItem[] = result.data.items.map((i) => ({ name: i.name, amount: i.amount }));
      const expenseData = {
        amount: expenseItems.reduce((s, i) => s + i.amount, 0),
        currency: defaultCurrency,
        categoryId: result.data.categoryId,
        date: result.data.date,
        payee: result.data.payee || null,
        note: result.data.note || null,
        paymentMethod: null,
        receiptUri: result.data.receiptUri || null,
        isRecurring: false,
        items: expenseItems,
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

  function itemError(idx: number, field: string): string | undefined {
    return errors[`items_${idx}_${field}`];
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">
          {isEditing ? 'Edit Expense' : 'Add Expense'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {isEditing ? 'Update the expense details below' : 'Enter the details of your expense'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-neutral-700">
              Items <span className="text-danger-500">*</span>
            </label>
            <button type="button" onClick={addItem} className="btn-ghost text-xs py-1 px-2">+ Add Item</button>
          </div>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    type="text" placeholder="Item name"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                    className={`input-field ${itemError(idx, 'name') ? 'border-danger-500' : ''}`}
                  />
                  {itemError(idx, 'name') && <p className="mt-0.5 text-xs text-danger-600">{itemError(idx, 'name')}</p>}
                </div>
                <div className="w-32 shrink-0">
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <span className="text-neutral-400 text-xs">{getCurrencySymbol(defaultCurrency)}</span>
                    </div>
                    <input
                      type="number" step="0.01" min="0" placeholder="0.00"
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, 'amount', e.target.value)}
                      className={`input-field pl-6 ${itemError(idx, 'amount') ? 'border-danger-500' : ''}`}
                    />
                  </div>
                  {itemError(idx, 'amount') && <p className="mt-0.5 text-xs text-danger-600">{itemError(idx, 'amount')}</p>}
                </div>
                <button
                  type="button" onClick={() => removeItem(item.id)}
                  className="mt-1.5 shrink-0 text-neutral-400 hover:text-danger-500 transition-colors"
                  aria-label="Remove item"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          {errors.items && <p className="mt-1 text-xs text-danger-600">{errors.items}</p>}
        </div>

        {items.some((i) => parseFloat(i.amount) > 0) && (
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-700/30 px-4 py-3">
            <span className="text-sm text-neutral-500">Total</span>
            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {getCurrencySymbol(defaultCurrency)}{totalAmount.toFixed(2)}
            </span>
          </div>
        )}

        <CategoryPicker
          value={form.categoryId}
          categories={categories}
          error={errors.categoryId}
          onChange={(catId) => setField('categoryId', catId)}
        />

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

        <div>
          <label className="block text-sm font-medium text-neutral-700">Payee</label>
          <input
            type="text"
            placeholder="Where did you spend?"
            value={form.payee}
            onChange={(e) => setField('payee', e.target.value)}
            className="input-field mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Note</label>
          <textarea
            placeholder="Add a note (optional)"
            value={form.note}
            onChange={(e) => setField('note', e.target.value)}
            rows={3}
            className="input-field mt-1 resize-none"
          />
        </div>

        <div>
          <ReceiptUpload
            onReceiptChange={(file) => {
              setReceiptFile(file);
              setField('receiptUri', file ? file.base64 : '');
            }}
            existingUri={form.receiptUri}
          />
        </div>

        {errors.form && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
            <p className="text-sm text-danger-700">{errors.form}</p>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
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
          <button type="button" onClick={() => navigate('/expenses')} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
