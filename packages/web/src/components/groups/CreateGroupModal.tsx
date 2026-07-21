import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: Props) {
  const { createGroup, generateInvite } = useGroupStore();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
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
          <button onClick={onClose} className="btn-primary w-full mt-6">Done</button>
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
            <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              className="input-field mt-1" placeholder="Shared secret (min 8 chars)" />
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
