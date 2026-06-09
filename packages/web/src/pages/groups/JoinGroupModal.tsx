import { useState } from 'react';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
}

export default function JoinGroupModal({ onClose }: Props) {
  const { joinGroup } = useGroupStore();
  const [inviteCode, setInviteCode] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!inviteCode.trim()) { setError('Invite code is required'); return; }
    if (!passphrase) { setError('Passphrase is required'); return; }

    setLoading(true);
    try {
      await joinGroup(inviteCode.trim(), passphrase);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Join Group</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Invite Code</label>
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              className="input-field mt-1" placeholder="Paste invite code" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Group Passphrase</label>
            <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)}
              className="input-field mt-1" placeholder="Shared secret from group creator" />
          </div>
          {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3"><p className="text-sm text-danger-700">{error}</p></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Joining...' : 'Join Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
