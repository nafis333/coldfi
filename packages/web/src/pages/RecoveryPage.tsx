import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { computeAuthKeyHash, deriveWrappingKey, encryptPEK, importKey, generateSalt, uint8ArrayToBase64 } from '../lib/crypto';
import { storage, PEK_STORAGE_KEY } from '../lib/authPersistence';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function zeroBytes(arr: Uint8Array) {
  for (let i = 0; i < arr.length; i++) arr[i] = 0;
}

export default function RecoveryPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'code' | 'password' | 'done' | 'error'>('code');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const rawPekRef = useRef<Uint8Array | null>(null);
  const [tempToken, setTempToken] = useState('');

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !recoveryCode.trim()) {
      setError('Email and recovery code are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/recover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), recoveryCode: recoveryCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid email or recovery code');
      }

      const pekBytes = base64ToUint8Array(data.rawPek);
      rawPekRef.current = pekBytes;
      setTempToken(data.tempToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify recovery code');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');

    try {
      const pekBytes = rawPekRef.current;
      if (!pekBytes) {
        setError('Session expired. Please restart recovery.');
        setStep('code');
        return;
      }

      const personalSaltBytes = generateSalt();
      const personalSalt = uint8ArrayToBase64(personalSaltBytes);
      const authKeyHash = await computeAuthKeyHash(newPassword, email);
      const wrappingKey = await deriveWrappingKey(newPassword, personalSalt);
      const encryptedPek = await encryptPEK(pekBytes, wrappingKey);

      const res = await fetch(`${API_BASE}/api/auth/recover/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          authKeyHash,
          personalSalt,
          encryptedPek,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to complete recovery');
      }

      const pek = await importKey(pekBytes);
      storage().setItem(PEK_STORAGE_KEY, uint8ArrayToBase64(pekBytes));
      zeroBytes(pekBytes);
      rawPekRef.current = null;

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
            <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Recovery Complete</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Your password has been reset. All your data is preserved.</p>
          <button onClick={() => navigate('/login', { replace: true })} className="btn-primary mt-6 w-full">
            Sign in with new password
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-xl font-bold text-white">CF</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {step === 'code' ? 'Account Recovery' : 'Set New Password'}
          </h1>
        </div>

        <form onSubmit={step === 'code' ? handleCodeSubmit : handlePasswordSubmit} className="card p-6">
          <div className="space-y-4">
            {step === 'code' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    className="input-field mt-1"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Recovery Code</label>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => { setRecoveryCode(e.target.value); setError(''); }}
                    className="input-field mt-1 font-mono"
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                    autoComplete="off"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">New Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                      className="input-field w-full pr-10"
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Confirm Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                      className="input-field w-full pr-10"
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      tabIndex={-1} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700 p-3">
              <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {step === 'code' ? 'Verifying...' : 'Resetting...'}
              </span>
            ) : (
              step === 'code' ? 'Verify Recovery Code' : 'Reset Password'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
