import { formatCurrency } from '@coldfi/shared';

interface ActivityEntry {
  type: string;
  id: string;
  actorName: string;
  description: string;
  date: string;
  amount: number;
}

interface GroupRecentActivityProps {
  recentActivity: ActivityEntry[];
  defaultCurrency: string;
}

export default function GroupRecentActivity({ recentActivity, defaultCurrency }: GroupRecentActivityProps) {
  if (recentActivity.length === 0) return null;

  return (
    <div className="card p-5">
      <h3 className="section-title mb-4">Recent Activity</h3>
      <div className="space-y-2">
        {recentActivity.slice(0, 5).map((entry) => (
          <div key={`${entry.type}-${entry.id}`} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                {entry.actorName && <span className="font-medium">{entry.actorName}</span>}
                {' '}{entry.description}
              </p>
              <p className="text-xs text-neutral-400">{new Date(entry.date).toLocaleDateString()}</p>
            </div>
            <span className="text-sm font-semibold text-neutral-900 dark:text-white shrink-0 ml-3">
              {formatCurrency(entry.amount, defaultCurrency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
