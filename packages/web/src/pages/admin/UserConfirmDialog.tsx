import { useState, useEffect } from 'react';

interface ConfirmDialogConfig {
  action: string;
  title: string;
  message: string;
  reason?: boolean;
  hours?: boolean;
}

interface UserConfirmDialogProps {
  config: ConfirmDialogConfig;
  loading: boolean;
  onConfirm: (action: string, reason: string, duration?: string) => void;
  onClose: () => void;
}

export default function UserConfirmDialog({ config, loading, onConfirm, onClose }: UserConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('');

  useEffect(() => {
    setReason('');
    setDuration('');
  }, [config]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-neutral-900">{config.title}</h3>
        <p className="mt-2 text-sm text-neutral-600">{config.message}</p>
        {config.reason && (
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason" className="input-field mt-3" autoFocus />
        )}
        {config.hours && (
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
            placeholder="Duration in hours (blank = permanent)" className="input-field mt-2" />
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={() => onConfirm(config.action, reason, duration)}
            disabled={loading || (config.reason && !reason.trim())} className="btn-primary">
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
