import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Must include uppercase, lowercase, and number';
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
        setLocalError(err instanceof Error ? err.message : 'Login failed');
      }
    },
    [email, password, login, validate, clearError, navigate]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-xl font-bold text-white">
            CF
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome back</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
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
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
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
            <div className="mt-4 rounded-lg bg-danger-50 border border-danger-200 p-3">
              <p className="text-sm text-danger-700">{error}</p>
            </div>
          )}
          {localError && !error && (
            <div className="mt-4 rounded-lg bg-danger-50 border border-danger-200 p-3">
              <p className="text-sm text-danger-700">{localError}</p>
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

        <p className="mt-6 text-center text-sm text-neutral-500">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
