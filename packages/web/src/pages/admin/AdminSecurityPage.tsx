import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminSecurityPage() {
  const { failedLogins, suspiciousIPs, rateLimitHits, securityScore, fetchFailedLogins, fetchSuspiciousIPs, fetchRateLimitHits, fetchSecurityScore, blockIP } = useAdminStore();
  const [ipToBlock, setIpToBlock] = useState('');
  const [blockingIP, setBlockingIP] = useState(false);
  const [blockError, setBlockError] = useState('');

  useEffect(() => {
    fetchFailedLogins();
    fetchSuspiciousIPs();
    fetchRateLimitHits();
    fetchSecurityScore();
  }, [fetchFailedLogins, fetchSuspiciousIPs, fetchRateLimitHits, fetchSecurityScore]);

  async function handleBlockIP() {
    if (!ipToBlock) return;
    setBlockingIP(true);
    setBlockError('');
    try {
      await blockIP(ipToBlock);
      setIpToBlock('');
      fetchSuspiciousIPs();
    } catch (err: any) {
      setBlockError(err.message || 'Failed to block IP');
    } finally {
      setBlockingIP(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Security Dashboard</h1>

      {securityScore && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold text-neutral-900">{securityScore.score}</div>
            <div>
              <p className="text-sm font-medium text-neutral-900">Security Score</p>
              <p className="text-xs text-neutral-500">0-100 scale</p>
            </div>
          </div>
          {securityScore.recommendations?.length > 0 && (
            <div className="mt-3 space-y-1">
              {securityScore.recommendations.map((r: string, i: number) => (
                <p key={i} className="text-sm text-yellow-700">&#9888; {r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Failed Logins (24h)</h2>
          {failedLogins && (
            <div className="space-y-3">
              <p className="text-sm">Total: <span className="font-semibold">{failedLogins.totalAttempts}</span></p>
              {failedLogins.topIPs?.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase mb-1">Top IPs</h3>
                  <div className="space-y-1">
                    {failedLogins.topIPs.map((ip: any) => (
                      <div key={ip.ip} className="flex justify-between text-sm font-mono">
                        <span>{ip.ip}</span>
                        <span className="text-red-600">{ip.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {failedLogins.topEmails?.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-neutral-500 uppercase mb-1">Top Emails</h3>
                  <div className="space-y-1">
                    {failedLogins.topEmails.map((e: any) => (
                      <div key={e.emailHash} className="flex justify-between text-sm">
                        <span className="font-mono">{e.emailHash}</span>
                        <span className="text-red-600">{e.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Block IP</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="IP address..."
              value={ipToBlock}
              onChange={e => { setIpToBlock(e.target.value); setBlockError(''); }}
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
            />
            <button onClick={handleBlockIP} disabled={blockingIP || !ipToBlock}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50">
              {blockingIP ? 'Blocking...' : 'Block'}
            </button>
          </div>
          {blockError && <p className="mt-2 text-sm text-red-600">{blockError}</p>}
        </div>
      </div>

      {suspiciousIPs.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Suspicious IPs (&gt;50 failures/hour)</h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">IP</th>
                  <th className="p-3 text-right">Failed Count</th>
                  <th className="p-3">First Seen</th>
                  <th className="p-3">Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousIPs.map((ip: any) => (
                  <tr key={ip.ipAddress} className="border-b border-neutral-100">
                    <td className="p-3 font-mono text-sm">{ip.ipAddress}</td>
                    <td className="p-3 text-right font-medium text-red-600">{ip.failedCount}</td>
                    <td className="p-3 text-xs text-neutral-500">{new Date(ip.firstSeen).toLocaleString()}</td>
                    <td className="p-3 text-xs text-neutral-500">{new Date(ip.lastSeen).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rateLimitHits.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-neutral-900 mb-3">Rate Limit Hits (24h)</h2>
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="p-3">Endpoint</th>
                  <th className="p-3">IP</th>
                  <th className="p-3 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {rateLimitHits.map((h: any) => (
                  <tr key={`${h.endpoint}-${h.ip}`} className="border-b border-neutral-100">
                    <td className="p-3 font-mono text-xs">{h.endpoint}</td>
                    <td className="p-3 font-mono text-xs">{h.ip}</td>
                    <td className="p-3 text-right">{h.count}</td>
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
