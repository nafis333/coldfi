import { ExpenseSplit, ItemizedItem } from '../types/group';
import { SplitMode } from '../types/enums';

export interface SplitResult {
  memberId: string;
  amount: number;
  ratio: number;
}

export interface SplitWarning {
  type: 'ratio_normalized' | 'fixed_scaled' | 'itemized_scaled';
  message: string;
}

export interface CalculateSplitsResult {
  splits: SplitResult[];
  warnings: SplitWarning[];
}

export interface CalculateSplitsOptions {
  totalAmount: number;
  splitMode: SplitMode;
  memberIds: string[];
  ratios?: Record<string, number>;
  fixedAmounts?: Record<string, number>;
  itemizedItems?: ItemizedItem[];
}

export function calculateSplits(options: CalculateSplitsOptions): CalculateSplitsResult {
  const { totalAmount, splitMode, memberIds } = options;

  switch (splitMode) {
    case SplitMode.RATIO:
      return calculateRatioSplits(totalAmount, memberIds, options.ratios);
    case SplitMode.FIXED:
      return calculateFixedSplits(totalAmount, memberIds, options.fixedAmounts);
    default:
      if (options.itemizedItems && options.itemizedItems.length > 0) {
        return calculateItemizedSplits(totalAmount, memberIds, options.itemizedItems);
      }
      return calculateRatioSplits(totalAmount, memberIds, options.ratios);
  }
}

function calculateRatioSplits(
  totalAmount: number,
  memberIds: string[],
  ratios?: Record<string, number>
): CalculateSplitsResult {
  const effectiveRatios = buildEqualRatios(memberIds, ratios);
  const results: SplitResult[] = [];
  const warnings: SplitWarning[] = [];

  if (ratios && Object.keys(ratios).length > 0) {
    const total = Object.values(ratios).reduce((s, r) => s + r, 0);
    if (Math.abs(total - 1) > 0.001) {
      warnings.push({
        type: 'ratio_normalized',
        message: `Ratios sum to ${total}, normalized to 1.0`,
      });
    }
  }

  let allocated = 0;
  const entries = Object.entries(effectiveRatios);
  const lastIndex = entries.length - 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const memberId = entry[0];
    const ratio = entry[1];
    if (i === lastIndex) {
      results.push({
        memberId,
        amount: Math.round((totalAmount - allocated) * 100) / 100,
        ratio,
      });
    } else {
      const amount = Math.round(totalAmount * ratio * 100) / 100;
      allocated += amount;
      results.push({ memberId, amount, ratio });
    }
  }

  return { splits: results, warnings };
}

function calculateFixedSplits(
  totalAmount: number,
  memberIds: string[],
  fixedAmounts?: Record<string, number>
): CalculateSplitsResult {
  if (!fixedAmounts) {
    return calculateRatioSplits(totalAmount, memberIds);
  }

  const specifiedTotal = Object.values(fixedAmounts).reduce((s, a) => s + a, 0);
  const warnings: SplitWarning[] = [];
  const scaleFactor = Math.abs(specifiedTotal - totalAmount) < 0.01
    ? 1
    : totalAmount / specifiedTotal;

  if (Math.abs(scaleFactor - 1) > 0.001) {
    warnings.push({
      type: 'fixed_scaled',
      message: `Fixed amounts total ${specifiedTotal}, auto-scaled by ${scaleFactor.toFixed(4)} to match expense total ${totalAmount}`,
    });
  }

  const results: SplitResult[] = [];
  let allocated = 0;
  const lastIndex = memberIds.length - 1;

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    const rawAmount = fixedAmounts[memberId] ?? 0;
    const scaledAmount = rawAmount * scaleFactor;

    if (i === lastIndex) {
      const amount = Math.round((totalAmount - allocated) * 100) / 100;
      results.push({
        memberId,
        amount,
        ratio: amount / totalAmount,
      });
    } else {
      const amount = Math.round(scaledAmount * 100) / 100;
      allocated += amount;
      results.push({
        memberId,
        amount,
        ratio: amount / totalAmount,
      });
    }
  }

  return { splits: results, warnings };
}

function calculateItemizedSplits(
  totalAmount: number,
  memberIds: string[],
  items: ItemizedItem[]
): CalculateSplitsResult {
  const amounts: Record<string, number> = {};
  for (const id of memberIds) {
    amounts[id] = 0;
  }

  const itemsTotal = items.reduce((s, item) => s + item.amount, 0);
  const warnings: SplitWarning[] = [];
  const scaleFactor = Math.abs(itemsTotal - totalAmount) < 0.01
    ? 1
    : totalAmount / itemsTotal;

  if (Math.abs(scaleFactor - 1) > 0.001) {
    warnings.push({
      type: 'itemized_scaled',
      message: `Itemized items total ${itemsTotal}, auto-scaled by ${scaleFactor.toFixed(4)} to match expense total ${totalAmount}`,
    });
  }

  for (const item of items) {
    const scaledAmount = item.amount * scaleFactor;

    if (item.assignedTo.length === 0) {
      const perMember = scaledAmount / memberIds.length;
      for (const id of memberIds) {
        amounts[id] = (amounts[id] ?? 0) + perMember;
      }
    } else if (item.assignedTo.length === 1) {
      amounts[item.assignedTo[0]!] = (amounts[item.assignedTo[0]!] ?? 0) + scaledAmount;
    } else {
      const perPerson = scaledAmount / item.assignedTo.length;
      for (const id of item.assignedTo) {
        amounts[id] = (amounts[id] ?? 0) + perPerson;
      }
    }
  }

  const results: SplitResult[] = [];
  let allocated = 0;
  const lastIndex = memberIds.length - 1;

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    if (i === lastIndex) {
      const amount = Math.round((totalAmount - allocated) * 100) / 100;
      results.push({
        memberId,
        amount,
        ratio: amount / totalAmount,
      });
    } else {
      const amount = Math.round((amounts[memberId] ?? 0) * 100) / 100;
      allocated += amount;
      results.push({
        memberId,
        amount,
        ratio: amount / totalAmount,
      });
    }
  }

  return { splits: results, warnings };
}

function buildEqualRatios(
  memberIds: string[],
  ratios?: Record<string, number>
): Record<string, number> {
  if (ratios && Object.keys(ratios).length > 0) {
    const total = Object.values(ratios).reduce((s, r) => s + r, 0);
    if (Math.abs(total - 1) > 0.001) {
      const normalized: Record<string, number> = {};
      for (const [id, ratio] of Object.entries(ratios)) {
        normalized[id] = ratio / total;
      }
      return normalized;
    }
    return { ...ratios };
  }

  const equalRatio = 1 / memberIds.length;
  const result: Record<string, number> = {};
  for (const id of memberIds) {
    result[id] = equalRatio;
  }
  return result;
}
