import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErrorStore, CriticalError } from '../stores/errorStore';

const CATEGORY_ICONS: Record<string, string> = {
  NetworkError: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  CSPError: 'M12 15v2m0 0v2m0-2h.01M12 3l9.5 16.5h-19L12 3z',
  AuthError: 'M12 15v2m0 0v2m0-2h.01M12 3l9.5 16.5h-19L12 3z',
  ServerError: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  UnknownError: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const CATEGORY_COLORS: Record<string, string> = {
  NetworkError: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50',
  CSPError: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50',
  AuthError: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50',
  ServerError: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50',
  UnknownError: 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-800/50',
};

function restoreCriticalError(): CriticalError | null {
  const fromStore = useErrorStore.getState().criticalError;
  if (fromStore) return fromStore;
  try {
    const raw = sessionStorage.getItem('coldfi:criticalError');
    if (raw) {
      const parsed = JSON.parse(raw) as CriticalError;
      useErrorStore.getState().setCriticalError(parsed);
      sessionStorage.removeItem('coldfi:criticalError');
      return parsed;
    }
  } catch {}
  return null;
}

export default function ErrorPage() {
  const navigate = useNavigate();
  const criticalError = useErrorStore((s) => s.criticalError);
  const clearCriticalError = useErrorStore((s) => s.clearCriticalError);
  const [showDetails, setShowDetails] = useState(true);
  const [error, setError] = useState<CriticalError | null>(criticalError);

  useEffect(() => {
    const restored = restoreCriticalError();
    if (restored) {
      setError(restored);
    } else if (!error) {
      navigate('/', { replace: true });
    }
  }, []);

  if (!error) return null;

  const icon = CATEGORY_ICONS[error.category] || CATEGORY_ICONS.UnknownError;
  const color = CATEGORY_COLORS[error.category] || CATEGORY_COLORS.UnknownError;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-4">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border p-8 ${color}`}>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/80 dark:bg-neutral-800/80 shadow-sm">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{error.title}</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{error.message}</p>
          </div>

          <div className="mb-6 rounded-xl bg-white/60 dark:bg-neutral-800/60 p-4 text-sm">
            <p className="text-neutral-700 dark:text-neutral-300">{error.detail}</p>
            <p className="mt-3 flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error.action}
            </p>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mb-4 flex w-full items-center justify-between rounded-xl bg-neutral-200/60 dark:bg-neutral-700/60 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <span>Technical Details</span>
            <svg className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDetails && (
            <div className="mb-6 overflow-auto rounded-xl bg-neutral-900 dark:bg-black p-4 font-mono text-xs leading-relaxed">
              <p className="mb-1 text-neutral-400">Type: <span className="text-cyan-400">{error.type}</span></p>
              <p className="mb-1 text-neutral-400">Category: <span className="text-cyan-400">{error.category}</span></p>
              <p className="mb-1 text-neutral-400">Time: <span className="text-cyan-400">{new Date(error.timestamp).toLocaleString()}</span></p>
              <p className="mb-1 text-neutral-400">Message: <span className="text-yellow-400">{error.message}</span></p>
              <p className="mb-1 text-neutral-400">URL: <span className="text-yellow-400">{error.detail}</span></p>
              {error.stack && (
                <>
                  <p className="mb-1 mt-3 text-neutral-400">Stack:</p>
                  <pre className="whitespace-pre-wrap text-neutral-300">{error.stack}</pre>
                </>
              )}
              {error.componentStack && (
                <>
                  <p className="mb-1 mt-3 text-neutral-400">Component Stack:</p>
                  <pre className="whitespace-pre-wrap text-neutral-300">{error.componentStack}</pre>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3">
            {error.retryable && (
              <button
                onClick={() => { clearCriticalError(); try { sessionStorage.removeItem('coldfi:criticalError'); } catch {} window.location.href = window.location.origin; }}
                className="btn-primary flex-1"
              >
                Try Again
              </button>
            )}
            <button
              onClick={() => {
                clearCriticalError();
                try { sessionStorage.removeItem('coldfi:criticalError'); } catch {}
                navigate('/', { replace: true });
              }}
              className="btn-ghost flex-1"
            >
              Go Home
            </button>
          </div>
          <button
            onClick={(e) => {
              const text = `Error: ${error.title}\nType: ${error.type}\nCategory: ${error.category}\nTime: ${error.timestamp}\nMessage: ${error.message}\nURL: ${error.detail}\nStack:\n${error.stack || 'N/A'}`;
              navigator.clipboard.writeText(text).then(() => {
                const el = document.createElement('div');
                el.className = 'mt-3 text-xs text-center text-neutral-500 dark:text-neutral-400';
                el.textContent = 'Copied to clipboard';
                (e.target as HTMLElement)?.parentElement?.appendChild(el);
                setTimeout(() => el.remove(), 2000);
              }).catch(() => {});
            }}
            className="mt-3 w-full text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
          >
            Copy Error Details
          </button>
        </div>
      </div>
    </div>
  );
}
