import { formatCurrency } from '@coldfi/shared';

interface MonthlyData {
  month: string;
  total: number;
  count: number;
}

interface GroupMonthlyTrendProps {
  monthlyTrend: MonthlyData[];
  defaultCurrency: string;
}

export default function GroupMonthlyTrend({ monthlyTrend, defaultCurrency }: GroupMonthlyTrendProps) {
  if (monthlyTrend.length === 0) return null;

  const maxTotal = Math.max(...monthlyTrend.map((m) => m.total), 1);

  return (
    <div className="card p-5">
      <h3 className="section-title mb-4">Monthly Spending</h3>
      <div className="space-y-2">
        {monthlyTrend.slice(-6).map((m) => (
          <div key={m.month} className="flex items-center gap-4">
            <span className="text-xs text-neutral-500 w-16 shrink-0">{m.month}</span>
            <div className="flex-1 h-6 rounded bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
              <div
                className="h-full rounded bg-primary-500 flex items-center justify-end pr-2 text-xs text-white font-medium"
                style={{ width: `${(m.total / maxTotal) * 100}%` }}
              >
                {formatCurrency(m.total, defaultCurrency)}
              </div>
            </div>
            <span className="text-xs text-neutral-400 w-8 text-right">{m.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
