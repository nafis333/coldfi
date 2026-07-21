export function safeParseInt(val: string | undefined, fallback: number): number {
  const n = parseInt(val ?? '', 10);
  return isNaN(n) ? fallback : n;
}
