type Period = '7d' | '1m' | '3m' | '6m' | '1y';
type Source = 'personal' | 'groups' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7D' }, { value: '1m', label: '1M' },
  { value: '3m', label: '3M' }, { value: '6m', label: '6M' }, { value: '1y', label: '1Y' },
];

const SOURCE_OPTIONS: { value: Source; label: string }[] = [
  { value: 'personal', label: 'Personal' }, { value: 'groups', label: 'Groups' }, { value: 'all', label: 'All' },
];

export type { Period, Source };

interface FilterBarProps {
  source: Source;
  period: Period;
  onSourceChange: (source: Source) => void;
  onPeriodChange: (period: Period) => void;
}

export default function FilterBar({ source, period, onSourceChange, onPeriodChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-700 p-1 gap-0.5">
        {SOURCE_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => onSourceChange(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${
              source === opt.value
                ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
      <div className="inline-flex rounded-xl bg-neutral-100 dark:bg-neutral-700 p-1 gap-0.5">
        {PERIOD_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => onPeriodChange(opt.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${
              period === opt.value
                ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
            }`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
