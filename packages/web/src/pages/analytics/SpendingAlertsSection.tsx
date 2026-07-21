import { formatCurrency } from '@coldfi/shared';

interface SpendingAlert {
  categoryId: string;
  categoryName: string;
  severity: 'high' | 'medium' | 'low';
  percentOver: number;
  currentAmount: number;
  averageAmount: number;
}

interface SpendingAlertsSectionProps {
  spendingAlerts: SpendingAlert[];
  defaultCurrency: string;
  source: string;
}

export default function SpendingAlertsSection({ spendingAlerts, defaultCurrency, source }: SpendingAlertsSectionProps) {
  if (spendingAlerts.length === 0 || source === 'groups') return null;

  return (
    <div className="space-y-3">
      {spendingAlerts.map((alert) => (
        <div key={alert.categoryId} className={`rounded-2xl border p-4 ${
          alert.severity === 'high'
            ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-700'
            : alert.severity === 'medium'
              ? 'bg-warning-50 dark:bg-amber-900/20 border-warning-200 dark:border-amber-700'
              : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              alert.severity === 'high'
                ? 'bg-danger-100 dark:bg-danger-800/40 text-danger-600 dark:text-danger-400'
                : alert.severity === 'medium'
                  ? 'bg-warning-100 dark:bg-amber-800/40 text-warning-600 dark:text-amber-400'
                  : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-300'
            }`}>
              {alert.severity === 'high' || alert.severity === 'medium' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                {alert.categoryName} spending is {alert.percentOver.toFixed(0)}% above average
              </p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                {formatCurrency(alert.currentAmount, defaultCurrency)} this period vs {formatCurrency(alert.averageAmount, defaultCurrency)} average
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
