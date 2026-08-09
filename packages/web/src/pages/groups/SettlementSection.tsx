import { useState } from 'react';
import { formatCurrency, SettlementStatus } from '@coldfi/shared';

interface Member {
  userId: string;
  displayName: string;
  email?: string;
}

interface SettlementData {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: SettlementStatus;
  proposedAt?: string;
  createdAt: string;
}

interface SettlementSectionProps {
  settlements: SettlementData[];
  overdueSettlements: SettlementData[];
  members: Member[];
  currentUserId: string;
  defaultCurrency: string;
  actionMsg: { text: string; isError: boolean } | null;
  onMarkPaid: (id: string) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
}

function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 8);
}

function OverdueAlert({ overdueSettlements, members, defaultCurrency }: {
  overdueSettlements: SettlementData[]; members: Member[]; defaultCurrency: string;
}) {
  if (overdueSettlements.length === 0) return null;

  return (
    <div className="card p-4 border-2 border-danger-200 dark:border-danger-800 bg-danger-50/50 dark:bg-danger-900/10">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-100 dark:bg-danger-900/30">
          <svg className="h-4 w-4 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-danger-700 dark:text-danger-300">
            {overdueSettlements.length} overdue settlement{overdueSettlements.length !== 1 ? 's' : ''} (7+ days)
          </p>
          <p className="text-xs text-danger-600/70 dark:text-danger-400/70 mt-0.5">
            {overdueSettlements.map((s) =>
              `${memberName(members, s.fromUserId)} → ${memberName(members, s.toUserId)}: ${formatCurrency(s.amount, defaultCurrency)}`
            ).join(', ')}
          </p>
        </div>
      </div>
    </div>
  );
}

function SettlementList({ settlements, members, currentUserId, defaultCurrency, actionMsg, onMarkPaid, onAccept, onReject, onCancel }: SettlementSectionProps) {
  const [showAll, setShowAll] = useState(false);
  if (!settlements || settlements.length === 0) return null;

  const sorted = [...settlements].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const displayed = showAll ? sorted : sorted.slice(0, 10);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Settlements ({settlements.length})</h3>
        {sorted.length > 10 && (
          <button onClick={() => setShowAll(!showAll)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            {showAll ? 'Show less' : `Show all (${sorted.length})`}
          </button>
        )}
      </div>
      {actionMsg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${
          actionMsg.isError ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/20 dark:text-danger-300' :
          'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
        }`}>{actionMsg.text}</div>
      )}
      <div className="space-y-1 divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {displayed.map((s: any) => {
          const isDebtor = s.fromUserId === currentUserId;
          const isCreditor = s.toUserId === currentUserId;
          return (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                  s.status === SettlementStatus.APPROVED ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300' :
                  s.status === SettlementStatus.PROPOSED ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300' :
                  s.status === SettlementStatus.MARKED_PAID ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  'bg-neutral-100 dark:bg-neutral-700/60 text-neutral-500 dark:text-neutral-400'
                }`}>{s.status.replace(/_/g, ' ')}</span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate">
                  {memberName(members, s.fromUserId)}
                  <span className="text-neutral-300 dark:text-neutral-600 mx-1">→</span>
                  {memberName(members, s.toUserId)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-sm font-bold text-neutral-900 dark:text-white">
                  {formatCurrency(s.amount, defaultCurrency)}
                </span>
                {s.status === SettlementStatus.PROPOSED && isDebtor && (
                  <>
                    <button onClick={() => onMarkPaid(s.id)} className="btn-primary text-xs px-2.5 py-1">Mark Paid</button>
                    <button onClick={() => onCancel(s.id)} className="btn-ghost text-xs px-2 py-1 text-danger-600 hover:text-danger-700">Cancel</button>
                  </>
                )}
                {s.status === SettlementStatus.MARKED_PAID && isCreditor && (
                  <>
                    <button onClick={() => onAccept(s.id)} className="btn-primary text-xs px-2.5 py-1">Accept</button>
                    <button onClick={() => onReject(s.id)} className="btn-ghost text-xs px-2 py-1 text-danger-600 hover:text-danger-700">Reject</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SettlementSection(props: SettlementSectionProps) {
  return (
    <>
      <OverdueAlert overdueSettlements={props.overdueSettlements} members={props.members} defaultCurrency={props.defaultCurrency} />
      <SettlementList {...props} />
    </>
  );
}
