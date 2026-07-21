interface ExpensePaginationProps {
  safePage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function ExpensePagination({ safePage, totalPages, onPageChange }: ExpensePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="card flex items-center justify-between px-4 py-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">Page {safePage} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage <= 1} className="btn-secondary text-sm px-3">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) { pageNum = i + 1; }
            else if (safePage <= 3) { pageNum = i + 1; }
            else if (safePage >= totalPages - 2) { pageNum = totalPages - 4 + i; }
            else { pageNum = safePage - 2 + i; }
            return (
              <button key={pageNum} onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${pageNum === safePage ? 'bg-primary-600 text-white' : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}>
                {pageNum}
              </button>
            );
          })}
        </div>
        <button onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} className="btn-secondary text-sm px-3">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}
