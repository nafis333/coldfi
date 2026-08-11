import { useState, useEffect } from 'react';
import { silentCatch } from '../../lib/errorHandler';
import { apiClient } from '../../lib/apiClient';

interface Preferences {
  push_enabled: boolean;
  expense_created: boolean;
  expense_updated: boolean;
  expense_deleted: boolean;
  settlement_created: boolean;
  settlement_confirmed: boolean;
  settlement_rejected: boolean;
  member_joined: boolean;
  member_left: boolean;
  balance_adjusted: boolean;
  reminders: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_enabled: boolean;
}

const DEFAULT_PREFS: Preferences = {
  push_enabled: true,
  expense_created: true,
  expense_updated: true,
  expense_deleted: true,
  settlement_created: true,
  settlement_confirmed: true,
  settlement_rejected: true,
  member_joined: true,
  member_left: true,
  balance_adjusted: true,
  reminders: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_hours_enabled: false,
};

export default function NotificationPreferencesSettings() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient('/api/notifications/preferences');
        if (res.ok) {
          const data = await res.json();
          setPrefs({ ...DEFAULT_PREFS, ...data.preferences });
        }
      } catch (e) {
        silentCatch('NotificationPreferencesSettings.load', e);
        console.error('Failed to load notification preferences:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  function toggle(key: keyof Preferences) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setTime(key: 'quiet_hours_start' | 'quiet_hours_end', value: string) {
    setPrefs((prev) => ({ ...prev, [key]: value || null }));
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const body: any = {};
      for (const key of Object.keys(prefs) as (keyof Preferences)[]) {
        if (key.startsWith('quiet_hours') || key === 'push_enabled') {
          body[key] = prefs[key];
        } else if (prefs[key] !== DEFAULT_PREFS[key]) {
          body[key] = prefs[key];
        }
      }
      // Always send quiet hours when enabled
      if (prefs.quiet_hours_enabled) {
        body.quiet_hours_start = prefs.quiet_hours_start;
        body.quiet_hours_end = prefs.quiet_hours_end;
        body.quiet_hours_enabled = true;
      } else {
        body.quiet_hours_enabled = false;
      }

      const res = await apiClient('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch((err) => { silentCatch('NotificationPreferencesSettings.saveParse', err); return {}; });
        throw new Error(data.message || 'Failed to save preferences');
      }
      setSuccess('Preferences saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-neutral-400">Loading...</p>;
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Notification Preferences</h2>

      <div className="mb-6 space-y-4">
        <ToggleRow label="Push notifications" desc="Receive push notifications on this device" checked={prefs.push_enabled} onChange={() => toggle('push_enabled')} />

        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Events</h3>
          <div className="space-y-3">
            <ToggleRow label="Expense created" checked={prefs.expense_created} onChange={() => toggle('expense_created')} />
            <ToggleRow label="Expense updated" checked={prefs.expense_updated} onChange={() => toggle('expense_updated')} />
            <ToggleRow label="Expense deleted" checked={prefs.expense_deleted} onChange={() => toggle('expense_deleted')} />
            <ToggleRow label="Settlement proposed" checked={prefs.settlement_created} onChange={() => toggle('settlement_created')} />
            <ToggleRow label="Settlement confirmed" checked={prefs.settlement_confirmed} onChange={() => toggle('settlement_confirmed')} />
            <ToggleRow label="Settlement rejected" checked={prefs.settlement_rejected} onChange={() => toggle('settlement_rejected')} />
            <ToggleRow label="Member joined" checked={prefs.member_joined} onChange={() => toggle('member_joined')} />
            <ToggleRow label="Member left" checked={prefs.member_left} onChange={() => toggle('member_left')} />
            <ToggleRow label="Balance adjusted" checked={prefs.balance_adjusted} onChange={() => toggle('balance_adjusted')} />
            <ToggleRow label="Reminders" checked={prefs.reminders} onChange={() => toggle('reminders')} />
          </div>
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">Quiet Hours</h3>
          <ToggleRow label="Enable quiet hours" desc="Suppress notifications during specified hours" checked={prefs.quiet_hours_enabled} onChange={() => toggle('quiet_hours_enabled')} />
          {prefs.quiet_hours_enabled && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">From</label>
                <input type="time" value={prefs.quiet_hours_start || '22:00'} onChange={(e) => setTime('quiet_hours_start', e.target.value)} className="input-field mt-1 w-32" />
              </div>
              <span className="mt-5 text-neutral-400">—</span>
              <div>
                <label className="block text-xs text-neutral-500 dark:text-neutral-400">To</label>
                <input type="time" value={prefs.quiet_hours_end || '07:00'} onChange={(e) => setTime('quiet_hours_end', e.target.value)} className="input-field mt-1 w-32" />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-danger-600">{error}</p>}
      {success && <p className="mb-3 text-sm text-success-600">{success}</p>}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</p>
        {desc && <p className="text-xs text-neutral-500 dark:text-neutral-400">{desc}</p>}
      </div>
      <input type="checkbox" checked={checked} onChange={onChange} className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500" />
    </label>
  );
}