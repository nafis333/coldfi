import { useEffect, useState } from 'react';
import { useAdminConfigStore } from '../../stores/adminConfigStore';

export default function AdminAlertsPage() {
  const { alertRules, alertHistory, fetchAlertRules, fetchAlertHistory, createAlertRule, updateAlertRule, deleteAlertRule, acknowledgeAlert, testAlertRule, evaluateAlerts } = useAdminConfigStore();
  const [tab, setTab] = useState<'rules' | 'history'>('rules');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetchAlertRules();
    fetchAlertHistory({});
  }, [fetchAlertRules, fetchAlertHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.id) {
      await updateAlertRule(form.id, form);
    } else {
      await createAlertRule(form);
    }
    setShowForm(false);
    setForm({});
  }

  function editRule(rule: any) {
    setForm(rule);
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Alerts</h1>
        <div className="flex gap-2">
          <button onClick={() => evaluateAlerts()} className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-50">
            Evaluate
          </button>
          <button onClick={() => { setForm({}); setShowForm(true); }} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">
            New Rule
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        {(['rules', 'history'] as const).map(t => (
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

      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">{form.id ? 'Edit' : 'Create'} Alert Rule</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                <input type="text" required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Metric</label>
                  <select value={form.metric || 'error_rate'} onChange={e => setForm({ ...form, metric: e.target.value })} className="w-full px-3 py-2 border rounded text-sm">
                    <option value="error_rate">Error Rate</option>
                    <option value="memory">Memory</option>
                    <option value="p99_latency">P99 Latency</option>
                    <option value="reg_rate">Registration Rate</option>
                    <option value="db_connections">DB Connections</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Condition</label>
                  <select value={form.condition || '>'} onChange={e => setForm({ ...form, condition: e.target.value })} className="w-full px-3 py-2 border rounded text-sm">
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Threshold</label>
                  <input type="number" required value={form.threshold || ''} onChange={e => setForm({ ...form, threshold: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Window (min)</label>
                  <input type="number" value={form.window_minutes || 5} onChange={e => setForm({ ...form, window_minutes: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.enabled !== false} onChange={e => setForm({ ...form, enabled: e.target.checked })} id="enabled" />
                <label htmlFor="enabled" className="text-sm">Enabled</label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">
                  {form.id ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === 'rules' && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">Name</th>
                <th className="p-3">Metric</th>
                <th className="p-3">Condition</th>
                <th className="p-3 text-right">Threshold</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alertRules.map((r: any) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 font-mono text-xs">{r.metric}</td>
                  <td className="p-3">{r.condition} {r.threshold}</td>
                  <td className="p-3 text-right">{r.threshold}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.enabled ? 'bg-green-100 text-green-800' : 'bg-neutral-100 text-neutral-500'}`}>
                      {r.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => editRule(r)} className="text-xs text-primary-600 hover:underline">Edit</button>
                      <button onClick={() => testAlertRule(r.id)} className="text-xs text-neutral-600 hover:underline">Test</button>
                      <button onClick={() => { if (confirm('Delete rule?')) deleteAlertRule(r.id); }} className="text-xs text-red-600 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && alertHistory && (
        <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="p-3">Time</th>
                <th className="p-3">Rule</th>
                <th className="p-3">Metric</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-right">Threshold</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alertHistory.alerts?.map((a: any) => (
                <tr key={a.id} className="border-b border-neutral-100">
                  <td className="p-3 text-xs text-neutral-500">{new Date(a.created_at || a.createdAt).toLocaleString()}</td>
                  <td className="p-3">{a.rule_name || a.ruleName}</td>
                  <td className="p-3 font-mono text-xs">{a.metric}</td>
                  <td className="p-3 text-right font-medium">{parseFloat(a.actual_value || a.actualValue).toFixed(2)}</td>
                  <td className="p-3 text-right">{a.threshold}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      a.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      a.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>{a.severity}</span>
                  </td>
                  <td className="p-3">
                    {a.acknowledged ? (
                      <span className="text-xs text-green-600">Acknowledged</span>
                    ) : (
                      <span className="text-xs text-yellow-600">Pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    {!a.acknowledged && (
                      <button onClick={() => acknowledgeAlert(a.id)} className="text-xs text-primary-600 hover:underline">Acknowledge</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
