interface RecoveryCodeDisplayProps {
  code: string;
  onGoToDashboard: () => void;
}

export default function RecoveryCodeDisplay({ code, onGoToDashboard }: RecoveryCodeDisplayProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/30">
            <svg className="h-6 w-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 1112 3a9 9 0 017.364 4.636z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Save Your Recovery Code</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            This code is shown once. If you lose your password and cannot access your email, this is the only way to recover your account.
          </p>
          <div className="mt-6 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-4">
            <code className="select-all text-lg font-mono font-bold tracking-wider text-neutral-900 dark:text-white">
              {code}
            </code>
          </div>
          <p className="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
            Store this in a safe place (password manager, printed, or written down).
          </p>
          <button
            onClick={onGoToDashboard}
            className="btn-primary mt-6 w-full"
          >
            I've saved it — go to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
