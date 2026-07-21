import { useState, useEffect, useRef } from 'react';
import { usePersonalStore } from '../../stores/personalStore';
import type { Category } from '../../lib/personalSync';

const CATEGORY_ICONS = ['🍕', '🚗', '🏠', '🎬', '🛍️', '💡', '📝', '💊', '🎓', '✈️', '🐾', '🎁', '💻', '🏋️', '☕', '🎵', '👕', '📱', '🏥', '📦'];
const CATEGORY_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

interface CategoryPickerProps {
  value: string;
  categories: Category[];
  error?: string;
  onChange: (categoryId: string) => void;
}

export default function CategoryPicker({ value, categories, error, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [newError, setNewError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = categories.find((c) => c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNew(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleCreate() {
    if (!newName.trim() || !newIcon) return;
    setNewError('');
    setCreating(true);
    try {
      await usePersonalStore.getState().addCategory({
        name: newName.trim(),
        icon: newIcon,
        color: newColor,
      });
      const updated = usePersonalStore.getState().categories;
      const created = updated.find((c) => c.name === newName.trim());
      if (created) onChange(created.id);
      setShowNew(false);
      setNewName('');
      setNewIcon('');
      setNewColor(CATEGORY_COLORS[0]);
      setNewError('');
      setOpen(false);
    } catch (err) {
      setNewError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Category <span className="text-danger-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowNew(false); }}
        className={`input-field w-full text-left flex items-center gap-2 mt-1 ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
      >
        {selected ? (
          <><span>{selected.icon}</span><span>{selected.name}</span></>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">Select a category</span>
        )}
        <span className="ml-auto text-neutral-400">▾</span>
      </button>

      {open && !showNew && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800 max-h-64 overflow-y-auto">
          {categories.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-neutral-400">No categories yet</div>
          )}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center px-3 py-2.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 cursor-pointer"
              onClick={() => { onChange(cat.id); setOpen(false); }}
            >
              <span className="flex items-center gap-2 flex-1 min-w-0">
                <span>{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                {value === cat.id && <span className="text-primary-600">✓</span>}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation();
                    if (confirm(`Delete category "${cat.name}"?`)) {
                      usePersonalStore.getState().deleteCategory(cat.id).catch(() => {});
                    }
                  }}
                  className="ml-1 text-neutral-300 hover:text-danger-500 dark:text-neutral-600 dark:hover:text-danger-400 text-sm px-1"
                  title="Delete category"
                >✕</button>
              </span>
            </div>
          ))}
          <div className="border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowNew(true); }}
              className="w-full px-3 py-2.5 text-left text-sm text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20 flex items-center gap-2 font-medium"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add new category</span>
            </button>
          </div>
        </div>
      )}

      {open && showNew && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg p-4 dark:border-neutral-700 dark:bg-neutral-800">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">New Category</h4>

          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Groceries"
            className="input-field mb-3 text-sm"
            autoFocus
          />

          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Icon</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CATEGORY_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setNewIcon(icon)}
                className={`h-8 w-8 flex items-center justify-center rounded-md text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 ${newIcon === icon ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20' : ''}`}
              >
                {icon}
              </button>
            ))}
          </div>

          <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Color</label>
          <div className="flex flex-wrap gap-2.5 mb-4">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewColor(color)}
                className={`h-7 w-7 rounded-full flex items-center justify-center ${newColor === color ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-neutral-100' : ''}`}
                style={{ backgroundColor: color }}
              >
                {newColor === color && <span className="text-white text-xs leading-none" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>✓</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {newError && <p className="text-xs text-danger-600 flex-1">{newError}</p>}
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newIcon}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => { setShowNew(false); setNewName(''); setNewIcon(''); setNewColor(CATEGORY_COLORS[0]); setNewError(''); }}
              className="btn-ghost text-sm px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
