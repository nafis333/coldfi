import { useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminMonitoringPage() {
  const { endpoints, errors, slowQueries, dbHealth, redisStats, fetchEndpoints, fetchErrors, fetchSlowQueries, fetchDbHealth, fetchRedisStats } = useAdminStore();

  useEffect(() => {
    fetchEndpoints();
    fetchErrors();
    fetchSlowQueries();
    fetchDbHealth();
    fetchRedisStats();
  }, [fetchEndpoints, fetchErrors, fetchSlowQueries, fetchDbHealth, fetchRedisStats]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Monitoring</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Database Health</h2>
          {dbHealth ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-neutral-500">Active Connections:</span>
                <p className="font-medium">{dbHealth.activeConnections}</p>
              </div>
              <div>
                <span className="text-neutral-500">Total Connections:</span>
                <p className="font-medium">{dbHealth.totalConnections}</p>
              </div>
              <div>
                <span className="text-neutral-500">Waiting:</span>
                <p className="font-medium">{dbHealth.waitingCount}</p>
              </div>
              <div>
                <span className="text-neutral-500">DB Size:</span>
                <p className="font-medium">{dbHealth.totalDbSizeMb} MB</p>
              </div>
              <div className="col-span-2">
                <span className="text-neutral-500">Cache Hit Ratio:</span>
                <p className="font-medium">{(dbHealth.cacheHitRatio * 100).toFixed(1)}%</p>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">Loading...</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Redis Stats</h2>
          {redisStats ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-neutral-500">Memory:</span>
                <p className="font-medium">{redisStats.usedMemoryMb} MB</p>
              </div>
              <div>
                <span className="text-neutral-500">Clients:</span>
                <p className="font-medium">{redisStats.connectedClients}</p>
              </div>
              <div>
                <span className="text-neutral-500">Hit Rate:</span>
                <p className="font-medium">{redisStats.hitRate}%</p>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">Loading...</p>
          )}
        </div>
      </div>

      {errors && errors.spikes?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-lg font-medium text-red-800 mb-2">Error Spikes Detected</h2>
          <div className="space-y-1">
            {errors.spikes.map((s: any) => (
              <div key={s.hour} className="text-sm text-red-700">
                {new Date(s.hour).toLocaleString()} — {s.errorRate}% error rate
              </div>
            ))}
          </div>
        </div>
      )}

      {slowQueries.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Slow Queries (&gt;500ms)</h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">Query</th>
                  <th className="p-3 text-right">Duration</th>
                  <th className="p-3">Caller</th>
                  <th className="p-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {slowQueries.map((q: any) => (
                  <tr key={q.id} className="border-b border-neutral-100">
                    <td className="p-3 font-mono text-xs max-w-md truncate">{q.queryText}</td>
                    <td className="p-3 text-right font-medium text-red-600">{q.durationMs}ms</td>
                    <td className="p-3 text-neutral-600">{q.caller}</td>
                    <td className="p-3 text-neutral-500 text-xs">{new Date(q.occurredAt).toLocaleString()}</td>
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
