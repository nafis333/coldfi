import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAnalyticsStore } from '../../stores/analyticsStore';

interface MonthlyRecap {
  month: string;
  totalSpent: number;
  topCategory: { name: string; amount: number };
  biggestExpense: { description: string; amount: number };
  savingsRate: number;
}

export default function RecapsPage() {
  const { recaps, fetchRecap, isLoading } = useAnalyticsStore();
  const recapRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );

  useEffect(() => { fetchRecap(selectedMonth); }, [fetchRecap, selectedMonth]);

  const currentRecap: MonthlyRecap | undefined = useMemo(
    () => recaps.find((r: MonthlyRecap) => r.month === selectedMonth),
    [recaps, selectedMonth]
  );

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchRecap(newMonth);
  };

  const handleShareAsImage = useCallback(async () => {
    if (!recapRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(recapRef.current);
      const link = document.createElement('a');
      link.download = `recap-${selectedMonth}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch {
      // html2canvas failed silently
    }
  }, [selectedMonth]);

  if (!currentRecap && !isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 text-center">
        <p className="mb-2 text-lg font-bold text-neutral-900">No Recap Available</p>
        <p className="mb-4 text-sm text-neutral-500">Select a month to view your recap.</p>
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="input-field"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Monthly Recap</h1>
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : currentRecap ? (
        <>
          <div
            ref={recapRef}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <p className="mb-1 text-3xl font-bold text-neutral-900">
              ${currentRecap.totalSpent.toFixed(2)}
            </p>
            <p className="mb-6 text-sm text-neutral-500">Total spent in {selectedMonth}</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-primary-50 p-4">
                <p className="mb-1 text-xs text-neutral-500">Top Category</p>
                <p className="text-lg font-bold text-neutral-900">{currentRecap.topCategory.name}</p>
                <p className="text-sm text-neutral-600">
                  ${currentRecap.topCategory.amount.toFixed(2)}
                </p>
              </div>
              <div className="rounded-xl bg-warning-50 p-4">
                <p className="mb-1 text-xs text-neutral-500">Savings Rate</p>
                <p className="text-lg font-bold text-neutral-900">
                  {currentRecap.savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-neutral-50 p-4">
              <p className="mb-1 text-xs text-neutral-500">Biggest Expense</p>
              <p className="text-base font-bold text-neutral-900">
                {currentRecap.biggestExpense.description}
              </p>
              <p className="text-sm text-neutral-600">
                ${currentRecap.biggestExpense.amount.toFixed(2)}
              </p>
            </div>
          </div>

          <button
            onClick={handleShareAsImage}
            className="mt-4 w-full rounded-xl bg-primary-600 py-3 font-bold text-white transition-colors hover:bg-primary-700"
          >
            Download as Image
          </button>
        </>
      ) : null}
    </div>
  );
}
