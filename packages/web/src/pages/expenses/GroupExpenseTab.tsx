import { Link } from 'react-router-dom';
import { formatCurrency } from '@coldfi/shared';
import type { GroupSummary, GroupDetail } from '../../lib/groupSync';

interface GroupExpenseTabProps {
  groups: GroupSummary[];
  groupsLoading: boolean;
  currentGroup: GroupDetail | null;
  defaultCurrency: string;
  onNavigate: (path: string) => void;
}

export default function GroupExpenseTab({
  groups, groupsLoading, currentGroup, defaultCurrency, onNavigate,
}: GroupExpenseTabProps) {
  if (groupsLoading && groups.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
          <svg className="h-7 w-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
        </div>
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">No groups yet</p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Join or create a group to see group expenses here</p>
        <Link to="/groups" className="btn-primary mt-5 inline-flex">Browse Groups</Link>
      </div>
    );
  }

  const totalOwed = groups.filter(g => g.yourBalance > 0).reduce((s, g) => s + g.yourBalance, 0);
  const totalOwe = groups.filter(g => g.yourBalance < 0).reduce((s, g) => s + Math.abs(g.yourBalance), 0);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary-50 dark:bg-primary-900/20 rounded-bl-full" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Groups</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-white">{groups.length}</p>
          </div>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-success-50 dark:bg-success-900/20 rounded-bl-full" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">You&apos;re Owed</p>
            <p className="mt-1 text-2xl font-bold text-success-600 dark:text-success-400">
              {formatCurrency(totalOwed, defaultCurrency)}
            </p>
          </div>
        </div>
        <div className="card p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-danger-50 dark:bg-danger-900/20 rounded-bl-full" />
          <div className="relative">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">You Owe</p>
            <p className="mt-1 text-2xl font-bold text-danger-600 dark:text-danger-400">
              {formatCurrency(totalOwe, defaultCurrency)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.id} className="card card-hover p-4 cursor-pointer transition-all duration-200" onClick={() => onNavigate(`/groups/${group.id}`)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 text-sm font-bold text-white shadow-sm">
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{group.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{group.memberCount} member{group.memberCount !== 1 ? 's' : ''}</p>
                  {currentGroup?.id === group.id && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                      {currentGroup.expenses.length} expense{currentGroup.expenses.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className={`text-sm font-bold ${group.yourBalance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                  {group.yourBalance >= 0 ? '+' : ''}{formatCurrency(group.yourBalance, defaultCurrency)}
                </p>
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">your balance</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
