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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
              <div className="relative mt-1">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  className={`input-field w-full pr-10 ${errors.password ? 'border-danger-500' : ''}`}
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
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
              <div className="relative mt-1">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }}
                  className={`input-field w-full pr-10 ${errors.confirmPassword ? 'border-danger-500' : ''}`}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
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
