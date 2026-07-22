import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import GoogleSignInSection from '../components/GoogleSignInSection';
import RecoveryCodeDisplay from './register/RecoveryCodeDisplay';
import PasswordStrengthMeter from './register/PasswordStrengthMeter';

interface FormErrors {
  email?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
}

function FormField({ label, id, type, value, error, placeholder, autoComplete, onChange, autoFocus, onClearError }: {
  label: string; id: string; type: string; value: string; error?: string;
  placeholder: string; autoComplete: string; onChange: (v: string) => void;
  autoFocus?: boolean; onClearError: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
      <input
        id={id} type={type} value={value} autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); onClearError(); }}
        className={`input-field mt-1 ${error ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20' : ''}`}
        placeholder={placeholder} autoComplete={autoComplete}
      />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}

function PasswordInput({ id, label, value, error, placeholder, show, onToggleShow, onChange, onClearError }: {
  id: string; label: string; value: string; error?: string; placeholder: string;
  show: boolean; onToggleShow: () => void; onChange: (v: string) => void; onClearError: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</label>
      <div className="relative mt-1">
        <input
          id={id} type={show ? 'text' : 'password'} value={value}
          onChange={(e) => { onChange(e.target.value); onClearError(); }}
          className={`input-field w-full pr-10 ${error ? 'border-danger-500' : ''}`}
          placeholder={placeholder} autoComplete="new-password"
        />
        <button type="button" onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          tabIndex={-1} aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-danger-600">{error}</p>
      ) : id === 'reg-password' && value.length > 0 ? (
        <PasswordStrengthMeter password={value} />
      ) : id === 'reg-password' ? (
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Must include uppercase, lowercase, and number</p>
      ) : null}
    </div>
  );
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
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

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
        const code = await register(email.trim().toLowerCase(), displayName.trim(), password);
        if (code) {
          setRecoveryCode(code);
        } else {
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : 'Registration failed');
      }
    },
    [email, displayName, password, register, validate, clearError, navigate]
  );

  if (recoveryCode) {
    return <RecoveryCodeDisplay code={recoveryCode} onGoToDashboard={() => navigate('/dashboard', { replace: true })} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-xl font-bold text-white">
            CF
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Create account</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Start tracking your finances
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6">
          <div className="space-y-4">
            <FormField label="Email" id="reg-email" type="email" value={email} error={errors.email}
              placeholder="you@example.com" autoComplete="email" autoFocus onChange={setEmail}
              onClearError={() => setErrors((p) => ({ ...p, email: undefined }))} />

            <FormField label="Display Name" id="display-name" type="text" value={displayName} error={errors.displayName}
              placeholder="Your name" autoComplete="name" onChange={setDisplayName}
              onClearError={() => setErrors((p) => ({ ...p, displayName: undefined }))} />

            <PasswordInput id="reg-password" label="Password" value={password} error={errors.password}
              placeholder="Min 8 characters" show={showPassword}
              onToggleShow={() => setShowPassword(!showPassword)} onChange={setPassword}
              onClearError={() => setErrors((p) => ({ ...p, password: undefined }))} />

            <PasswordInput id="confirm-password" label="Confirm Password" value={confirmPassword} error={errors.confirmPassword}
              placeholder="Re-enter password" show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword(!showConfirmPassword)} onChange={setConfirmPassword}
              onClearError={() => setErrors((p) => ({ ...p, confirmPassword: undefined }))} />
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

          <button type="submit" disabled={isLoading} className="btn-primary mt-6 w-full">
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating account...
              </span>
            ) : 'Create account'}
          </button>
        </form>

        <GoogleSignInSection />

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
