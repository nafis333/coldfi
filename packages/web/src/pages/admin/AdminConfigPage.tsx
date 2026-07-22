import { useEffect, useState } from 'react';
import { silentCatch } from '../../lib/errorHandler';
import { useAdminConfigStore } from '../../stores/adminConfigStore';

export default function AdminConfigPage() {
  const { configItems, configHistory, loading, fetchConfig, fetchConfigHistory, updateConfig, toggleMaintenance } = useAdminConfigStore();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function handleSave(key: string) {
    let parsed: any = editValue;
    try { parsed = JSON.parse(editValue); } catch (err) { silentCatch('AdminConfigPage.parseConfig', err); }
    await updateConfig(key, parsed, editDescription || undefined);
    setEditKey(null);
  }

  function startEdit(item: any) {
    setEditKey(item.key);
    try { setEditValue(JSON.stringify(item.value)); } catch { setEditValue(String(item.value)); }
    setEditDescription(item.description || '');
  }

  async function toggleMaint() {
    const maintItem = configItems.find((c: any) => c.key === 'app.maintenance_mode');
    const current = maintItem?.value === true || maintItem?.value === 'true';
    await toggleMaintenance(!current);
    fetchConfig();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">System Config</h1>
        <button
          onClick={toggleMaint}
          className={`px-3 py-1.5 text-sm rounded ${
            configItems.find((c: any) => c.key === 'app.maintenance_mode')?.value === true || configItems.find((c: any) => c.key === 'app.maintenance_mode')?.value === 'true'
              ? 'bg-green-100 text-green-800'
              : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Toggle Maintenance Mode
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="p-3">Key</th>
              <th className="p-3">Value</th>
              <th className="p-3">Description</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {configItems.map((item: any) => (
              <tr key={item.key} className="border-b border-neutral-100">
                <td className="p-3 font-mono text-xs text-neutral-700">{item.key}</td>
                <td className="p-3">
                  {editKey === item.key ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm font-mono"
                      autoFocus
                    />
                  ) : (
                    <span className="font-mono text-xs">
                      {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                    </span>
                  )}
                </td>
                <td className="p-3 text-xs text-neutral-500">
                  {editKey === item.key ? (
                    <input
                      type="text"
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  ) : (
                    item.description || '-'
                  )}
                </td>
                <td className="p-3">
                  {editKey === item.key ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleSave(item.key)} className="text-xs text-green-600 hover:underline">Save</button>
                      <button onClick={() => setEditKey(null)} className="text-xs text-neutral-500 hover:underline">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(item)} className="text-xs text-primary-600 hover:underline">Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-medium text-neutral-900 mb-3">Config Change History</h2>
        <button onClick={() => fetchConfigHistory()} className="mb-3 px-3 py-1.5 text-sm border rounded hover:bg-neutral-50">
          Load History
        </button>
        {configHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-x-auto max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500 sticky top-0 bg-white">
                  <th className="p-2">Time</th>
                  <th className="p-2">Key</th>
                  <th className="p-2">Changed By</th>
                  <th className="p-2">Old Value</th>
                  <th className="p-2">New Value</th>
                </tr>
              </thead>
              <tbody>
                {configHistory.map((ch: any) => (
                  <tr key={ch.id} className="border-b border-neutral-100">
                    <td className="p-2 text-xs text-neutral-500">{new Date(ch.created_at || ch.createdAt).toLocaleString()}</td>
                    <td className="p-2 font-mono text-xs">{ch.config_key}</td>
                    <td className="p-2 text-xs">{ch.changed_by}</td>
                    <td className="p-2 font-mono text-xs max-w-xs truncate">{JSON.stringify(ch.old_value)}</td>
                    <td className="p-2 font-mono text-xs max-w-xs truncate">{JSON.stringify(ch.new_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
