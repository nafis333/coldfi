import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

export default function CreateGroupModal({ onClose, onGroupCreated }: Props) {
  const { createGroup, generateInvite } = useGroupStore();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [groupId, setGroupId] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }
    if (!passphrase || passphrase.length < 8) { setError('Passphrase must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const gid = await createGroup(name.trim(), passphrase);
      setGroupId(gid);
      const data = await generateInvite(gid);
      setInviteCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (inviteCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Group Created!</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Share these details with members so they can join:
          </p>
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Invite Code</p>
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400">{inviteCode}</code>
                <button onClick={() => copy(inviteCode)} className="btn-ghost text-xs py-1 px-2">Copy</button>
              </div>
            </div>
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Passphrase</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono text-neutral-700 dark:text-neutral-300">{passphrase}</code>
                <button onClick={() => copy(passphrase)} className="btn-ghost text-xs py-1 px-2">Copy</button>
              </div>
            </div>
          </div>
          <button onClick={() => { onClose(); if (onGroupCreated && groupId) onGroupCreated(groupId); }} className="btn-primary w-full mt-6">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Create Group</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Group Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="input-field mt-1" placeholder="e.g. Roommates" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Group Passphrase</label>
            <div className="relative mt-1">
              <input type={showPassphrase ? 'text' : 'password'} value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
                className="input-field w-full pr-10" placeholder="Shared secret (min 8 chars)" />
              <button type="button" onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                tabIndex={-1} aria-label={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassphrase ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
              Share this passphrase with members so they can join
            </p>
          </div>
          {error && <div className="rounded-lg border border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-700/20 p-3"><p className="text-sm text-danger-700 dark:text-danger-300">{error}</p></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
