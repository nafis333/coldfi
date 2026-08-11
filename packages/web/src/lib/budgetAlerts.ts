import { apiClient } from './apiClient';
import { useAuthStore } from '../stores/authStore';
import { silentCatch } from './errorHandler';
import type { BudgetStatusResult } from '@coldfi/shared';
import type { Budget } from './personalSync';

const ALL_LABEL = 'All Categories';

function categoryLabel(budgets: Budget[], categoryId: string, categoryNames: Record<string, string>): string {
  if (categoryId === '__all__') return ALL_LABEL;
  return categoryNames[categoryId] || categoryId;
}

// Fires one in-app + browser push notification per budget that just crossed
// its alert threshold or went over budget. Only forward transitions alert
// (a delete that brings spending back down never re-alerts).
export async function fireBudgetAlerts(
  budgets: Budget[],
  categoryNames: Record<string, string>,
  prevStatuses: BudgetStatusResult[],
  nextStatuses: BudgetStatusResult[]
): Promise<void> {
  if (!useAuthStore.getState().accessToken) return;

  const prevByBudget = new Map(prevStatuses.map((s) => [s.budgetId, s]));
  const budgetById = new Map(budgets.map((b) => [b.id, b]));

  for (const next of nextStatuses) {
    const before = prevByBudget.get(next.budgetId);
    if (!before) continue;
    const prevPercent = before.percentUsed;
    const nextPercent = next.percentUsed;
    if (nextPercent <= prevPercent) continue;

    const budget = budgetById.get(next.budgetId);
    const threshold = budget?.alertThreshold ?? 80;
    const label = categoryLabel(budgets, next.categoryId, categoryNames);
    const currency = budget?.currency;

    const crossed = prevPercent < threshold && nextPercent >= threshold && nextPercent < 100;
    const exceeded = prevPercent < 100 && nextPercent >= 100;

    if (!crossed && !exceeded) continue;

    if (crossed) {
      await postAlert(
        'budget_threshold',
        `Budget almost reached: ${label}`,
        `You've used ${Math.round(nextPercent)}% of your ${label} budget${currency ? ` (${currency})` : ''}.`
      );
    }
    if (exceeded) {
      await postAlert(
        'budget_exceeded',
        `Budget exceeded: ${label}`,
        `Spending on ${label} is past the budget${currency ? ` (${currency})` : ''}.`
      );
    }
  }
}

async function postAlert(type: string, title: string, body: string): Promise<void> {
  try {
    await apiClient('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, body, push: true, pushCategory: 'budget_alert' }),
    });
  } catch (err) {
    silentCatch('budgetAlerts.post', err);
  }
}
