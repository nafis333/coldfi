import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency, getCurrencySymbol } from '@coldfi/shared';

interface DailySpendingChartProps {
  barData: { label: string; amount: number }[];
  maxBarValue: number;
  isEmpty: boolean;
  period: string;
  defaultCurrency: string;
}

export default function DailySpendingChart({ barData, maxBarValue, isEmpty, period, defaultCurrency }: DailySpendingChartProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-white">
        {period === '1y' || period === '6m' || period === '3m' ? 'Monthly' : 'Daily'} Spending Trend
      </h3>
      {isEmpty ? (
        <div className="flex h-56 items-center justify-center">
          <p className="text-sm text-neutral-400 dark:text-neutral-500">No data for this period</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:opacity-20" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${getCurrencySymbol(defaultCurrency)}${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v < 1 ? '' : v}`} />
            <ReTooltip
              contentStyle={{ background: '#1F2937', border: 'none', borderRadius: 8, color: '#F9FAFB', fontSize: 12 }}
              formatter={(value: number) => [formatCurrency(value, defaultCurrency), 'Spent']}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {barData.map((_, i) => (
                <Cell key={i} fill={barData[i].amount === maxBarValue ? '#6366F1' : '#A5B4FC'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
