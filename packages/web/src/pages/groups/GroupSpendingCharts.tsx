import { formatCurrency } from '@coldfi/shared';

interface CategoryBreakdownItem {
  name: string;
  icon: string;
  total: number;
  percentage: number;
}

interface MemberSpendingItem {
  userId: string;
  displayName: string;
  totalPaid: number;
  percentage: number;
}

interface GroupSpendingChartsProps {
  categoryBreakdown: CategoryBreakdownItem[];
  memberSpending: MemberSpendingItem[];
  defaultCurrency: string;
}

function SpendingByCategory({ items, defaultCurrency }: { items: CategoryBreakdownItem[]; defaultCurrency: string }) {
  if (items.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="section-title mb-4">Spending by Category</h3>
      <div className="space-y-3">
        {items.slice(0, 8).map((cat) => (
          <div key={cat.name}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-neutral-700 dark:text-neutral-300">{cat.icon} {cat.name}</span>
              <span className="font-medium text-neutral-900 dark:text-white">{formatCurrency(cat.total, defaultCurrency)} ({cat.percentage}%)</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(cat.percentage, 100)}%` }} />
            </div>
          </div>
        ))}
        {items.length > 8 && (
          <p className="text-xs text-neutral-400 text-center pt-2">+{items.length - 8} more categories</p>
        )}
      </div>
    </div>
  );
}

function PerMemberSpending({ items, defaultCurrency }: { items: MemberSpendingItem[]; defaultCurrency: string }) {
  if (items.length === 0) return null;
  return (
    <div className="card p-5">
      <h3 className="section-title mb-4">Per-Member Spending</h3>
      <div className="space-y-3">
        {items.map((m) => (
          <div key={m.userId}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-neutral-900 dark:text-white">{m.displayName}</span>
              <span className="text-neutral-700 dark:text-neutral-300">{formatCurrency(m.totalPaid, defaultCurrency)} ({m.percentage}%)</span>
            </div>
            <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
              <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(m.percentage, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GroupSpendingCharts(props: GroupSpendingChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SpendingByCategory items={props.categoryBreakdown} defaultCurrency={props.defaultCurrency} />
      <PerMemberSpending items={props.memberSpending} defaultCurrency={props.defaultCurrency} />
    </div>
  );
}
