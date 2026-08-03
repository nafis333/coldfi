export function safeParseInt(val: string | undefined, fallback: number, min?: number): number {
  const n = parseInt(val ?? '', 10);
  if (isNaN(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  return n;
}
