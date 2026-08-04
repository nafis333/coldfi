import { formatCurrency } from '@coldfi/shared';
import type { OverviewData } from '../../hooks/useOverview';

export default function SpendingTrendChart({ data }: { data: OverviewData }) {
  const { dailySpending, maxDaily, defaultCurrency } = data;

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const weekTotal = dailySpending.reduce((s, d) => s + d.total, 0);

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="section-title">Last 7 Days</h3>
        <span className="text-xs text-neutral-400 dark:text-neutral-500">
          {formatCurrency(weekTotal, defaultCurrency)} total
        </span>
      </div>
      <div className="flex items-end gap-2" style={{ height: 140 }}>
        {dailySpending.map((day) => {
          const barHeight = maxDaily > 0 ? (day.total / maxDaily) * 100 : 0;
          const isToday = day.date === todayStr;
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">
                {day.total > 0 ? formatCurrency(day.total, defaultCurrency) : ''}
              </span>
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${
                    day.total > 0
                      ? isToday
                        ? 'bg-gradient-to-t from-primary-600 to-primary-400'
                        : 'bg-gradient-to-t from-primary-400/80 to-primary-300/60 dark:from-primary-600/60 dark:to-primary-500/40'
                      : 'bg-neutral-200 dark:bg-neutral-700'
                  }`}
                  style={{ height: `${Math.max(barHeight, 4)}%` }}
                />
              </div>
              <span className={`text-[10px] font-semibold ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 dark:text-neutral-500'}`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
