import { formatCurrency, type DetailedBalance } from '@coldfi/shared';

interface InvoiceSummaryCardsProps {
  totalSpent: number;
  expenseCount: number;
  currentBalance: DetailedBalance | undefined;
  defaultCurrency: string;
}

function StatCard({ icon, label, value, colorClass, bgClass }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; colorClass: string; bgClass: string;
}) {
  return (
    <div className="card p-5 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${bgClass} rounded-bl-full`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colorClass}`}>
            {icon}
          </div>
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</span>
        </div>
        {value}
      </div>
    </div>
  );
}

const currencyIcon = (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

export default function InvoiceSummaryCards({ totalSpent, expenseCount, currentBalance, defaultCurrency }: InvoiceSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        icon={currencyIcon}
        label="Total Spent"
        colorClass="bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
        bgClass="bg-primary-50 dark:bg-primary-900/20"
        value={<><p className="mt-2 text-2xl font-bold text-neutral-900 dark:text-white">{formatCurrency(totalSpent, defaultCurrency)}</p><p className="mt-0.5 text-xs text-neutral-400">{expenseCount} expenses</p></>}
      />
      {currentBalance && (
        <>
          <StatCard
            icon={currencyIcon}
            label="You are Owed"
            colorClass="bg-success-100 dark:bg-success-900/40 text-success-600 dark:text-success-400"
            bgClass="bg-success-50 dark:bg-success-900/20"
            value={<p className={`mt-2 text-2xl font-bold ${Object.values(currentBalance.owedBy).reduce((s, a) => s + a, 0) > 0 ? 'text-success-600 dark:text-success-400' : 'text-neutral-900 dark:text-white'}`}>
              {formatCurrency(Object.values(currentBalance.owedBy).reduce((s, a) => s + a, 0), defaultCurrency)}
            </p>}
          />
          <StatCard
            icon={currencyIcon}
            label="You Owe"
            colorClass="bg-danger-100 dark:bg-danger-900/40 text-danger-600 dark:text-danger-400"
            bgClass="bg-danger-50 dark:bg-danger-900/20"
            value={<p className={`mt-2 text-2xl font-bold ${Object.values(currentBalance.owesTo).reduce((s, a) => s + a, 0) > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-neutral-900 dark:text-white'}`}>
              {formatCurrency(Object.values(currentBalance.owesTo).reduce((s, a) => s + a, 0), defaultCurrency)}
            </p>}
          />
        </>
      )}
    </div>
  );
}
