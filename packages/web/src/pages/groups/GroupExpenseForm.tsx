import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGroupStore } from '../../stores/groupStore';
import { useGroupExpenseStore } from '../../stores/groupExpenseStore';
import { useAuthStore } from '../../stores/authStore';
import { SplitMode as EngineSplitMode } from '@coldfi/shared';
import CategoryPicker from './CategoryPicker';
import ItemizedList from './ItemizedList';

interface ItemRow {
  id: string; name: string; amount: string;
  participants: string[];
  splitMode: 'equal' | 'exact' | 'percentage';
  splitValues: Record<string, string>;
  selected: boolean; validationError: string;
}

function validateItem(item: ItemRow, membersCount: number): string {
  if (!item.name.trim()) return '';
  const amt = parseFloat(item.amount);
  if (isNaN(amt) || amt <= 0) return 'Enter a valid positive amount';
  if (item.participants.length === 0) return 'No participants selected';
  if (item.splitMode === 'exact') {
    const totalAssigned = item.participants.reduce((sum, pid) => sum + (parseFloat(item.splitValues[pid] || '0') || 0), 0);
    if (item.participants.some((pid) => !item.splitValues[pid] || parseFloat(item.splitValues[pid] || '0') <= 0)) return 'All participants need a positive amount';
    if (Math.abs(totalAssigned - amt) > 0.01) return `Assigned amounts total ${totalAssigned.toFixed(2)} but item is ${amt.toFixed(2)}`;
  }
  if (item.splitMode === 'percentage') {
    if (item.participants.some((pid) => !item.splitValues[pid] || parseFloat(item.splitValues[pid] || '0') <= 0)) return 'All participants need a positive percentage';
    const totalPct = item.participants.reduce((sum, pid) => sum + (parseFloat(item.splitValues[pid] || '0') || 0), 0);
    if (Math.abs(totalPct - 100) > 0.01) return `Percentages total ${totalPct.toFixed(1)}% but must be 100%`;
  }
  return '';
}

