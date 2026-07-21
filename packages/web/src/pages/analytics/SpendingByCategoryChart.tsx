import { PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@coldfi/shared';

const CHART_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#06B6D4', '#3B82F6', '#A855F7', '#D946EF',
];

interface SpendingByCategoryChartProps {
  pieData: { name: string; value: number; fill: string; categoryId: string }[];
  totalSpent: number;
  isEmpty: boolean;
  defaultCurrency: string;
}

export default function SpendingByCategoryChart({ pieData, totalSpent, isEmpty, defaultCurrency }: SpendingByCategoryChartProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">Spending by Category</h3>
      {isEmpty ? (
        <div className="flex h-56 items-center justify-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No data for this period</p>
        </div>
      ) : pieData.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="shrink-0">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={80} innerRadius={50} paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <ReTooltip
                  contentStyle={{ background: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB', fontSize: 12 }}
                  formatter={(value: number) => [formatCurrency(value, defaultCurrency), 'Spent']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 w-full space-y-2">
            {pieData.slice(0, 6).map((item) => {
              const pct = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.categoryId} className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.fill || CHART_COLORS[0] }} />
                  <span className="flex-1 text-xs text-neutral-700 dark:text-neutral-300 truncate">{item.name}</span>
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 w-10 text-right">{pct}%</span>
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white w-20 text-right">{formatCurrency(item.value, defaultCurrency)}</span>
                </div>
              );
            })}
            {pieData.length > 6 && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center pt-1">
                +{pieData.length - 6} more categor{pieData.length - 6 === 1 ? 'y' : 'ies'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
