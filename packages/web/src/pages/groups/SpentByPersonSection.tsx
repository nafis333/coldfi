import { formatCurrency } from '@coldfi/shared';

interface Member {
  userId: string;
  displayName: string;
  email?: string;
}

interface SpentByPersonSectionProps {
  members: Member[];
  spentByPerson: Record<string, number>;
  totalSpent: number;
  currentUserId: string;
  defaultCurrency: string;
}

export default function SpentByPersonSection({ members, spentByPerson, totalSpent, currentUserId, defaultCurrency }: SpentByPersonSectionProps) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Spent by Person</h3>
      <div className="space-y-3">
        {members.map((m) => {
          const spent = spentByPerson[m.userId] || 0;
          const pct = totalSpent > 0 ? (spent / totalSpent * 100) : 0;
          return (
            <div key={m.userId} className="flex items-center gap-3">
              <span className="text-sm text-neutral-700 dark:text-neutral-300 w-28 sm:w-36 truncate font-medium">
                {m.displayName || m.email}
                {m.userId === currentUserId && <span className="text-xs text-neutral-400 ml-1 font-normal">(you)</span>}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-700/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 dark:from-primary-600 dark:to-primary-500 transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white w-24 text-right shrink-0">
                {formatCurrency(spent, defaultCurrency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