export default function GroupExpenseForm() {
  const { id: groupId, expenseId } = useParams<{ id: string; expenseId?: string }>();
  const navigate = useNavigate();
  const { currentGroup } = useGroupStore();
  const { createGroupExpense, updateGroupExpense } = useGroupExpenseStore();

  const members = currentGroup?.members ?? [];
  const memberIds = members.map((m) => m.userId);
  const isEditing = !!expenseId;

  const existingExpense = useMemo(() => {
    if (!expenseId || !currentGroup) return undefined;
    return currentGroup.expenses.find((e) => e.id === expenseId);
  }, [expenseId, currentGroup]);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [payerId, setPayerId] = useState('');

  const [items, setItems] = useState<ItemRow[]>([]);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      if (members.length > 0 && !payerId) setPayerId(members[0]!.userId);
      return;
    }
    if (!existingExpense) return;
    setDescription(existingExpense.description);
    setCategory(existingExpense.category);
    setPayerId(existingExpense.payerId);
    if (existingExpense.itemized && existingExpense.itemized.length > 0) {
      setItems(existingExpense.itemized.map((i) => {
        const splitValues: Record<string, string> = {};
        if (i.splitValues) for (const [k, v] of Object.entries(i.splitValues)) splitValues[k] = String(v);
        else if (i.splitMode && i.splitMode !== 'equal' && i.assignedTo) {
          const defaultVal = i.splitMode === 'percentage' ? (100 / i.assignedTo.length).toFixed(1) : (i.amount / i.assignedTo.length).toFixed(2);
          for (const pid of i.assignedTo) splitValues[pid] = defaultVal;
        }
        return {
          id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: i.name,
          amount: String(i.amount),
          participants: i.assignedTo || [...memberIds],
          splitMode: i.splitMode || 'equal',
          splitValues,
          selected: false,
          validationError: '',
        };
      }));
    } else {
      const itemAmount = existingExpense.amount;
      setItems([{
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        amount: String(itemAmount),
        participants: [...memberIds],
        splitMode: 'equal',
        splitValues: {},
        selected: false,
        validationError: '',
      }]);
    }
  }, [expenseId, existingExpense, members, isEditing, memberIds, payerId]);

  const totalAmount = useMemo(() =>
    items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0),
    [items]
  );

  function addItem() {
    setItems((prev) => [...prev, {
      id: `item_${Date.now()}_${prev.length}`, name: '', amount: '',
      participants: members.map((m) => m.userId), splitMode: 'equal', splitValues: {},
      selected: false, validationError: '',
    }]);
  }

  function updateItem(id: string, updates: Partial<ItemRow>) {
    setFieldErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setItems((prev) => prev.map((item) => item.id !== id ? item : { ...item, ...updates }));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleItemSelect(id: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  }

  function toggleParticipant(itemId: string, userId: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const exists = item.participants.includes(userId);
      const newParticipants = exists ? item.participants.filter((p) => p !== userId) : [...item.participants, userId];
      const newSplitValues = { ...item.splitValues };
      if (exists) delete newSplitValues[userId];
      else newSplitValues[userId] = '';
      return { ...item, participants: newParticipants, splitValues: newSplitValues, validationError: validateItem({ ...item, participants: newParticipants, splitValues: newSplitValues }, members.length) };
    }));
  }

  function toggleAllParticipants(itemId: string, select: boolean) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const newParticipants = select ? [...members.map((m) => m.userId)] : [];
      const newSplitValues: Record<string, string> = {};
      if (select && item.splitMode !== 'equal') for (const pid of newParticipants) newSplitValues[pid] = '';
      return { ...item, participants: newParticipants, splitValues: newSplitValues, validationError: validateItem({ ...item, participants: newParticipants, splitValues: newSplitValues }, members.length) };
    }));
  }

  function handleSplitModeChange(itemId: string, mode: 'equal' | 'exact' | 'percentage') {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      let splitValues: Record<string, string> = {};
      if (mode === 'equal') splitValues = {};
      else if (mode === 'exact') {
        const amt = parseFloat(item.amount) || 0;
        const count = item.participants.length || 1;
        const defaultVal = (amt / count).toFixed(2);
        for (const pid of item.participants) splitValues[pid] = defaultVal;
      } else {
        const count = item.participants.length || 1;
        const defaultVal = (100 / count).toFixed(1);
        for (const pid of item.participants) splitValues[pid] = defaultVal;
      }
      const updated = { ...item, splitMode: mode, splitValues };
      return { ...updated, validationError: validateItem(updated, members.length) };
    }));
  }

  function handleSplitValueChange(itemId: string, pid: string, value: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const newSplitValues = { ...item.splitValues, [pid]: value };
      const updated = { ...item, splitValues: newSplitValues };
      return { ...updated, validationError: validateItem(updated, members.length) };
    }));
  }

  function handleAmountChange(itemId: string, amount: string) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, amount };
      if (updated.splitMode === 'equal') return { ...updated, validationError: validateItem(updated, members.length) };
      const amt = parseFloat(amount) || 0;
      if (amt > 0 && updated.participants.length > 0 && updated.splitMode === 'exact') {
        const count = updated.participants.length;
        const defaultVal = (amt / count).toFixed(2);
        const splitValues: Record<string, string> = {};
        for (const pid of updated.participants) {
          splitValues[pid] = (parseFloat(updated.splitValues[pid] || '0') || 0) > 0 ? updated.splitValues[pid]! : defaultVal;
        }
        updated.splitValues = splitValues;
      }
      return { ...updated, validationError: validateItem(updated, members.length) };
    }));
  }

  function revalidateAll(): Record<string, string> {
    const errors: Record<string, string> = {};
    items.forEach((item) => {
      const err = validateItem(item, members.length);
      if (!item.name.trim() && !err) errors[item.id] = 'Item name required';
      else if (err) errors[item.id] = err;
    });
    return errors;
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!description.trim()) { setError('Description is required'); return; }
    if (!category) { setError('Select a category'); return; }
    if (!payerId) { setError('Select who paid'); return; }
    if (items.length === 0) { setError('Add at least one item'); return; }
    const errors = revalidateAll();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setError('Fix item errors before submitting'); return; }

    setSubmitting(true);
    try {
      const total = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
      if (total <= 0) { setError('Total expense amount must be greater than 0'); setSubmitting(false); return; }

      const splitsMap: Record<string, number> = {};
      for (const item of items) {
        const amt = parseFloat(item.amount) || 0;
        const participants = item.participants;
        if (item.splitMode === 'equal') {
          const share = participants.length > 0 ? amt / participants.length : 0;
          for (const pid of participants) splitsMap[pid] = (splitsMap[pid] || 0) + share;
        } else if (item.splitMode === 'exact') {
          for (const pid of participants) splitsMap[pid] = (splitsMap[pid] || 0) + (parseFloat(item.splitValues[pid] || '0') || 0);
        } else if (item.splitMode === 'percentage') {
          const totalPct = participants.reduce((s, pid) => s + (parseFloat(item.splitValues[pid] || '0') || 0), 0);
          for (const pid of participants) {
            splitsMap[pid] = (splitsMap[pid] || 0) + (totalPct > 0 ? (amt * (parseFloat(item.splitValues[pid] || '0') || 0)) / totalPct : 0);
          }
        }
      }

      const splitTotal = Object.values(splitsMap).reduce((s, v) => s + v, 0);
      if (Math.abs(splitTotal - total) > 0.01) {
        if (splitTotal === 0) {
          const pids = Object.keys(splitsMap);
          const share = Math.round((total / pids.length) * 100) / 100;
          for (const pid of pids) splitsMap[pid] = share;
        } else {
          const scale = total / splitTotal;
          for (const pid of Object.keys(splitsMap)) splitsMap[pid] = Math.round(Math.abs(splitsMap[pid]!) * scale * 100) / 100;
        }
        const roundedTotal = Object.values(splitsMap).reduce((s, v) => s + v, 0);
        const diff = Math.round((total - roundedTotal) * 100);
        if (diff !== 0) {
          const pids = Object.keys(splitsMap);
          for (let i = 0; i < Math.abs(diff); i++) splitsMap[pids[i % pids.length]!]! += (diff > 0 ? 0.01 : -0.01);
        }
      }

      const finalSplits = Object.entries(splitsMap).map(([userId, amount]) => ({ userId, amount: Math.round(amount * 100) / 100 }));

      const itemizedData = items.filter((i) => i.name.trim()).map((i) => {
        const splitValues: Record<string, number> = {};
        if (i.splitMode !== 'equal') for (const pid of i.participants) splitValues[pid] = parseFloat(i.splitValues[pid] || '0') || 0;
        return { name: i.name, amount: parseFloat(i.amount) || 0, assignedTo: i.participants, splitMode: i.splitMode, splitValues: i.splitMode !== 'equal' ? splitValues : undefined };
      });

      if (isEditing && expenseId) {
        await updateGroupExpense(groupId!, expenseId, {
          amount: total, description: description.trim(), category, payerId,
          splits: finalSplits, itemized: itemizedData,
        });
      } else {
        await createGroupExpense(groupId!, {
          amount: total, description: description.trim(), category, payerId,
          splits: finalSplits, itemized: itemizedData, splitMode: EngineSplitMode.RATIO,
        });
      }
      navigate(`/groups/${groupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} expense`);
    } finally {
      setSubmitting(false);
    }
  }, [description, category, payerId, items, createGroupExpense, updateGroupExpense, groupId, navigate, members, isEditing, expenseId]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <button type="button" onClick={() => navigate(`/groups/${groupId}`)} className="btn-ghost p-1.5 -ml-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">{isEditing ? 'Edit Group Expense' : 'Add Group Expense'}</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{currentGroup?.name}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5 sm:p-6 space-y-5">
          <h2 className="section-title">Basic Info</h2>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Description</label>
            <input type="text" placeholder="What was this for?" value={description}
              onChange={(e) => setDescription(e.target.value)} className="input-field" autoFocus />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Category</label>
            <CategoryPicker category={category} onChange={setCategory} groupId={groupId!} />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Paid By</label>
            <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className="input-field">
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.displayName || m.email}</option>
              ))}
            </select>
          </div>
        </div>

        <ItemizedList
          items={items} members={members} fieldErrors={fieldErrors}
          onAdd={addItem} onUpdate={updateItem} onAmountChange={handleAmountChange}
          onRemove={removeItem} onToggleSelect={toggleItemSelect}
          onToggleParticipant={toggleParticipant} onToggleAllParticipants={toggleAllParticipants}
          onSplitModeChange={handleSplitModeChange} onSplitValueChange={handleSplitValueChange}
        />

        {items.length > 0 && (
          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Total</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
              <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                {totalAmount.toFixed(2)} <span className="text-base font-medium text-neutral-400">{currentGroup?.defaultCurrency || useAuthStore.getState().defaultCurrency}</span>
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger-200 dark:border-danger-800/50 bg-danger-50 dark:bg-danger-900/20 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-danger-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm font-medium text-danger-700 dark:text-danger-300">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={submitting || items.length === 0} className="btn-primary">
            {submitting ? (
              <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> {isEditing ? 'Updating...' : 'Creating...'}</span>
            ) : isEditing ? 'Update Expense' : 'Create Expense'}
          </button>
          <button type="button" onClick={() => navigate(`/groups/${groupId}`)} className="btn-ghost">Cancel</button>
        </div>
      </form>
    </div>
  );
}
