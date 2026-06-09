import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import SettlementDialog from './SettlementDialog';

interface Settlement {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  toUserId: string;
  toDisplayName: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  note?: string;
  createdAt: string;
  confirmedAt?: string;
}

interface TabContext {
  groupId: string;
  group: { settlements: Settlement[]; members: { userId: string; displayName: string }[] };
  currentUserId: string;
}

export default function SettlementsTab() {
  const { groupId, group, currentUserId } = useOutletContext<TabContext>();
  const [dialogOpen, setDialogOpen] = useState(false);

  const settlements: Settlement[] = group.settlements ?? [];

  const pending = settlements.filter((s) => s.status === 'pending');
  const history = settlements.filter((s) => s.status !== 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900">
          Settlements {pending.length > 0 && <span className="ml-2 text-sm font-normal text-neutral-400">({pending.length} pending)</span>}
        </h2>
        <button onClick={() => setDialogOpen(true)} className="btn-primary text-sm">+ Propose Settlement</button>
      </div>

      {pending.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center">
          <p className="text-neutral-500">No pending settlements.</p>
        </div>
      )}

      {pending.map((s) => (
        <div key={s.id} className="card border-l-4 border-l-warning-400 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-700">
                <span className="font-medium">{s.fromDisplayName}</span> pays{' '}
                <span className="font-medium">{s.toDisplayName}</span>
              </p>
              <p className="text-lg font-bold text-neutral-900">${s.amount.toFixed(2)}</p>
              {s.note && <p className="text-xs text-neutral-500">{s.note}</p>}
            </div>
            <span className="inline-block rounded bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-700">Pending</span>
          </div>
        </div>
      ))}

      {history.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">History</h3>
          {history.map((s) => (
            <div key={s.id} className="card mb-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  <span className="font-medium text-neutral-800">{s.fromDisplayName}</span> paid{' '}
                  <span className="font-medium text-neutral-800">{s.toDisplayName}</span>
                  <span className="ml-2 font-semibold">${s.amount.toFixed(2)}</span>
                </p>
                <span className={`text-xs font-medium ${s.status === 'confirmed' ? 'text-success-600' : 'text-neutral-400'}`}>
                  {s.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <SettlementDialog
          groupId={groupId}
          currentUserId={currentUserId}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
