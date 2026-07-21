import { formatCurrency, type DetailedBalance } from '@coldfi/shared';

interface Member {
  userId: string;
  displayName: string;
  email?: string;
}

interface BalanceOverviewSectionProps {
  balances: DetailedBalance[];
  members: Member[];
  currentUserId: string;
  defaultCurrency: string;
}

function memberName(members: Member[], userId: string): string {
  return members.find((m) => m.userId === userId)?.displayName || userId.slice(0, 8);
}

function WhoOwesWhom({ balances, members, currentUserId, defaultCurrency }: BalanceOverviewSectionProps) {
  if (!balances.some((b) => Object.keys(b.owesTo).length > 0 || Object.keys(b.owedBy).length > 0)) return null;

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Who Owes Whom</h3>
      <div className="space-y-1 divide-y divide-neutral-100 dark:divide-neutral-700/50">
        {balances.map((b) => (
          <div key={b.userId}>
            {Object.entries(b.owesTo).map(([toId, amt]) => (
              <div key={`${b.userId}-${toId}`} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2.5">
                  <span className={`text-sm font-medium ${b.userId === currentUserId ? 'text-danger-600 dark:text-danger-400' : 'text-neutral-700 dark:text-neutral-300'}`}>
                    {b.userId === currentUserId ? 'You' : memberName(members, b.userId)}
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-700/60">
                    <svg className="h-3 w-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {toId === currentUserId ? 'You' : memberName(members, toId)}
                  </span>
                </div>
                <span className="text-sm font-bold text-danger-600 dark:text-danger-400">
                  {formatCurrency(amt, defaultCurrency)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function NetBalanceList({ balances, members, currentUserId, defaultCurrency }: BalanceOverviewSectionProps) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-4">Net Balance</h3>
      <div className="space-y-2">
        {balances.map((b) => {
          const name = b.userId === currentUserId ? 'You' : memberName(members, b.userId);
          return (
            <div key={b.userId} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors">
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{name}</span>
              <span className={`text-sm font-bold ${
                b.net > 0 ? 'text-success-600 dark:text-success-400' :
                b.net < 0 ? 'text-danger-600 dark:text-danger-400' :
                'text-neutral-500'
              }`}>
                {b.net >= 0 ? '+' : ''}{formatCurrency(b.net, defaultCurrency)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BalanceOverviewSection(props: BalanceOverviewSectionProps) {
  return (
    <>
      <WhoOwesWhom {...props} />
      <NetBalanceList {...props} />
    </>
  );
}

export { WhoOwesWhom, NetBalanceList };
