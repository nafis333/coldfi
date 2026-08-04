import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
  onGroupCreated?: (groupId: string) => void;
}

export default function CreateGroupModal({ onClose, onGroupCreated }: Props) {
  const { createGroup, generateInvite } = useGroupStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [groupId, setGroupId] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }

    setLoading(true);
    try {
      let gid = groupId;
      if (!gid) {
        gid = await createGroup(name.trim());
        setGroupId(gid);
      }
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
            Share this invite code with members so they can join. The invite auto-changes whenever someone leaves.
          </p>
          <div className="space-y-3">
            <div className="rounded-lg bg-neutral-50 dark:bg-neutral-700/50 p-3">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Invite Code</p>
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400">{inviteCode}</code>
                <button onClick={() => copy(inviteCode)} className="btn-ghost text-xs py-1 px-2">{copied ? 'Copied!' : 'Copy'}</button>
              </div>
            </div>
          </div>
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
          {error && <div className="rounded-lg border border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-700/20 p-3"><p className="text-sm text-danger-700 dark:text-danger-300">{error}</p></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
