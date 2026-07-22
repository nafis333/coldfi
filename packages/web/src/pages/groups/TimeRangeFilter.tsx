import { useState } from 'react';

const DEFAULT_PRESETS = [
  { label: '7d', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'All', days: 0 },
] as const;

interface TimeRangeFilterProps {
  rangeDays: number;
  showCustom: boolean;
  onPreset: (days: number) => void;
  onCustomStart: (value: string) => void;
  onCustomEnd: (value: string) => void;
  onApplyCustom?: () => void;
  onToggleCustom: () => void;
  presets?: readonly { label: string; days: number }[];
  compact?: boolean;
}

export default function TimeRangeFilter({
  rangeDays, showCustom, onPreset, onCustomStart, onCustomEnd, onApplyCustom, onToggleCustom,
  presets = DEFAULT_PRESETS, compact = false,
}: TimeRangeFilterProps) {
  const [customKey, setCustomKey] = useState(0);

  function handleToggleCustom() {
    setCustomKey((k) => k + 1);
    onToggleCustom();
  }

  if (compact) {
    return (
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((r) => (
            <button key={r.label} onClick={() => onPreset(r.days)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !showCustom && rangeDays === r.days
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}>
              {r.label}
            </button>
          ))}
          <button onClick={handleToggleCustom}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              showCustom
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}>
            Custom
          </button>
          {showCustom && (
            <div key={customKey} className="flex items-center gap-2 ml-1">
              <input type="date" onChange={(e) => onCustomStart(e.target.value)} className="input text-xs py-1 px-2 w-32" />
              <span className="text-xs text-neutral-400">to</span>
              <input type="date" onChange={(e) => onCustomEnd(e.target.value)} className="input text-xs py-1 px-2 w-32" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mr-1">Period</span>
        <div className="flex gap-1 p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-700/60">
          {presets.map((r) => (
            <button
              key={r.label}
              onClick={() => onPreset(r.days)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
                !showCustom && rangeDays === r.days
                  ? 'bg-white dark:bg-neutral-600 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleToggleCustom}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-all ${
            showCustom
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/60'
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div key={customKey} className="mt-3 flex items-center gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-700/50">
          <input type="date" onChange={(e) => onCustomStart(e.target.value)}
            className="input-field text-sm flex-1" />
          <span className="text-neutral-300 dark:text-neutral-600">→</span>
          <input type="date" onChange={(e) => onCustomEnd(e.target.value)}
            className="input-field text-sm flex-1" />
        </div>
      )}
    </div>
  );
}
