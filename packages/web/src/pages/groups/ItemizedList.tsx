import { useState, useRef, useEffect } from 'react';
import ItemRowEditor from './ItemRowEditor';

interface Member { userId: string; displayName?: string; email?: string; }

interface ItemRow {
  id: string; name: string; amount: string;
  participants: string[];
  splitMode: 'equal' | 'exact' | 'percentage';
  splitValues: Record<string, string>;
  selected: boolean; validationError: string;
}

interface ItemizedListProps {
  items: ItemRow[];
  members: Member[];
  fieldErrors: Record<string, string>;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<ItemRow>) => void;
  onAmountChange: (id: string, amount: string) => void;
  onRemove: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleParticipant: (itemId: string, userId: string) => void;
  onToggleAllParticipants: (itemId: string, select: boolean) => void;
  onSplitModeChange: (itemId: string, mode: 'equal' | 'exact' | 'percentage') => void;
  onSplitValueChange: (itemId: string, pid: string, value: string) => void;
}

export default function ItemizedList({
  items, members, fieldErrors,
  onAdd, onUpdate, onAmountChange, onRemove, onToggleSelect,
  onToggleParticipant, onToggleAllParticipants,
  onSplitModeChange, onSplitValueChange,
}: ItemizedListProps) {
  const [bulkSplitMode, setBulkSplitMode] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [bulkParticipantIds, setBulkParticipantIds] = useState<string[]>(members.map((m) => m.userId));
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCount = items.filter((i) => i.selected).length;

  function applyBulk() {
    for (const item of items) {
      if (!item.selected) continue;
      const newParticipants = [...bulkParticipantIds];
      let splitValues: Record<string, string> = {};
      if (bulkSplitMode === 'exact') {
        const amt = parseFloat(item.amount) || 0;
        const count = newParticipants.length || 1;
        const val = (amt / count).toFixed(2);
        for (const pid of newParticipants) splitValues[pid] = val;
      } else if (bulkSplitMode === 'percentage') {
        const count = newParticipants.length || 1;
        const val = (100 / count).toFixed(1);
        for (const pid of newParticipants) splitValues[pid] = val;
      }
      const updated = { ...item, splitMode: bulkSplitMode, participants: newParticipants, splitValues };
      updated.validationError = validateItem(updated, members.length);
      onUpdate(item.id, updated);
    }
  }

  return (
    <div className="card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Items <span className="text-xs font-normal lowercase text-neutral-400">({items.length})</span></h2>
        <button type="button" onClick={onAdd} className="btn-ghost text-sm px-3 py-1.5">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add item
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="rounded-xl border border-primary-200/80 dark:border-primary-800/50 bg-primary-50/80 dark:bg-primary-900/15 p-3.5 space-y-2.5 animate-fade-in">
          <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">{selectedCount} item{selectedCount > 1 ? 's' : ''} selected</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Split:</span>
            <select value={bulkSplitMode} onChange={(e) => setBulkSplitMode(e.target.value as any)}
              className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-xs py-1.5 px-2 text-neutral-700 dark:text-neutral-200 w-24 focus:ring-1 focus:ring-primary-500">
              <option value="equal">Equal</option>
              <option value="exact">Exact</option>
              <option value="percentage">%</option>
            </select>

            <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">Members:</span>

            <button type="button" onClick={() => { setBulkParticipantIds(members.map((m) => m.userId)); }}
              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
              All
            </button>
            <button type="button" onClick={() => { setBulkParticipantIds([]); }}
              className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 hover:border-danger-300 dark:hover:border-danger-700 hover:text-danger-600 transition-colors">
              None
            </button>

            <div className="relative" ref={memberDropdownRef}>
              <button type="button" onClick={() => setShowMemberDropdown(!showMemberDropdown)}
                className="text-xs px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-600 transition-colors flex items-center gap-1">
                {bulkParticipantIds.length === 0 ? 'Select...' : `${bulkParticipantIds.length} member${bulkParticipantIds.length !== 1 ? 's' : ''}`}
                <svg className={`h-3 w-3 transition-transform ${showMemberDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showMemberDropdown && (
                <div className="absolute left-0 top-full mt-1 z-20 min-w-44 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 shadow-lg animate-fade-in max-h-52 overflow-y-auto">
                  {members.map((m) => {
                    const selected = bulkParticipantIds.includes(m.userId);
                    return (
                      <label key={m.userId} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={selected}
                          onChange={() => {
                            setBulkParticipantIds((prev) =>
                              selected ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                            );
                          }}
                          className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30" />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{m.displayName || m.email}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <button type="button" onClick={applyBulk} className="btn-primary text-xs !px-2.5 !py-1">Apply</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <ItemRowEditor key={item.id} item={item} members={members}
            fieldError={fieldErrors[item.id] || ''}
            onUpdate={onUpdate} onAmountChange={onAmountChange} onRemove={onRemove}
            onToggleSelect={onToggleSelect}
            onToggleParticipant={onToggleParticipant} onToggleAllParticipants={onToggleAllParticipants}
            onSplitModeChange={onSplitModeChange} onSplitValueChange={onSplitValueChange} />
        ))}
      </div>

      {items.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700/60 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
            <svg className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
          </div>
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">No items added yet</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">Click "Add item" to list what was purchased</p>
        </div>
      )}
    </div>
  );
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
