import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

interface FormErrors {
  email?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Must be at least 2 characters';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      newErrors.password = 'Must include uppercase, lowercase, and number';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, displayName, password, confirmPassword]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      setLocalError(null);
      if (!validate()) return;

      try {
        await register(email.trim().toLowerCase(), displayName.trim(), password);
        navigate('/dashboard', { replace: true });
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Registration failed');
      }
    },
    [email, displayName, password, register, validate, clearError, navigate]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-xl font-bold text-white">
            CF
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Create account</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Start tracking your finances
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-neutral-700">
                Email
              </label>
              <input
                id="reg-email"
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
              {errors.email && <p className="mt-1 text-xs text-danger-600">{errors.email}</p>}
            </div>

            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-neutral-700">
                Display Name
              </label>
              <input
                id="display-name"
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined }));
                }}
                className={`input-field mt-1 ${errors.displayName ? 'border-danger-500' : ''}`}
                placeholder="Your name"
                autoComplete="name"
              />
              {errors.displayName && <p className="mt-1 text-xs text-danger-600">{errors.displayName}</p>}
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-neutral-700">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                }}
                className={`input-field mt-1 ${errors.password ? 'border-danger-500' : ''}`}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              {errors.password ? (
                <p className="mt-1 text-xs text-danger-600">{errors.password}</p>
              ) : (
                <p className="mt-1 text-xs text-neutral-400">Must include uppercase, lowercase, and number</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-neutral-700">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                }}
                className={`input-field mt-1 ${errors.confirmPassword ? 'border-danger-500' : ''}`}
                placeholder="Re-enter password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-danger-600">{errors.confirmPassword}</p>}
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
                Creating account...
              </span>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
