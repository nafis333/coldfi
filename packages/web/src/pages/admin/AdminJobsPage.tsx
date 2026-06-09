import { useState, useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';

export default function AdminJobsPage() {
  const jobs = useAdminStore((s) => s.jobs);
  const fetchJobs = useAdminStore((s) => s.fetchJobs);
  const [expandedPid, setExpandedPid] = useState<number | null>(null);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  if (!jobs) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const cards = [
    { title: 'Active Queries', value: jobs.active, color: 'bg-amber-100 text-amber-700' },
    { title: 'Idle Connections', value: jobs.idle, color: 'bg-emerald-100 text-emerald-700' },
    { title: 'Total', value: jobs.total, color: 'bg-neutral-100 text-neutral-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Background Jobs</h1>
        <button
          onClick={fetchJobs}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(card => (
          <div key={card.title} className="bg-white rounded-lg border border-neutral-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">{card.title}</p>
                <p className="mt-2 text-3xl font-bold text-neutral-900">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.color}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">Running Queries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-2 py-3 w-10" />
                <th className="px-6 py-3 text-xs font-medium text-left text-neutral-500 uppercase">PID</th>
                <th className="px-6 py-3 text-xs font-medium text-left text-neutral-500 uppercase">State</th>
                <th className="px-6 py-3 text-xs font-medium text-left text-neutral-500 uppercase">Query</th>
                <th className="px-6 py-3 text-xs font-medium text-left text-neutral-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-xs font-medium text-left text-neutral-500 uppercase">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {jobs.queries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">No active queries</td>
                </tr>
              ) : (
                jobs.queries.map((q: any) => (
                  <tr key={q.pid}>
                    <td className="px-2 py-4">
                      {q.query ? (
                        <button
                          onClick={() => setExpandedPid(expandedPid === q.pid ? null : q.pid)}
                          className="p-1 rounded hover:bg-neutral-100"
                        >
                          <svg className={`w-4 h-4 text-neutral-400 transition-transform ${expandedPid === q.pid ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-600">{q.pid}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        q.state === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {q.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-neutral-600 max-w-md truncate">
                      {q.query || '\u2014'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">
                      {q.duration != null ? `${Math.round(q.duration / 1000)}s` : '\u2014'}
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-500">{q.startedAt || '\u2014'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {jobs.queries.filter((q: any) => expandedPid === q.pid && q.query).map((q: any) => (
        <div key={`${q.pid}-expanded`} className="bg-neutral-900 rounded-lg p-4 -mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-400 font-mono">PID {q.pid} — Full Query</span>
          </div>
          <pre className="text-green-400 text-xs overflow-x-auto whitespace-pre-wrap">{q.query}</pre>
        </div>
      ))}
    </div>
  );
}