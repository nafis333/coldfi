export function parseLocalDate(value: string | Date): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  }
  return typeof value === 'string' ? new Date(value) : value;
}

export function formatDate(date: string | Date, format: 'short' | 'long' | 'iso' = 'short', locale?: string): string {
  const d = parseLocalDate(date);
  const loc = locale ?? 'en-US';
  switch (format) {
    case 'short':
      return d.toLocaleDateString(loc, { month: '2-digit', day: '2-digit', year: 'numeric' });
    case 'long':
      return d.toLocaleDateString(loc, { month: 'long', day: 'numeric', year: 'numeric' });
    case 'iso': {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    default:
      return d.toISOString();
  }
}

export function parseDate(value: string): Date | null {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function getMonthRange(date: string | Date): { start: string; end: string } {
  const d = parseLocalDate(date);
  const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
  const end = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  return {
    start: start.toISOString().split('T')[0]!,
    end: end.toISOString().split('T')[0]!,
  };
}

export function isInPeriod(date: string, periodStart: string, periodEnd: string): boolean {
  const d = new Date(date);
  const s = new Date(periodStart);
  const e = new Date(periodEnd);
  const dUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const sUtc = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
  const eUtc = Date.UTC(e.getFullYear(), e.getMonth(), e.getDate()) + 86400000;
  return dUtc >= sUtc && dUtc < eUtc;
}

function toUTCDate(value: string | Date): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = toUTCDate(date1);
  const d2 = toUTCDate(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffMs / 86400000);
}
