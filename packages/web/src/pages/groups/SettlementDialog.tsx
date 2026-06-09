import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Member {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

interface Props {
  groupId: string;
  currentUserId: string;
  onClose: () => void;
}

export default function SettlementDialog({ groupId, currentUserId, onClose }: Props) {
  const { currentGroup, proposeSettlement, isLoading } = useGroupStore();
  const members: Member[] = currentGroup?.members ?? [];

  const [amount, setAmount] = useState('');
  const [fromUserId, setFromUserId] = useState(currentUserId);
  const [toUserId, setToUserId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const otherMembers = members.filter((m) => m.userId !== fromUserId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (!amount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
    if (!toUserId) { setError('Select the recipient'); return; }
    if (fromUserId === toUserId) { setError('Cannot settle with yourself'); return; }

    setSubmitting(true);
    try {
      await proposeSettlement(groupId, {
        fromUserId,
        toUserId,
        amount: parsedAmount,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to propose settlement');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-neutral-900">Propose Settlement</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Who Pays</label>
            <select value={fromUserId} onChange={(e) => setFromUserId(e.target.value)} className="input-field mt-1">
              {members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Who Receives</label>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input-field mt-1">
              <option value="">Select member</option>
              {otherMembers.map((m) => <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Amount</label>
            <input type="number" step="0.01" placeholder="0.00" value={amount}
              onChange={(e) => setAmount(e.target.value)} className="input-field mt-1" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Note (optional)</label>
            <input type="text" placeholder="For dinner, etc." value={note}
              onChange={(e) => setNote(e.target.value)} className="input-field mt-1" />
          </div>

          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3"><p className="text-sm text-danger-700">{error}</p></div>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Proposing...' : 'Propose Settlement'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
