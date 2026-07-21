import { useState, useRef, useEffect } from 'react';
import { useGroupStore } from '../../stores/groupStore';

const CATEGORY_ICONS = ['🍕', '🚗', '🏠', '🎬', '🛍️', '💡', '📝', '💊', '🎓', '✈️', '🐾', '🎁', '💻', '🏋️', '☕', '🎵', '👕', '📱', '🏥', '📦'];
const CATEGORY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

const DEFAULT_CATEGORIES = [
  { id: 'food_drink', name: 'Food & Drink', icon: '🍕', color: '#ef4444' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#f97316' },
  { id: 'accommodation', name: 'Accommodation', icon: '🏠', color: '#eab308' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#8b5cf6' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#ec4899' },
  { id: 'utilities', name: 'Utilities', icon: '💡', color: '#14b8a6' },
  { id: 'other', name: 'Other', icon: '📝', color: '#6366f1' },
];

interface CategoryPickerProps {
  category: string;
  onChange: (id: string) => void;
  groupId: string;
}

export default function CategoryPicker({ category, onChange, groupId }: CategoryPickerProps) {
  const currentGroup = useGroupStore((s) => s.currentGroup);
  const addGroupCategory = useGroupStore((s) => s.addGroupCategory);
  const groupCategories = currentGroup?.groupCategories ?? [];
  const allCategories = [...DEFAULT_CATEGORIES, ...groupCategories.filter(
    (gc) => !DEFAULT_CATEGORIES.some((dc) => dc.id === gc.id)
  )];

  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [newError, setNewError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNew(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function resetNew() { setNewName(''); setNewIcon(''); setNewColor(CATEGORY_COLORS[0]); setNewError(''); }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(!open); setShowNew(false); }}
        className="input-field w-full text-left flex items-center gap-2">
        {category ? (
          (() => {
            const c = allCategories.find((c) => c.id === category);
            return c ? <><span>{c.icon}</span><span>{c.name}</span></> : <span className="text-neutral-400 dark:text-neutral-500">{category}</span>;
          })()
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">Select category</span>
        )}
        <svg className="ml-auto h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && !showNew && (
        <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg max-h-64 overflow-y-auto animate-fade-in">
          {allCategories.map((c) => {
            const isDefault = DEFAULT_CATEGORIES.some((dc) => dc.id === c.id);
            return (
              <div key={c.id} className={`flex items-center px-3 py-2.5 text-sm transition-colors cursor-pointer ${category === c.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300'}`}
                onClick={() => { onChange(c.id); setOpen(false); }}>
                <span className="flex items-center gap-2 flex-1 min-w-0"><span>{c.icon}</span><span className="truncate">{c.name}</span></span>
                <span className="flex items-center gap-1 shrink-0">
                  {category === c.id && <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                  {!isDefault && (
                    <button type="button" onClick={async (e) => { e.stopPropagation(); if (confirm(`Delete category "${c.name}"?`)) { await useGroupStore.getState().removeGroupCategory(groupId, c.id); } }}
                      className="ml-1 text-neutral-300 hover:text-danger-500 dark:text-neutral-600 dark:hover:text-danger-400 text-sm px-1" title="Delete category">✕</button>
                  )}
                </span>
              </div>
            );
          })}
          <div className="border-t border-neutral-100 dark:border-neutral-700">
            <button type="button" onClick={() => setShowNew(true)}
              className="w-full px-3 py-3 text-left text-sm text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 flex items-center gap-2 font-medium transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>Add new category</span>
            </button>
          </div>
        </div>
      )}
      {open && showNew && (
        <div className="absolute z-10 mt-1.5 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-lg p-4 sm:p-5 animate-fade-in">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">New Category</h4>
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Name</label>
          <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Groceries" className="input-field mb-4 text-sm" autoFocus />
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Icon</label>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CATEGORY_ICONS.map((icon) => (
              <button key={icon} type="button" onClick={() => setNewIcon(icon)}
                className={`h-9 w-9 flex items-center justify-center rounded-lg text-base transition-all ${newIcon === icon ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-110' : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}>{icon}</button>
            ))}
          </div>
          <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Color</label>
          <div className="flex flex-wrap gap-3 mb-5">
            {CATEGORY_COLORS.map((color) => (
              <button key={color} type="button" onClick={() => setNewColor(color)}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-transform ${newColor === color ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-neutral-100 scale-110' : 'hover:scale-110'}`} style={{ backgroundColor: color }}>
                {newColor === color && <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {newError && <p className="text-xs text-danger-600 flex-1">{newError}</p>}
            <button type="button" onClick={async () => {
              if (!newName.trim() || !newIcon) return;
              setNewError(''); setCreating(true);
              try {
                await addGroupCategory(groupId, { name: newName.trim(), icon: newIcon, color: newColor });
                const updated = useGroupStore.getState().currentGroup;
                const created = updated?.groupCategories?.find((c) => c.name === newName.trim());
                if (created) onChange(created.id);
                setShowNew(false); resetNew(); setOpen(false);
              } catch (err) { setNewError(err instanceof Error ? err.message : 'Failed to create category'); }
              finally { setCreating(false); }
            }} disabled={creating || !newName.trim() || !newIcon} className="btn-primary text-sm">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowNew(false); resetNew(); }} className="btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
