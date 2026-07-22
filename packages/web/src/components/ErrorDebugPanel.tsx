import { useErrorStore } from '../stores/errorStore';

export default function ErrorDebugPanel() {
  const errors = useErrorStore((s) => s.errors);
  const isOpen = useErrorStore((s) => s.isDebugPanelOpen);
  const toggle = useErrorStore((s) => s.toggleDebugPanel);
  const viewError = useErrorStore((s) => s.viewError);
  const clearErrors = useErrorStore((s) => s.clearErrors);

  if (errors.length === 0 && !isOpen) return null;

  return (
    <>
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-white shadow-lg hover:bg-neutral-700 transition-colors"
        title="Error History"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {errors.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {errors.length > 99 ? '99+' : errors.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-96 max-h-[70vh] overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
              Error History ({errors.length})
            </h3>
            <div className="flex items-center gap-2">
              {errors.length > 0 && (
                <button onClick={clearErrors} className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  Clear
                </button>
              )}
              <button onClick={toggle} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {errors.length === 0 ? (
              <p className="p-6 text-center text-sm text-neutral-400">No errors recorded.</p>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {errors.map((err) => (
                  <button
                    key={err.id}
                    onClick={() => viewError(err.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                        <svg className="h-3 w-3 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                        {err.type}
                      </p>
                      <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                        {err.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                        {new Date(err.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <svg className="mt-1 h-3 w-3 shrink-0 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
