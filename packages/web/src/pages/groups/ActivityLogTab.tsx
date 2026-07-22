import { useEffect, useState, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { silentCatch } from '../../lib/errorHandler';
import { useLogStore } from '../../stores/logStore';

type ActionType = 'all' | 'expense' | 'member' | 'settings';

interface LogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  actionType: 'expense' | 'settlement' | 'member' | 'settings';
  details: string;
  hash: string;
  previousHash: string;
  isValid?: boolean;
}

interface TabContext {
  groupId: string;
}

const ACTION_FILTERS: { key: ActionType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'expense', label: 'Expenses' },
  { key: 'member', label: 'Members' },
  { key: 'settings', label: 'Settings' },
];

function LogEntryCard({ entry }: { entry: LogEntry }) {
  const isInvalid = entry.isValid === false;
  const time = new Date(entry.timestamp).toLocaleString();

  return (
    <div
      className={`rounded-xl border p-4 ${
        isInvalid ? 'border-danger-300 bg-danger-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="mb-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-neutral-900">{entry.actorName}</p>
            {isInvalid && (
              <span className="shrink-0 rounded bg-danger-100 px-2 py-0.5 text-xs font-bold text-danger-800">
                Tampered
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">{time}</p>
        </div>
      </div>
      <p className="mb-1 text-sm font-semibold text-neutral-700">{entry.action}</p>
      {entry.details && (
        <p className="mb-2 line-clamp-2 text-xs text-neutral-500">{entry.details}</p>
      )}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-neutral-400">Hash:</span>
        <code className="truncate text-[10px] text-neutral-400">{entry.hash.substring(0, 16)}...</code>
      </div>
    </div>
  );
}

export default function ActivityLogTab() {
  const { groupId } = useOutletContext<TabContext>();
  const { logs, fetchLogs, verifyIntegrity, isLoading } = useLogStore();

  const [activeFilter, setActiveFilter] = useState<ActionType>('all');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; totalChecked: number; brokenAt: number[] } | null>(null);

  useEffect(() => {
    fetchLogs(groupId);
  }, [groupId, fetchLogs]);

  const handleVerifyIntegrity = useCallback(async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyIntegrity(groupId);
      setVerifyResult(result);
    } catch (err) {
      silentCatch('ActivityLogTab.verify', err);
    } finally {
      setVerifying(false);
    }
  }, [groupId, verifyIntegrity]);

  const filteredLogs = useMemo(() => {
    if (activeFilter === 'all') return logs;
    return logs.filter((l: LogEntry) => l.actionType === activeFilter);
  }, [logs, activeFilter]);

  if (isLoading && logs.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Verify & Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handleVerifyIntegrity}
          disabled={verifying}
          className="flex items-center gap-1 rounded-lg border border-primary-600 px-3 py-1.5 text-xs font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-50"
        >
          {verifying && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
          )}
          Verify Integrity
        </button>
        {verifyResult && (
          <span
            className={`text-xs font-semibold ${
              verifyResult.valid ? 'text-success-600' : 'text-danger-600'
            }`}
          >
            {verifyResult.valid
              ? `OK ${verifyResult.totalChecked} entries OK`
              : `${verifyResult.brokenAt.length} issue(s)`}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              activeFilter === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log List */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg font-bold text-neutral-900">No Activity</p>
          <p className="text-sm text-neutral-500">
            {activeFilter === 'all'
              ? 'No activity recorded yet.'
              : `No ${activeFilter} activity found.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredLogs.map((entry: LogEntry) => (
            <LogEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
