import { useState, useMemo } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

function generatePassphrase(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 24; i++) result += chars[arr[i]! % chars.length];
  return result.match(/.{1,4}/g)!.join('-');
}

export default function CreateGroupModal({ onClose, onGroupCreated }: Props) {
  const { createGroup, generateInvite } = useGroupStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [groupId, setGroupId] = useState('');
  const [copied, setCopied] = useState(false);

  const passphrase = useMemo(() => generatePassphrase(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }

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
    navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {});
  }

  if (inviteCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
        <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Group Created!</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Share these details with members so they can join. The passphrase auto-changes whenever someone leaves.
          </p>
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Invite Code</p>
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400">{inviteCode}</code>
                <button onClick={() => copy(inviteCode)} className="btn-ghost text-xs py-1 px-2">{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Passphrase</p>
              <div className="flex items-center justify-between">
                <code className="text-sm font-mono font-bold text-neutral-700 dark:text-neutral-300">{passphrase}</code>
                <button onClick={() => copy(passphrase)} className="btn-ghost text-xs py-1 px-2">{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs text-warning-600 dark:text-warning-400 font-medium">
            ⚠ Save the passphrase now — you won't see it again unless you view it in group settings.
          </p>
          <button onClick={() => { onClose(); if (onGroupCreated && groupId) onGroupCreated(groupId); }} className="btn-primary w-full mt-4">Done</button>
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
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/30 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-4 w-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Auto-Generated Passphrase</p>
            </div>
            <code className="block text-center text-lg font-mono font-bold text-primary-600 dark:text-primary-400 py-2 select-all tracking-wider">{passphrase}</code>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              This passphrase encrypts group data. Share it with members so they can join. It auto-rotates when someone leaves.
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
