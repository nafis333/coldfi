import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

export default function ProfileSettings() {
  const { displayName: storeName, email: storeEmail, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(storeName ?? '');
  const [email, setEmail] = useState(storeEmail ?? '');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateProfile({ name: displayName, email, currency });
      setSuccess('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900">Profile</h2>
      <form onSubmit={handleSave} className="flex max-w-md flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-field"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="JPY">JPY (¥)</option>
          </select>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        {success && <p className="text-sm text-success-600">{success}</p>}
        <button
          type="submit"
          disabled={saving}
          className="btn-primary self-start"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}
