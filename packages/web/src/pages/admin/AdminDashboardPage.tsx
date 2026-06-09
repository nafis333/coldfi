import { useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminDashboardPage() {
  const { stats, endpoints, fetchStats, fetchEndpoints, loading } = useAdminStore();

  useEffect(() => {
    fetchStats();
    fetchEndpoints();
  }, [fetchStats, fetchEndpoints]);

  if (loading && !stats) {
    return <div className="text-neutral-500">Loading stats...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="Total Groups" value={stats.totalGroups} />
          <StatCard label="Active (24h)" value={stats.activeUsers24h} />
          <StatCard label="Active (7d)" value={stats.activeUsers7d} />
          <StatCard label="Active (30d)" value={stats.activeUsers30d} />
          <StatCard label="Active (90d)" value={stats.activeUsers90d} />
          <StatCard label="Registrations/day" value={stats.regRateDaily} />
          <StatCard label="Storage" value={formatBytes(stats.totalBlobSizeBytes)} />
        </div>
      )}

      {endpoints.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Endpoint Metrics (24h)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="pb-2 pr-4">Endpoint</th>
                  <th className="pb-2 pr-4">Method</th>
                  <th className="pb-2 pr-4 text-right">Calls</th>
                  <th className="pb-2 pr-4 text-right">Errors</th>
                  <th className="pb-2 pr-4 text-right">Error Rate</th>
                  <th className="pb-2 pr-4 text-right">p50</th>
                  <th className="pb-2 pr-4 text-right">p99</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.slice(0, 10).map((ep: any) => (
                  <tr key={`${ep.method}-${ep.endpoint}`} className="border-b border-neutral-100">
                    <td className="py-2 pr-4 font-mono text-xs">{ep.endpoint}</td>
                    <td className="py-2 pr-4">{ep.method}</td>
                    <td className="py-2 pr-4 text-right">{ep.totalCalls.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right">{ep.errorCount}</td>
                    <td className={`py-2 pr-4 text-right ${ep.errorRate > 5 ? 'text-red-600' : ''}`}>{ep.errorRate}%</td>
                    <td className="py-2 pr-4 text-right">{ep.p50}ms</td>
                    <td className="py-2 pr-4 text-right">{ep.p99}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats?.topGroups?.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Top Groups</h2>
          <div className="space-y-2">
            {stats.topGroups.map((g: any) => (
              <div key={g.groupId} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
                <span className="font-medium text-neutral-900">{g.name}</span>
                <span className="text-sm text-neutral-500">{g.memberCount} members</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value ?? '-'}</p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
