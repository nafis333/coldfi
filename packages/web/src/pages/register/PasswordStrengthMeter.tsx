import { useMemo } from 'react';

interface PasswordStrengthMeterProps {
  password: string;
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const COLORS = ['', 'bg-danger-500', 'bg-warning-500', 'bg-primary-500', 'bg-success-500'];

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/(?=.*[a-z])/.test(password)) score++;
    if (/(?=.*[A-Z])/.test(password)) score++;
    if (/(?=.*\d)/.test(password)) score++;
    if (/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) score++;
    return Math.min(score, 4);
  }, [password]);

  const label = LABELS[strength] || '';
  const color = COLORS[strength] || '';

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= strength ? color : 'bg-neutral-200 dark:bg-neutral-600'}`} />
        ))}
      </div>
      <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{label}</p>
    </div>
  );
}
