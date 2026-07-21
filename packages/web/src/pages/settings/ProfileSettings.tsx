import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

const CURRENCIES = [
  { value: 'BDT', label: 'BDT (৳)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'JPY', label: 'JPY (¥)' },
  { value: 'CAD', label: 'CAD (C$)' },
  { value: 'AUD', label: 'AUD (A$)' },
  { value: 'CHF', label: 'CHF (Fr)' },
  { value: 'INR', label: 'INR (₹)' },
  { value: 'BRL', label: 'BRL (R$)' },
  { value: 'MXN', label: 'MXN (MX$)' },
];

const TIMEZONES: string[] = [
  'Asia/Dhaka', 'Asia/Kolkata', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
];

export default function ProfileSettings() {
  const { displayName: storeName, defaultCurrency: storeCurrency, timezone: storeTimezone, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(storeName ?? '');
  const [currency, setCurrency] = useState(storeCurrency ?? 'BDT');
  const [timezone, setTimezone] = useState(storeTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim() || undefined, defaultCurrency: currency, timezone });
      setSuccess('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Profile</h2>
      <form onSubmit={handleSave} className="flex max-w-md flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input-field"
            placeholder="Your display name"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Default Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-field"
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="input-field"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Auto-detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        </div>
        {error && (
          <div className="rounded-lg bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700 p-3">
            <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-success-50 dark:bg-success-700/20 border border-success-200 dark:border-success-700 p-3">
            <p className="text-sm text-success-700 dark:text-success-300">{success}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary self-start"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </span>
          ) : 'Save'}
        </button>
      </form>
    </div>
  );
}