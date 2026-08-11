import { useState, useEffect } from 'react';
import { silentCatch } from '../../lib/errorHandler';
import { apiClient } from '../../lib/apiClient';
import { useGroupStore } from '../../stores/groupStore';

interface Props {
  onClose: () => void;
}

export default function JoinGroupModal({ onClose }: Props) {
  const { joinGroup } = useGroupStore();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState<{ name: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (inviteCode.trim().length < 4) { setGroupInfo(null); return; }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await apiClient(`/api/group/invite/${inviteCode.trim()}`, { method: 'GET' });
        if (res.ok) {
          const data = await res.json();
          setGroupInfo({ name: data.name });
        } else {
          setGroupInfo(null);
        }
      } catch (err) {
        silentCatch('JoinGroupModal.preview', err);
        setGroupInfo(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inviteCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!inviteCode.trim()) { setError('Invite code is required'); return; }

    setLoading(true);
    try {
      await joinGroup(inviteCode.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-800 p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Join Group</h2>
          <button onClick={onClose} className="text-sm font-medium text-primary-600 hover:text-primary-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Invite Code</label>
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              className="input-field mt-1" placeholder="Paste invite code" autoFocus />
            {previewLoading && <p className="mt-1 text-xs text-neutral-400">Checking...</p>}
            {groupInfo && (
              <p className="mt-1 text-xs text-success-600 dark:text-success-400">
                Joining: {groupInfo.name}
              </p>
            )}
          </div>
          {error && <div className="rounded-lg border border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-700/20 p-3"><p className="text-sm text-danger-700 dark:text-danger-300">{error}</p></div>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Joining...' : 'Join Group'}
          </button>
        </form>
      </div>
    </div>
  );
}
