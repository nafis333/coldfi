import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import TabSyncStatus from './TabSyncStatus';

export default function SecuritySettings() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Must include uppercase, lowercase, and number');
      return;
    }
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to change password');
      }
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    }
  };

  const handleTwoFactorToggle = async () => {
    setTwoFactorLoading(true);
    setError('');
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${API_BASE}/api/auth/2fa/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ enabled: !twoFactorEnabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update 2FA setting');
      }
      setTwoFactorEnabled(!twoFactorEnabled);
      setSuccess(twoFactorEnabled ? 'Two-factor authentication disabled' : 'Two-factor authentication enabled');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update 2FA');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-neutral-900">Security</h2>

      {/* Change Password */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800">Change Password</h3>
        <form onSubmit={handleChangePassword} className="flex max-w-sm flex-col gap-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="input-field"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="input-field"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="input-field"
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          {success && <p className="text-sm text-success-600">{success}</p>}
          <button
            type="submit"
            className="btn-primary self-start"
          >
            Change Password
          </button>
        </form>
      </div>

      {/* 2FA Toggle */}
      <div className="mb-6">
        <h3 className="mb-3 text-base font-semibold text-neutral-800">Two-Factor Authentication</h3>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={twoFactorEnabled}
            onChange={handleTwoFactorToggle}
            disabled={twoFactorLoading}
            className="h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Enable two-factor authentication</span>
        </label>
      </div>

      {/* Recovery Key */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-neutral-800">Recovery Key</h3>
        <p className="mb-2 text-sm text-neutral-500">Your recovery key can be used to regain access if you lose your password.</p>
        <button className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">
          View Recovery Key
        </button>
      </div>

      {/* Multi-Tab Sync */}
      <div className="mt-8">
        <h3 className="mb-3 text-base font-semibold text-neutral-800">Multi-Tab Sync</h3>
        <TabSyncStatus />
      </div>
    </div>
  );
}
