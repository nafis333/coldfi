import { useState } from 'react';

interface Member { userId: string; displayName?: string; email?: string; }

interface ItemRow {
  id: string; name: string; amount: string;
  participants: string[];
  splitMode: 'equal' | 'exact' | 'percentage';
  splitValues: Record<string, string>;
  selected: boolean; validationError: string;
}

interface ItemRowEditorProps {
  item: ItemRow;
  members: Member[];
  fieldError: string;
  onUpdate: (id: string, updates: Partial<ItemRow>) => void;
  onAmountChange: (id: string, amount: string) => void;
  onRemove: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleParticipant: (itemId: string, userId: string) => void;
  onToggleAllParticipants: (itemId: string, select: boolean) => void;
  onSplitModeChange: (itemId: string, mode: 'equal' | 'exact' | 'percentage') => void;
  onSplitValueChange: (itemId: string, pid: string, value: string) => void;
}

export default function ItemRowEditor({
  item, members, fieldError,
  onUpdate, onAmountChange, onRemove, onToggleSelect,
  onToggleParticipant, onToggleAllParticipants,
  onSplitModeChange, onSplitValueChange,
}: ItemRowEditorProps) {
  const [participantDropdown, setParticipantDropdown] = useState(false);

  const itemErr = fieldError || item.validationError;
  const hasName = item.name.trim().length > 0;
  const showValidation = hasName && itemErr;

  return (
    <div className={`rounded-xl border transition-all duration-200 p-3.5 ${item.selected ? 'border-primary-400 dark:border-primary-600 bg-primary-50/40 dark:bg-primary-900/10 shadow-sm' : itemErr ? 'border-danger-300 dark:border-danger-700 bg-danger-50/30 dark:bg-danger-900/5' : 'border-neutral-200 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600'}`}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <input type="checkbox" checked={item.selected} onChange={() => onToggleSelect(item.id)}
          className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30 shrink-0" />
        <input type="text" placeholder="Item name" value={item.name}
          onChange={(e) => onUpdate(item.id, { name: e.target.value, validationError: '' })}
          className="input-field flex-1 text-sm" />
        <input type="number" step="0.01" min="0" placeholder="Price" value={item.amount}
          onChange={(e) => onAmountChange(item.id, e.target.value)}
          className="input-field w-24 text-sm" />
        <button type="button" onClick={() => onRemove(item.id)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-300 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors shrink-0">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <div className="flex gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-700/60">
          {(['equal', 'exact', 'percentage'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => onSplitModeChange(item.id, mode)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${item.splitMode === mode ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>
              {mode === 'equal' ? 'Equal' : mode === 'exact' ? 'Exact' : '%'}
            </button>
          ))}
        </div>

        <button type="button" onClick={() => setParticipantDropdown(!participantDropdown)}
          className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium ml-auto px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          {item.participants.length === members.length ? 'All members' : `${item.participants.length} member${item.participants.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      {participantDropdown && (
        <div className="mb-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 max-h-40 overflow-y-auto shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-neutral-100 dark:border-neutral-700 mb-1 pb-2">
            <button type="button" onClick={() => onToggleAllParticipants(item.id, true)} className="text-xs font-medium text-primary-600 hover:text-primary-700">Select All</button>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <button type="button" onClick={() => onToggleAllParticipants(item.id, false)} className="text-xs text-neutral-500 hover:text-neutral-700">Clear</button>
          </div>
          {members.map((m) => (
            <label key={m.userId} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={item.participants.includes(m.userId)}
                onChange={() => onToggleParticipant(item.id, m.userId)}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/30" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{m.displayName || m.email}</span>
            </label>
          ))}
        </div>
      )}

      {item.splitMode !== 'equal' && item.participants.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/50">
          {item.participants.map((pid) => {
            const m = members.find((mm) => mm.userId === pid);
            return (
              <div key={pid} className="flex items-center gap-1.5">
                <span className="text-xs text-neutral-400 truncate max-w-[56px] shrink-0">{m?.displayName?.split(' ')[0] || pid.slice(0, 4)}</span>
                <input type="number" step="0.01" min="0" placeholder="0"
                  value={item.splitValues[pid] || ''}
                  onChange={(e) => onSplitValueChange(item.id, pid, e.target.value)}
                  className="input-field flex-1 text-xs py-1" />
                <span className="text-xs text-neutral-400 w-4 shrink-0">
                  {item.splitMode === 'percentage' ? '%' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showValidation && (
        <p className="mt-1.5 text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {itemErr}
        </p>
      )}
    </div>
  );
}
