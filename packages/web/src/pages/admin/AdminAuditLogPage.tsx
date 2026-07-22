import { useEffect, useState } from 'react';
import { useAdminConfigStore } from '../../stores/adminConfigStore';

export default function AdminAuditLogPage() {
  const { auditLog, fetchAuditLog } = useAdminConfigStore();
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchAuditLog({ action: actionFilter || undefined, page: String(page) });
  }, [fetchAuditLog, page]);

  function handleFilter() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Admin Audit Log</h1>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Filter by action..."
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
        <button onClick={handleFilter} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">
          Filter
        </button>
      </div>

      {auditLog && (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">Time</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.logs?.map((log: any) => (
                  <tr key={log.id} className="border-b border-neutral-100">
                    <td className="p-3 text-xs text-neutral-500 whitespace-nowrap">{new Date(log.created_at || log.createdAt).toLocaleString()}</td>
                    <td className="p-3">
                      <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">{log.action}</span>
                    </td>
                    <td className="p-3 text-xs font-mono text-neutral-600">{log.actor_id?.slice(0, 8) || '-'}</td>
                    <td className="p-3 text-xs">{log.target_type ? `${log.target_type}:${log.target_id?.slice(0, 8)}` : '-'}</td>
                    <td className="p-3 text-xs font-mono text-neutral-500">{log.ip_address || '-'}</td>
                    <td className="p-3 text-xs text-neutral-500 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {auditLog.pagination && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-500">Total: {auditLog.pagination.total}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
                <button disabled={page * 50 >= auditLog.pagination.total} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
