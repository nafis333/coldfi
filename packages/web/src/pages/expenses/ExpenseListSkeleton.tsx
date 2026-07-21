export default function ExpenseListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
        <div className="h-10 w-36 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <div className="h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-700" />
      <div className="rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-neutral-100 dark:border-neutral-700">
            <div className="h-10 w-10 rounded-xl bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-3 w-24 rounded bg-neutral-100 dark:bg-neutral-700" />
            </div>
            <div className="h-5 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
