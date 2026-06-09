import type { PersonalExpense } from '../types/personal';

export interface SpendingAlert {
  categoryId: string;
  categoryName: string;
  currentAmount: number;
  averageAmount: number;
  percentOver: number;
  severity: 'low' | 'medium' | 'high';
}

export interface CategorySpendingTrend {
  categoryId: string;
  categoryName: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  percentChange: number;
  currentPeriodTotal: number;
  previousPeriodTotal: number;
}

function groupByCategory(
  expenses: PersonalExpense[],
  start: Date,
  end: Date
): Map<string, number> {
  const map = new Map<string, number>();
  for (const exp of expenses) {
    const d = new Date(exp.date);
    if (d >= start && d < end) {
      map.set(exp.categoryId, (map.get(exp.categoryId) ?? 0) + exp.amount);
    }
  }
  return map;
}

function getPeriodRanges(
  currentDate: Date,
  periods: number,
  periodDays: number
): { start: Date; end: Date }[] {
  const ranges: { start: Date; end: Date }[] = [];
  for (let i = 0; i < periods; i++) {
    const end = new Date(currentDate);
    end.setDate(end.getDate() - i * periodDays);
    const start = new Date(end);
    start.setDate(start.getDate() - periodDays);
    ranges.push({ start, end });
  }
  return ranges;
}

export function detectUnusualSpending(
  expenses: PersonalExpense[],
  categoryNames: Record<string, string>,
  options: {
    lookbackPeriods?: number;
    periodDays?: number;
    lowThreshold?: number;
    mediumThreshold?: number;
    highThreshold?: number;
    currentDate?: Date;
  } = {}
): SpendingAlert[] {
  const {
    lookbackPeriods = 3,
    periodDays = 30,
    lowThreshold = 1.2,
    mediumThreshold = 1.5,
    highThreshold = 2.0,
    currentDate = new Date(),
  } = options;

  const ranges = getPeriodRanges(currentDate, lookbackPeriods + 1, periodDays);
  const currentRange = ranges[0]!;
  const historicalRanges = ranges.slice(1);

  const currentSpend = groupByCategory(expenses, currentRange.start, currentRange.end);

  const historicalSpend = new Map<string, number[]>();
  for (const range of historicalRanges) {
    const spend = groupByCategory(expenses, range.start, range.end);
    for (const [catId, amount] of spend) {
      if (!historicalSpend.has(catId)) {
        historicalSpend.set(catId, []);
      }
      historicalSpend.get(catId)!.push(amount);
    }
  }

  const alerts: SpendingAlert[] = [];

  for (const [categoryId, currentAmount] of currentSpend) {
    const history = historicalSpend.get(categoryId);
    if (!history || history.length === 0) continue;

    const averageAmount = history.reduce((a, b) => a + b, 0) / history.length;
    if (averageAmount === 0 && currentAmount > 0) {
      alerts.push({
        categoryId,
        categoryName: categoryNames[categoryId] ?? categoryId,
        currentAmount,
        averageAmount,
        percentOver: 999_999.99,
        severity: 'medium',
      });
      continue;
    }

    if (averageAmount === 0) continue;

    const ratio = currentAmount / averageAmount;

    if (ratio >= highThreshold) {
      alerts.push({
        categoryId,
        categoryName: categoryNames[categoryId] ?? categoryId,
        currentAmount,
        averageAmount,
        percentOver: Math.round((ratio - 1) * 100),
        severity: 'high',
      });
    } else if (ratio >= mediumThreshold) {
      alerts.push({
        categoryId,
        categoryName: categoryNames[categoryId] ?? categoryId,
        currentAmount,
        averageAmount,
        percentOver: Math.round((ratio - 1) * 100),
        severity: 'medium',
      });
    } else if (ratio >= lowThreshold) {
      alerts.push({
        categoryId,
        categoryName: categoryNames[categoryId] ?? categoryId,
        currentAmount,
        averageAmount,
        percentOver: Math.round((ratio - 1) * 100),
        severity: 'low',
      });
    }
  }

  return alerts.sort((a, b) => b.percentOver - a.percentOver);
}

export function getSpendingTrend(
  expenses: PersonalExpense[],
  categoryNames: Record<string, string>,
  options: {
    periods?: number;
    periodDays?: number;
    stableThreshold?: number;
    currentDate?: Date;
  } = {}
): CategorySpendingTrend[] {
  const {
    periods = 4,
    periodDays = 30,
    stableThreshold = 5,
    currentDate = new Date(),
  } = options;

  const ranges = getPeriodRanges(currentDate, periods, periodDays);

  const periodSpends: Map<string, number>[] = ranges.map((range) =>
    groupByCategory(expenses, range.start, range.end)
  );

  const allCategories = new Set<string>();
  for (const spend of periodSpends) {
    for (const catId of spend.keys()) {
      allCategories.add(catId);
    }
  }

  const trends: CategorySpendingTrend[] = [];

  for (const categoryId of allCategories) {
    const amounts = periodSpends.map((s) => s.get(categoryId) ?? 0);
    const currentPeriodTotal = amounts[0]!;

    if (amounts.length < 2) continue;

    // Use the average of all historical periods for comparison
    const historicalAmounts = amounts.slice(1);
    const previousPeriodTotal = historicalAmounts.reduce((a, b) => a + b, 0) / historicalAmounts.length;

    let direction: 'increasing' | 'decreasing' | 'stable';
    let percentChange: number;

    if (previousPeriodTotal === 0 && currentPeriodTotal === 0) {
      direction = 'stable';
      percentChange = 0;
    } else if (previousPeriodTotal === 0) {
      direction = 'increasing';
      percentChange = 100;
    } else {
      percentChange = Math.round(
        ((currentPeriodTotal - previousPeriodTotal) / previousPeriodTotal) * 100
      );
      if (Math.abs(percentChange) <= stableThreshold) {
        direction = 'stable';
      } else if (percentChange > 0) {
        direction = 'increasing';
      } else {
        direction = 'decreasing';
      }
    }

    trends.push({
      categoryId,
      categoryName: categoryNames[categoryId] ?? categoryId,
      direction,
      percentChange,
      currentPeriodTotal,
      previousPeriodTotal: Math.round(previousPeriodTotal * 100) / 100,
    });
  }

  return trends.sort(
    (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
  );
}
