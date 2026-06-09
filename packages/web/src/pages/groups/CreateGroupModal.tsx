import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
}

export default function CreateGroupModal({ onClose }: Props) {
  const { createGroup } = useGroupStore();
  const [name, setName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Group name is required'); return; }
    if (!passphrase || passphrase.length < 8) { setError('Passphrase must be at least 8 characters'); return; }

    setLoading(true);
    try {
      await createGroup(name.trim(), passphrase);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Create Group</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Group Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="input-field mt-1" placeholder="e.g. Roommates" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Group Passphrase</label>
            <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              className="input-field mt-1" placeholder="Shared secret (min 8 chars)" />
            <p className="mt-1 text-xs text-neutral-400">
              Share this passphrase with members so they can join
            </p>
          </div>
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3"><p className="text-sm text-danger-700">{error}</p></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
