export default function EmptyAnalyticsState() {
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-5 py-14 text-center">
      <svg className="mx-auto h-14 w-14 text-neutral-200 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="mt-4 text-base font-medium text-neutral-500 dark:text-neutral-400">No data for this period</p>
      <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
        Try a different time range or add some expenses
      </p>
    </div>
  );
}
