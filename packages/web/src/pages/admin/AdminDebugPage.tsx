import { useEffect, useState } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminDebugPage() {
  const { logs, errorEvents, errorDetail, trace, cacheInfo, fetchLogs, fetchErrorEvents, fetchErrorDetail, resolveError, fetchTrace, inspectCache, clearCache } = useAdminStore();
  const [tab, setTab] = useState<'logs' | 'errors' | 'trace' | 'cache'>('logs');
  const [logFilters, setLogFilters] = useState({ level: '', module: '', search: '' });
  const [traceId, setTraceId] = useState('');
  const [cachePattern, setCachePattern] = useState('*');

  useEffect(() => {
    if (tab === 'logs') fetchLogs({});
    if (tab === 'errors') fetchErrorEvents({});
  }, [tab, fetchLogs, fetchErrorEvents]);

  function handleLogSearch() {
    const params: any = {};
    if (logFilters.level) params.level = logFilters.level;
    if (logFilters.module) params.module = logFilters.module;
    if (logFilters.search) params.search = logFilters.search;
    fetchLogs(params);
  }

  function handleTraceSearch() {
    if (traceId) fetchTrace(traceId);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Debug Tools</h1>

      <div className="flex gap-2 border-b border-neutral-200">
        {(['logs', 'errors', 'trace', 'cache'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors capitalize ${
              tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'logs' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <select value={logFilters.level} onChange={e => setLogFilters(f => ({ ...f, level: e.target.value }))} className="px-3 py-2 border rounded text-sm">
              <option value="">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
            <input type="text" placeholder="Module..." value={logFilters.module} onChange={e => setLogFilters(f => ({ ...f, module: e.target.value }))} className="px-3 py-2 border rounded text-sm" />
            <input type="text" placeholder="Search..." value={logFilters.search} onChange={e => setLogFilters(f => ({ ...f, search: e.target.value }))} className="px-3 py-2 border rounded text-sm flex-1" />
            <button onClick={handleLogSearch} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">
              Search
            </button>
          </div>

          {logs && (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500 sticky top-0 bg-white">
                    <th className="p-2">Time</th>
                    <th className="p-2">Level</th>
                    <th className="p-2">Module</th>
                    <th className="p-2">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items?.map((l: any) => (
                    <tr key={l.id} className="border-b border-neutral-100">
                      <td className="p-2 text-xs text-neutral-500 whitespace-nowrap">{new Date(l.createdAt).toLocaleTimeString()}</td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          l.level === 'error' ? 'bg-red-100 text-red-800' :
                          l.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>{l.level}</span>
                      </td>
                      <td className="p-2 text-xs font-mono text-neutral-600">{l.module}</td>
                      <td className="p-2 text-neutral-800 max-w-md truncate">{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'errors' && (
        <div className="space-y-4">
          {errorEvents && (
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th className="p-3">Code</th>
                    <th className="p-3">Message</th>
                    <th className="p-3 text-right">Occurrences</th>
                    <th className="p-3 text-right">Users</th>
                    <th className="p-3">Last Seen</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {errorEvents.items?.map((e: any) => (
                    <tr key={e.id} className="border-b border-neutral-100">
                      <td className="p-3 font-mono text-xs text-red-600">{e.errorCode}</td>
                      <td className="p-3 max-w-xs truncate">{e.errorMessage}</td>
                      <td className="p-3 text-right">{e.occurrenceCount}</td>
                      <td className="p-3 text-right">{e.affectedUsers}</td>
                      <td className="p-3 text-xs text-neutral-500">{new Date(e.lastSeen).toLocaleString()}</td>
                      <td className="p-3">{e.resolved ? <span className="text-green-600 text-xs">Resolved</span> : <span className="text-red-600 text-xs">Active</span>}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => fetchErrorDetail(e.id)} className="text-xs text-primary-600 hover:underline">View</button>
                          {!e.resolved && <button onClick={() => resolveError(e.id)} className="text-xs text-green-600 hover:underline">Resolve</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errorDetail && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-2">
              <h3 className="font-medium text-neutral-900">Error Detail</h3>
              <pre className="text-xs bg-neutral-50 p-3 rounded overflow-x-auto max-h-60">
                {JSON.stringify(errorDetail, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {tab === 'trace' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Request ID..."
              value={traceId}
              onChange={e => setTraceId(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
            />
            <button onClick={handleTraceSearch} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">
              Trace
            </button>
          </div>

          {trace && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <h3 className="font-medium text-neutral-900">Trace: {trace.requestId}</h3>
              {trace.steps?.map((s: any, i: number) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-xs text-neutral-400 w-20 shrink-0">{new Date(s.timestamp).toLocaleTimeString()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    s.level === 'error' ? 'bg-red-100 text-red-800' : 'bg-neutral-100'
                  }`}>{s.level}</span>
                  <span className="font-mono text-xs text-neutral-500 w-24">{s.module}</span>
                  <span className="text-neutral-800">{s.message}</span>
                </div>
              ))}
              {trace.errors?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <h4 className="text-sm font-medium text-red-700 mb-2">Errors ({trace.errors.length})</h4>
                  {trace.errors.map((e: any, i: number) => (
                    <div key={i} className="text-sm text-red-600">{e.timestamp}: {e.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'cache' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Pattern (e.g. temp:* or admin:*)"
              value={cachePattern}
              onChange={e => setCachePattern(e.target.value)}
              className="flex-1 px-3 py-2 border rounded text-sm font-mono"
            />
            <button onClick={() => inspectCache(cachePattern)} className="px-4 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700">
              Inspect
            </button>
            <button onClick={() => clearCache(cachePattern)} className="px-4 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100">
              Clear
            </button>
          </div>

          {cacheInfo && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-neutral-500">Keys:</span>
                  <p className="text-xl font-semibold">{cacheInfo.keyCount}</p>
                </div>
                <div>
                  <span className="text-sm text-neutral-500">Est. Memory:</span>
                  <p className="text-xl font-semibold">{(cacheInfo.totalEstimatedMemory / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              {cacheInfo.sampleKeys?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-2">Sample Keys</h4>
                  <div className="font-mono text-xs space-y-1 max-h-40 overflow-y-auto">
                    {cacheInfo.sampleKeys.map((k: string) => <div key={k} className="text-neutral-600">{k}</div>)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
