import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import { usePersonalStore } from '../../stores/personalStore';

type SplitMode = 'equal' | 'exact' | 'percentage';

interface ItemizedItem {
  id: string;
  name: string;
  amount: string;
}

interface MemberSplit {
  userId: string;
  displayName: string;
  value: string;
}

const CATEGORIES = [
  { id: 'food_drink', name: 'Food & Drink', icon: '🍕' },
  { id: 'transport', name: 'Transport', icon: '🚗' },
  { id: 'accommodation', name: 'Accommodation', icon: '🏠' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️' },
  { id: 'utilities', name: 'Utilities', icon: '💡' },
  { id: 'other', name: 'Other', icon: '📝' },
];

export default function GroupExpenseForm() {
  const { id: groupId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentGroup, createGroupExpense, isLoading } = useGroupStore();
  const { categories } = usePersonalStore();

  const members = currentGroup?.members ?? [];

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState(members.length > 0 ? members[0]!.userId : '');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [splits, setSplits] = useState<MemberSplit[]>(() =>
    members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName || m.email || '',
      value: '',
    }))
  );
  const [itemized, setItemized] = useState<ItemizedItem[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseFloat(amount) || 0;

  const computedSplits = useMemo(() => {
    if (splitMode === 'equal') {
      const share = members.length > 0 ? parsedAmount / members.length : 0;
      return splits.map((s) => ({ ...s, value: share.toFixed(2) }));
    }
    if (splitMode === 'percentage') {
      const totalPct = splits.reduce((sum, s) => sum + (parseFloat(s.value) || 0), 0);
      if (totalPct === 0) return splits;
      return splits.map((s) => ({
        ...s,
        value: ((parsedAmount * (parseFloat(s.value) || 0)) / totalPct).toFixed(2),
      }));
    }
    return splits;
  }, [splitMode, parsedAmount, splits, members.length]);

  function updateSplit(userId: string, rawValue: string) {
    setSplits((prev) =>
      prev.map((s) => (s.userId === userId ? { ...s, value: rawValue } : s))
    );
  }

  function toggleMember(userId: string) {
    const exists = splits.find((s) => s.userId === userId);
    if (exists) {
      setSplits((prev) => prev.filter((s) => s.userId !== userId));
    } else {
      const member = members.find((m) => m.userId === userId);
      if (member) {
        setSplits((prev) => [
          ...prev,
          { userId: member.userId, displayName: member.displayName || member.email || '', value: '' },
        ]);
      }
    }
  }

  function addItemizedItem() {
    setItemized((prev) => [...prev, { id: `item_${prev.length}_${Date.now()}`, name: '', amount: '' }]);
  }

  function updateItemized(id: string, field: 'name' | 'amount', value: string) {
    setItemized((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  function removeItemized(id: string) {
    setItemized((prev) => prev.filter((item) => item.id !== id));
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!amount || parsedAmount <= 0) { setError('Enter a valid amount'); return; }
      if (!description.trim()) { setError('Description is required'); return; }
      if (!category) { setError('Select a category'); return; }
      if (splitMode === 'exact' || splitMode === 'percentage') {
        const totalSplit = computedSplits.reduce((s, sp) => s + (parseFloat(sp.value) || 0), 0);
        if (Math.abs(totalSplit - parsedAmount) > 0.01) {
          setError(`Split total (${totalSplit.toFixed(2)}) must equal amount (${parsedAmount.toFixed(2)})`);
          return;
        }
      }

      setSubmitting(true);
      try {
        const splitsData = computedSplits
          .filter((s) => s.value !== '')
          .map((s) => ({
            userId: s.userId,
            amount: parseFloat(s.value) || 0,
          }));
        const itemizedData = itemized
          .filter((i) => i.name.trim() && parseFloat(i.amount) > 0)
          .map((i) => ({ name: i.name, amount: parseFloat(i.amount) }));

        await createGroupExpense(groupId!, {
          amount: parsedAmount,
          description: description.trim(),
          category,
          payerId,
          splits: splitsData,
          itemized: itemizedData.length > 0 ? itemizedData : undefined,
        });
        navigate(`/groups/${groupId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create expense');
      } finally {
        setSubmitting(false);
      }
    },
    [amount, parsedAmount, description, category, payerId, computedSplits, itemized, createGroupExpense, groupId, navigate]
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Add Group Expense</h1>
        <p className="mt-1 text-sm text-neutral-500">{currentGroup?.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5 p-6">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">Amount</label>
          <input type="number" step="0.01" placeholder="0.00" value={amount}
            onChange={(e) => setAmount(e.target.value)} className="input-field mt-1" autoFocus />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">Description</label>
          <input type="text" placeholder="What was this for?" value={description}
            onChange={(e) => setDescription(e.target.value)} className="input-field mt-1" />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field mt-1">
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </div>

        {/* Payer */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">Paid By</label>
          <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="input-field mt-1">
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>
            ))}
          </select>
        </div>

        {/* Split Mode */}
        <div>
          <label className="block text-sm font-medium text-neutral-700">Split Mode</label>
          <div className="mt-1 flex gap-2">
            {(['equal', 'exact', 'percentage'] as SplitMode[]).map((mode) => (
              <button key={mode} type="button" onClick={() => setSplitMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  splitMode === mode ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Split Members */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            Split Between {splitMode === 'equal' ? '(auto)' : ''}
          </p>
          {members.map((m) => {
            const split = computedSplits.find((s) => s.userId === m.userId);
            const checked = !!split;
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
                <input type="checkbox" checked={checked}
                  onChange={() => toggleMember(m.userId)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
                <span className="flex-1 text-sm text-neutral-700">{m.displayName || m.email}</span>
                {checked && splitMode !== 'equal' && (
                  <input type="number" step="0.01" placeholder="0.00"
                    value={split?.value || ''}
                    onChange={(e) => updateSplit(m.userId, e.target.value)}
                    className="input-field w-24 text-sm" />
                )}
                {checked && splitMode === 'equal' && (
                  <span className="text-sm font-medium text-neutral-600">${split?.value || '0.00'}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Itemized Items */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Itemized (optional)</p>
            <button type="button" onClick={addItemizedItem}
              className="text-sm font-medium text-primary-600 hover:text-primary-700">+ Add item</button>
          </div>
          {itemized.map((item) => (
            <div key={item.id} className="mt-2 flex items-center gap-2">
              <input type="text" placeholder="Item name" value={item.name}
                onChange={(e) => updateItemized(item.id, 'name', e.target.value)}
                className="input-field flex-1 text-sm" />
              <input type="number" step="0.01" placeholder="Amount" value={item.amount}
                onChange={(e) => updateItemized(item.id, 'amount', e.target.value)}
                className="input-field w-24 text-sm" />
              <button type="button" onClick={() => removeItemized(item.id)}
                className="text-sm text-danger-600 hover:text-danger-700">x</button>
            </div>
          ))}
        </div>

        {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3"><p className="text-sm text-danger-700">{error}</p></div>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating...' : 'Create Expense'}
          </button>
          <button type="button" onClick={() => navigate(`/groups/${groupId}`)} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
