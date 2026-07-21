import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { computeBillStatus, getDaysUntilDue, type BillStatus } from '../../stores/recurringStore';
import { formatCurrency } from '@coldfi/shared';
import type { RecurringBill, Frequency } from '../../stores/personalStore';

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
};

const FREQUENCY_STYLES: Record<Frequency, string> = {
  weekly: 'bg-blue-100 text-blue-800',
  monthly: 'bg-green-100 text-green-800',
  yearly: 'bg-purple-100 text-purple-800',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_CONFIG: Record<BillStatus, { label: (days?: number) => string; classes: string }> = {
  paid: { label: () => 'Paid \u2713', classes: 'bg-green-100 text-green-800' },
  overdue: { label: (d) => `Overdue by ${Math.abs(d ?? 0)}d`, classes: 'bg-red-100 text-red-800' },
  due_soon: { label: (d) => `Due in ${d}d`, classes: 'bg-orange-100 text-orange-800' },
  due_today: { label: () => 'Due Today', classes: 'bg-orange-100 text-orange-800' },
  upcoming: { label: (d) => `Due in ${d}d`, classes: 'bg-blue-100 text-blue-800' },
  paused: { label: () => 'Paused', classes: 'bg-neutral-100 text-neutral-600' },
};

interface RecurringBillCardProps {
  bill: RecurringBill;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (bill: RecurringBill) => void;
  onMarkPaid: (id: string) => void;
  onUndoPaid: (id: string) => void;
}

export default function RecurringBillCard({ bill, onToggle, onEdit, onMarkPaid, onUndoPaid }: RecurringBillCardProps) {
  const defaultCurrency = useAuthStore((s) => s.defaultCurrency || 'BDT');
  const status = computeBillStatus(bill);
  const daysUntilDue = getDaysUntilDue(bill.nextDueDate);
  const dueDateStr = formatDate(bill.nextDueDate);
  const [expanded, setExpanded] = useState(false);

  const sc = STATUS_CONFIG[status];
  const badgeLabel = sc.label(daysUntilDue);

  return (
    <div className={`rounded-xl border bg-white transition-shadow hover:shadow-md ${!bill.isActive ? 'border-neutral-200 opacity-60' : status === 'overdue' ? 'border-red-200' : status === 'paid' ? 'border-green-200' : 'border-neutral-200'}`}>
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold text-neutral-900">{bill.name}</h3>
              <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${sc.classes}`}>{badgeLabel}</span>
            </div>
            <div className="mt-1 flex gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${FREQUENCY_STYLES[bill.frequency]}`}>{FREQUENCY_LABELS[bill.frequency]}</span>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" checked={bill.isActive} onChange={(e) => onToggle(bill.id, e.target.checked)} className="peer sr-only" />
            <div className="h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-neutral-300 after:bg-white after:transition-all peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300" />
          </label>
        </div>

        <p className="mb-3 text-2xl font-bold text-neutral-900">
          {formatCurrency(bill.amount, bill.currency || defaultCurrency)}
        </p>

        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <div>
            <p className="text-xs text-neutral-400">Category</p>
            <p className="font-semibold text-neutral-700">{bill.category || '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Next Due</p>
            <p className="font-semibold text-neutral-700">{dueDateStr}</p>
          </div>
          {bill.lastPaidDate && (
            <div>
              <p className="text-xs text-neutral-400">Last Paid</p>
              <p className="font-semibold text-neutral-700">{formatDate(bill.lastPaidDate)}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {status === 'paid' ? (
            <button type="button" onClick={() => onUndoPaid(bill.id)}
              className="flex-1 rounded-lg border border-neutral-200 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50">Undo Paid</button>
          ) : (
            <button type="button" onClick={() => onMarkPaid(bill.id)} disabled={!bill.isActive}
              className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">Mark as Paid</button>
          )}
          <button type="button" onClick={() => setExpanded(!expanded)}
            className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200">{expanded ? '\u25B2' : '\u25BC'}</button>
          <button type="button" onClick={() => onEdit(bill)}
            className="rounded-lg bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200">Edit</button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-neutral-400">Status</p>
              <p className={`mt-0.5 font-semibold ${status === 'paid' ? 'text-green-600' : status === 'overdue' ? 'text-red-600' : status === 'due_today' ? 'text-orange-600' : 'text-neutral-700'}`}>{badgeLabel}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Frequency</p>
              <p className="mt-0.5 font-semibold text-neutral-700">{FREQUENCY_LABELS[bill.frequency]}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">{daysUntilDue > 0 ? 'Days Until Due' : daysUntilDue < 0 ? 'Days Overdue' : 'Due Date'}</p>
              <p className="mt-0.5 font-semibold text-neutral-700">{daysUntilDue !== 0 ? `${Math.abs(daysUntilDue)} days` : 'Today'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Paused</p>
              <p className="mt-0.5 font-semibold text-neutral-700">{bill.isActive ? 'No' : 'Yes'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
