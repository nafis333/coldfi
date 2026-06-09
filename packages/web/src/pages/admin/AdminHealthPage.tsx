import { useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminHealthPage() {
  const { health, healthHistory, fetchHealth, fetchHealthHistory } = useAdminStore();

  useEffect(() => {
    fetchHealth();
    fetchHealthHistory();
  }, [fetchHealth, fetchHealthHistory]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok': return 'text-green-600 bg-green-50';
      case 'degraded':
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error':
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-neutral-600 bg-neutral-50';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">System Health</h1>

      {health && (
        <>
          <div className={`rounded-lg p-4 ${statusColor(health.status)}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                health.status === 'healthy' ? 'bg-green-500' :
                health.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-lg font-semibold capitalize">{health.status}</span>
              <span className="text-sm opacity-75">Uptime: {Math.floor(health.uptime / 60)}m</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(health.checks || {}).map(([name, check]: [string, any]) => (
              <div key={name} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-neutral-900 capitalize">{name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                {name === 'database' && (
                  <div className="text-xs text-neutral-600 space-y-1">
                    <p>Active: {check.activeConnections}</p>
                    <p>Total: {check.totalConnections}</p>
                    <p>Waiting: {check.waitingCount}</p>
                    <p>Size: {check.totalDbSizeMb} MB</p>
                  </div>
                )}
                {name === 'redis' && (
                  <div className="text-xs text-neutral-600 space-y-1">
                    <p>Memory: {check.usedMemoryMb} MB</p>
                    <p>Clients: {check.connectedClients}</p>
                    <p>Hit Rate: {check.hitRate}%</p>
                  </div>
                )}
                {name === 'memory' && (
                  <div className="text-xs text-neutral-600 space-y-1">
                    <p>Usage: {check.usedPercent}%</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {healthHistory.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Health History (24h)</h2>
          <div className="bg-white rounded-lg shadow-sm max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 sticky top-0 bg-white">
                  <th className="p-3">Time</th>
                  <th className="p-3 text-right">Connections</th>
                  <th className="p-3 text-right">Table Size (MB)</th>
                  <th className="p-3 text-right">Cache Hit</th>
                </tr>
              </thead>
              <tbody>
                {healthHistory.map((h: any) => (
                  <tr key={h.id} className="border-b border-neutral-100">
                    <td className="p-3 text-xs text-neutral-500">{new Date(h.snapshot_at).toLocaleString()}</td>
                    <td className="p-3 text-right">{h.total_connections ?? '-'}</td>
                    <td className="p-3 text-right">{h.total_table_size_mb ?? '-'}</td>
                    <td className="p-3 text-right">{h.cache_hit_ratio != null ? (h.cache_hit_ratio * 100).toFixed(1) + '%' : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
