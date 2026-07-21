import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function PekPromptModal() {
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pekMissing = useAuthStore((s) => s.pekMissing);
  const pekErrorMessage = useAuthStore((s) => s.pekErrorMessage);
  const isGoogleUser = useAuthStore((s) => s.isGoogleUser);
  const resolvePekMissing = useAuthStore((s) => s.resolvePekMissing);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setSubmitting(true);
    try {
      await resolvePekMissing(passphrase);
    } catch {
      setPassphrase('');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setDismissed(true);
  };

  if (!pekMissing || dismissed || isGoogleUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-800 p-8 shadow-xl">
        <h2 className="mb-2 text-xl font-bold text-neutral-900 dark:text-white">Session Restored</h2>
        <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
          Your session has been restored from a saved token. Enter your passphrase to decrypt your personal data, or skip to continue without it.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Passphrase</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="input-field"
              placeholder="Enter your passphrase"
              autoFocus
              disabled={submitting}
            />
          </div>
          {pekErrorMessage && (
            <p className="text-sm text-danger-600 dark:text-danger-400">{pekErrorMessage}</p>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting || !passphrase.trim()} className="btn-primary flex-1">
              {submitting ? 'Decrypting...' : 'Unlock'}
            </button>
            <button type="button" onClick={handleSkip} disabled={submitting} className="btn-ghost">
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
