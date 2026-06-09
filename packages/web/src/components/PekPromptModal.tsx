import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export default function PekPromptModal() {
  const [passphrase, setPassphrase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pekMissing = useAuthStore((s) => s.pekMissing);
  const pekErrorMessage = useAuthStore((s) => s.pekErrorMessage);
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

  if (!pekMissing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="mb-2 text-xl font-bold text-neutral-900">Session Restored</h2>
        <p className="mb-6 text-sm text-neutral-500">
          Your session has been restored from a saved token. Please enter your passphrase to decrypt your personal data.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Passphrase</label>
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
            <p className="text-sm text-danger-600">{pekErrorMessage}</p>
          )}
          <button type="submit" disabled={submitting || !passphrase.trim()} className="btn-primary">
            {submitting ? 'Decrypting...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
