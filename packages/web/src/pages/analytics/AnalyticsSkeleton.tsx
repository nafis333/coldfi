export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="flex gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-700">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 w-10 rounded-md bg-neutral-200 dark:bg-neutral-600" />)}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-7 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-3 w-20 rounded bg-neutral-100 dark:bg-neutral-700" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-56 rounded bg-neutral-100 dark:bg-neutral-700" />
        </div>
        <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 p-5 space-y-4">
          <div className="h-4 w-36 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
                  <div className="h-2 w-3/4 rounded bg-neutral-100 dark:bg-neutral-700" />
                </div>
                <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
