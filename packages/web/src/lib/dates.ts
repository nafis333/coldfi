export function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthBounds(now: Date = new Date()): { start: string; end: string } {
  return {
    start: localDateString(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: localDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}
