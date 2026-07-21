import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import GoogleSignInSection from '../components/GoogleSignInSection';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verify2FA, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [need2FA, setNeed2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: { email?: string; password?: string; code?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      setLocalError(null);
      if (!validate()) return;

      try {
        await login(email.trim().toLowerCase(), password);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        if (err instanceof Error && err.message === '2FA_REQUIRED') {
          setNeed2FA(true);
        } else {
          setLocalError(err instanceof Error ? err.message : 'Login failed');
        }
      }
    },
    [email, password, login, validate, clearError, navigate]
  );

  const handle2FASubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      setLocalError(null);

      const c = twoFACode.replace(/\D/g, '').slice(0, 6);
      if (c.length !== 6) {
        setErrors({ code: 'Enter a 6-digit code' });
        return;
      }

      try {
        await verify2FA(c, password);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Verification failed');
      }
    },
    [twoFACode, password, verify2FA, clearError, navigate]
  );

  if (need2FA) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
        <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-md">CF</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Two-Factor Auth</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form onSubmit={handle2FASubmit} className="card p-6">
          <div className="flex flex-col items-center gap-3">
            <input
              type="text" maxLength={6} placeholder="000000" autoFocus
              value={twoFACode} onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`input-field w-40 text-center text-2xl tracking-[0.5em] font-mono ${errors.code ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
            />
            <p className="text-xs text-neutral-400 dark:text-neutral-500">Enter the 6-digit code from your authenticator app</p>
            {errors.code && <p className="text-xs text-danger-600">{errors.code}</p>}
          </div>

          {(error || localError) && (
            <div className="rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/50 p-3.5">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-danger-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-sm font-medium text-danger-700 dark:text-danger-300">{error || localError}</p>
              </div>
            </div>
          )}

          <button type="submit" disabled={isLoading || twoFACode.length !== 6} className="btn-primary mt-6 w-full">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Verifying...
              </span>
            ) : (
              'Verify'
            )}
          </button>

          <button type="button" onClick={() => { setNeed2FA(false); setTwoFACode(''); clearError(); }} className="btn-ghost mt-3 w-full text-sm">
            Go back
          </button>
        </form>
      </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-xl font-bold text-white shadow-md">
            CF
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                }}
                className={`input-field mt-1 ${errors.email ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
              {errors.email && (
                <p className="mt-1 text-xs text-danger-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                className={`input-field mt-1 ${errors.password ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-danger-600">{errors.password}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700 p-3">
              <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
            </div>
          )}
          {localError && !error && (
            <div className="mt-4 rounded-lg bg-danger-50 dark:bg-danger-700/20 border border-danger-200 dark:border-danger-700 p-3">
              <p className="text-sm text-danger-700 dark:text-danger-300">{localError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary mt-6 w-full"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <GoogleSignInSection />

        <p className="mt-4 text-center text-sm">
          <Link to="/forgot-password" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
