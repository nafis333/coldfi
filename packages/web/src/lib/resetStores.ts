import { silentCatch } from './errorHandler';
const resetFns: Set<() => void> = new Set();

export function onLogout(fn: () => void): void {
  resetFns.add(fn);
}

export function resetAllStores(): void {
  for (const fn of resetFns) {
    try { fn(); } catch (err) { silentCatch('resetStores.resetAll', err); }
  }
}
