import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { silentCatch } from '../../lib/errorHandler';
import { useGroupStore } from '../../stores/groupStore';
import { useAuthStore } from '../../stores/authStore';

interface InviteCode {
  id: string;
  code: string;
  use_count: number;
  max_uses: number;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export default function GroupSettingsTab() {
  const { groupId } = useOutletContext<{ groupId: string }>();
  const { currentGroup, generateInvite, fetchInvites, revokeInvite, changePassphrase, updateGroupSettings } = useGroupStore();
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [groupName, setGroupName] = useState(currentGroup?.name || '');
  const [currency, setCurrency] = useState(currentGroup?.defaultCurrency || useAuthStore.getState().defaultCurrency);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState('');

  useEffect(() => {
    loadInvites();
  }, [groupId]);

  async function loadInvites() {
    try {
      const data = await fetchInvites(groupId);
      setInvites(data.invites);
    } catch (err) { silentCatch('GroupSettingsTab.loadInvites', err); }
  }

  async function handleGenerate() {
    try {
      setErr('');
      const data = await generateInvite(groupId);
      setMsg(`Invite code: ${data.code}`);
      await loadInvites();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleRevoke(inviteId: string) {
    try {
      setErr('');
      await revokeInvite(groupId, inviteId);
      setMsg('Invite revoked');
      await loadInvites();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function handleChangePassphrase(e: React.FormEvent) {
    e.preventDefault();
    if (newPassphrase.length < 8) { setErr('Passphrase must be at least 8 characters'); return; }
    if (newPassphrase !== confirmPassphrase) { setErr('Passphrases do not match'); return; }
    try {
      setErr('');
      setLoading('passphrase');
      await changePassphrase(groupId, newPassphrase);
      setMsg('Passphrase changed successfully');
      setNewPassphrase('');
      setConfirmPassphrase('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading('');
    }
  }

  async function handleUpdateSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      setErr('');
      setLoading('settings');
      await updateGroupSettings(groupId, { name: groupName || undefined, defaultCurrency: currency || undefined });
      setMsg('Settings updated');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading('');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setMsg('Copied to clipboard');
    }).catch(() => {
      setMsg('Failed to copy');
    });
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div className="rounded-lg bg-success-50 dark:bg-success-700/20 border border-success-200 dark:border-success-700 p-3">
          <p className="text-sm text-success-700 dark:text-success-300">{msg}</p>
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700 p-3">
          <p className="text-sm text-danger-700 dark:text-danger-300">{err}</p>
        </div>
      )}

      {/* Invite Codes */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Invite Codes</h3>

        <div className="space-y-3 mb-4">
          {invites.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No invite codes generated yet.</p>
          ) : (
            invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-700/50">
                <div>
                  <code className="text-sm font-mono text-primary-600 dark:text-primary-400">{inv.code}</code>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Used {inv.use_count}/{inv.max_uses} · {inv.is_active ? 'Active' : 'Revoked'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(inv.code)} className="btn-ghost text-xs py-1 px-2">
                    Copy
                  </button>
                  {inv.is_active && (
                    <button onClick={() => handleRevoke(inv.id)} className="btn-ghost text-xs py-1 px-2 text-danger-600 hover:text-danger-700">
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <button onClick={handleGenerate} className="btn-secondary text-sm">
          + Generate Invite Code
        </button>
      </div>

      {/* Change Passphrase */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Change Passphrase</h3>
        <form onSubmit={handleChangePassphrase} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">New Passphrase</label>
            <input
              type="password"
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              className="input-field"
              placeholder="Min 8 characters"
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Confirm Passphrase</label>
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              className="input-field"
              placeholder="Re-enter passphrase"
            />
          </div>
          <button type="submit" disabled={loading === 'passphrase'} className="btn-primary">
            {loading === 'passphrase' ? 'Updating...' : 'Change Passphrase'}
          </button>
        </form>
      </div>

      {/* Group Settings */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Group Settings</h3>
        <form onSubmit={handleUpdateSettings} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="input-field"
              placeholder="New group name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Default Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="input-field">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="BDT">BDT</option>
              <option value="INR">INR</option>
            </select>
          </div>
          <button type="submit" disabled={loading === 'settings'} className="btn-primary">
            {loading === 'settings' ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
