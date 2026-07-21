import { useState, useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useGroupStore } from '../../stores/groupStore';
import { formatCurrency } from '@coldfi/shared';
import { downloadReceiptPDF, type ReceiptData } from '../../lib/receiptPDF';
import TimeRangeFilter from './TimeRangeFilter';

interface GroupExpenseData {
  id: string;
  amount: number;
  description: string;
  category: string;
  payerId: string;
  date: string;
  createdAt: string;
  displayId?: string;
  splits: { userId: string; amount: number }[];
  itemizedItems?: { name: string; amount: number; assignedTo: string[] }[];
}

interface Member {
  userId: string;
  displayName: string;
  email?: string;
}

interface GroupCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface GroupData {
  expenses: GroupExpenseData[];
  members: Member[];
  groupCategories?: GroupCategory[];
  defaultCurrency?: string;
}

interface TabContext {
  groupId: string;
  group: GroupData;
  currentUserId: string;
}

function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 8);
}

function timeAgo(timestamp: string): string {
  const ts = new Date(timestamp).getTime();
  if (isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US');
}

export default function ExpensesTab() {
  const { groupId, group } = useOutletContext<TabContext>();
  const [showAll, setShowAll] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const currentUserId = useAuthStore((s) => s.userId);
  const groupMembers = useGroupStore((s) => s.currentGroup?.members || []);

  const defaultCurrency = group.defaultCurrency || useAuthStore((s) => s.defaultCurrency);
  const categoryMap = useMemo(() => {
    const map: Record<string, GroupCategory> = {};
    for (const cat of group.groupCategories || []) map[cat.id] = cat;
    return map;
  }, [group.groupCategories]);

  function handleDownloadReceipt(expense: GroupExpenseData) {
    const mySplit = expense.splits.find((s) => s.userId === currentUserId);
    const items = expense.itemizedItems?.map((i) => ({ name: i.name, amount: i.amount })) || [];
    const splits = expense.splits.map((s) => ({
      name: memberName(groupMembers.length > 0 ? groupMembers : group.members, s.userId),
      amount: s.amount,
    }));
    const receiptData: ReceiptData = {
      type: 'group',
      receiptNumber: expense.displayId || expense.id.slice(0, 8).toUpperCase(),
      date: expense.date || expense.createdAt,
      description: expense.description,
      category: categoryMap[expense.category]?.name || expense.category,
      currency: defaultCurrency,
      paidBy: expense.payerId,
      paidByDisplay: memberName(groupMembers.length > 0 ? groupMembers : group.members, expense.payerId),
      totalAmount: expense.amount,
      yourShare: mySplit?.amount,
      items: items.length > 0 ? items : undefined,
      splits,
    };
    downloadReceiptPDF(receiptData);
  }

  const allExpenses = (group.expenses ?? [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const expenses = useMemo(() => {
    const cutoff = rangeDays > 0 ? Date.now() - rangeDays * 86400000 : 0;
    const customStartMs = customStart ? new Date(customStart).getTime() : 0;
    const customEndMs = customEnd ? new Date(customEnd + 'T23:59:59').getTime() : Infinity;

    return allExpenses.filter((e) => {
      const d = new Date(e.date || e.createdAt).getTime();
      if (rangeDays > 0 && d < cutoff) return false;
      if (customStart && d < customStartMs) return false;
      if (customEnd && d > customEndMs) return false;
      return true;
    });
  }, [allExpenses, rangeDays, customStart, customEnd]);

  const displayed = showAll ? expenses : expenses.slice(0, 10);

  return (
    <div className="space-y-3">
      {allExpenses.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/50 mb-3">
            <svg className="h-7 w-7 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">No expenses yet</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            <Link to={`/groups/${groupId}/expenses/new`} className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              Add the first expense
            </Link>
          </p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No expenses match the selected time range.</p>
        </div>
      ) : (
        <>
          <TimeRangeFilter
            rangeDays={rangeDays} showCustom={showCustom}
            onPreset={(d) => { setRangeDays(d); setShowCustom(false); setCustomStart(''); setCustomEnd(''); }}
            onCustomStart={(v) => { setCustomStart(v); setRangeDays(0); }}
            onCustomEnd={(v) => { setCustomEnd(v); setRangeDays(0); }}
            onToggleCustom={() => setShowCustom(!showCustom)}
            compact
          />
          <div className="space-y-2">
            {displayed.map((expense) => {
              const items = expense.itemizedItems;
              const hasItems = items && items.length > 0;
              const isExpanded = expandedId === expense.id;

              return (
                <div key={expense.id} className="card overflow-hidden transition-all duration-200">
                  <div className="card-hover flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : expense.id)}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                      style={{ backgroundColor: (categoryMap[expense.category]?.color || '#6366f1') + '25' }}>
                      {categoryMap[expense.category]?.icon || (
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-300">
                          {expense.description?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{expense.description}</p>
                        {expense.displayId && (
                          <span className="shrink-0 text-[10px] font-mono font-semibold text-primary-500 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-1.5 py-0.5 rounded">{expense.displayId}</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <span className="font-medium">{memberName(group.members, expense.payerId)}</span>
                        <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
                        {timeAgo(expense.createdAt)}
                        {expense.splits && expense.splits.length > 0 && (
                          <><span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>{expense.splits.length} split{expense.splits.length !== 1 ? 's' : ''}</>
                        )}
                        {hasItems && (
                          <><span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>{items!.length} item{items!.length !== 1 ? 's' : ''}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <p className="text-base font-bold text-neutral-900 dark:text-white">{formatCurrency(expense.amount, defaultCurrency)}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadReceipt(expense); }}
                        className="btn-ghost p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title="Download receipt"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                      {hasItems && (
                        <svg className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {isExpanded && hasItems && (
                    <div className="border-t border-neutral-100 dark:border-neutral-700/60 bg-neutral-50/60 dark:bg-neutral-800/30 animate-fade-in">
                      {items!.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm border-b border-neutral-100 dark:border-neutral-700/30 last:border-b-0">
                          <div className="flex-1 min-w-0">
                            <span className="text-neutral-700 dark:text-neutral-300">{item.name}</span>
                            <span className="ml-2 text-xs text-neutral-400">
                              ({item.assignedTo.length} participant{item.assignedTo.length !== 1 ? 's' : ''}: {item.assignedTo.map((id) => memberName(group.members, id)).join(', ')})
                            </span>
                          </div>
                          <span className="font-semibold text-neutral-900 dark:text-white shrink-0 ml-3">{formatCurrency(item.amount, defaultCurrency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {expenses.length > 10 && (
            <button onClick={() => setShowAll(!showAll)} className="w-full text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 py-3 transition-colors">
              {showAll ? 'Show less' : `Show all ${expenses.length} expenses`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
