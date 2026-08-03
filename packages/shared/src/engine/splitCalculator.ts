import { ItemizedItem } from '../types/group';
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

  if (memberIds.length === 0 || totalAmount <= 0) {
    return { splits: [], warnings: [] };
  }

  // Reject negative amounts — they'd produce mathematically wrong splits
  if (totalAmount < 0) {
    return { splits: [], warnings: [{ type: 'fixed_scaled', message: `Negative total amount (${totalAmount}) rejected` }] };
  }

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

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const memberId = entry[0];
    const ratio = entry[1];
    const isLast = i === entries.length - 1;
    const rawAmount = isLast ? totalAmount - allocated : totalAmount * ratio;
    const amount = Math.round(rawAmount * 100) / 100;
    if (amount < 0) {
      warnings.push({
        type: 'ratio_normalized',
        message: `Rounding produced negative amount for ${memberId}, clamped to 0`,
      });
    }
    allocated += amount;
    results.push({
      memberId,
      amount: Math.max(0, amount),
      ratio,
    });
  }

  if (Math.abs(allocated - totalAmount) > 0.01) {
    const diff = Math.round((totalAmount - allocated) * 100);
    for (let i = results.length - 1; i >= 0 && results.length - 1 - i < Math.abs(diff); i--) {
      const adjustment = diff > 0 ? 0.01 : -0.01;
      const newAmount = Math.max(0, Math.round((results[i]!.amount + adjustment) * 100) / 100);
      allocated += newAmount - results[i]!.amount;
      results[i]!.amount = newAmount;
    }
  }

  return { splits: results, warnings };
}

function calculateFixedSplits(
  totalAmount: number,
  memberIds: string[],
  fixedAmounts?: Record<string, number>
): CalculateSplitsResult {
  if (!fixedAmounts || memberIds.length === 0) {
    return calculateRatioSplits(totalAmount, memberIds);
  }

  const specifiedTotal = Object.values(fixedAmounts).reduce((s, a) => s + a, 0);
  if (specifiedTotal <= 0) {
    return calculateRatioSplits(totalAmount, memberIds);
  }

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

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    const rawAmount = fixedAmounts[memberId] ?? 0;
    const scaledAmount = rawAmount * scaleFactor;
    const isLast = i === memberIds.length - 1;
    const amount = Math.round((isLast ? totalAmount - allocated : scaledAmount) * 100) / 100;
    allocated += amount;
    results.push({
      memberId,
      amount: Math.max(0, amount),
      ratio: totalAmount > 0 ? amount / totalAmount : 0,
    });
  }

  if (Math.abs(allocated - totalAmount) > 0.01) {
    const diff = Math.round((totalAmount - allocated) * 100);
    for (let i = results.length - 1; i >= 0 && results.length - 1 - i < Math.abs(diff); i--) {
      const adjustment = diff > 0 ? 0.01 : -0.01;
      const newAmount = Math.max(0, Math.round((results[i]!.amount + adjustment) * 100) / 100);
      allocated += newAmount - results[i]!.amount;
      results[i]!.amount = newAmount;
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
  if (itemsTotal === 0) {
    warnings.push({
      type: 'itemized_scaled',
      message: `Itemized items total is 0, falling back to equal split`,
    });
    return calculateRatioSplits(totalAmount, memberIds);
  }
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

    if (item.splitMode === 'exact' && item.splitAmounts) {
      const specifiedTotal = Object.values(item.splitAmounts).reduce((s, v) => s + v, 0);
      const itemScale = specifiedTotal > 0 ? scaledAmount / specifiedTotal : 1;
      for (const id of item.assignedTo) {
        const raw = item.splitAmounts[id] ?? 0;
        amounts[id] = (amounts[id] ?? 0) + raw * itemScale;
      }
    } else if (item.splitMode === 'percentage' && item.splitAmounts) {
      const totalPct = Object.values(item.splitAmounts).reduce((s, v) => s + v, 0);
      for (const id of item.assignedTo) {
        const pct = item.splitAmounts[id] ?? 0;
        const share = totalPct > 0 ? (scaledAmount * pct) / totalPct : 0;
        amounts[id] = (amounts[id] ?? 0) + share;
      }
    } else if (item.assignedTo.length === 0) {
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

  for (let i = 0; i < memberIds.length; i++) {
    const memberId = memberIds[i]!;
    const isLast = i === memberIds.length - 1;
    const rawAmount = isLast ? totalAmount - allocated : (amounts[memberId] ?? 0);
    const amount = Math.round(rawAmount * 100) / 100;
    allocated += amount;
    results.push({
      memberId,
      amount: Math.max(0, amount),
      ratio: totalAmount > 0 ? amount / totalAmount : 0,
    });
  }

  if (Math.abs(allocated - totalAmount) > 0.01) {
    const diff = Math.round((totalAmount - allocated) * 100);
    for (let i = results.length - 1; i >= 0 && results.length - 1 - i < Math.abs(diff); i--) {
      const adjustment = diff > 0 ? 0.01 : -0.01;
      const newAmount = Math.max(0, Math.round((results[i]!.amount + adjustment) * 100) / 100);
      allocated += newAmount - results[i]!.amount;
      results[i]!.amount = newAmount;
    }
  }

  return { splits: results, warnings };
}

function buildEqualRatios(
  memberIds: string[],
  ratios?: Record<string, number>
): Record<string, number> {
  if (memberIds.length === 0) return {};

  if (ratios && Object.keys(ratios).length > 0) {
    const missingCount = memberIds.filter(id => !(id in ratios)).length;
    const hasMissing = missingCount > 0;
    if (hasMissing) {
      const specifiedTotal = Object.values(ratios).reduce((s, r) => s + r, 0);
      const avgWeight = specifiedTotal / Object.keys(ratios).length;
      const result: Record<string, number> = { ...ratios };
      for (const id of memberIds) {
        if (!(id in result)) {
          result[id] = avgWeight;
        }
      }
      const grandTotal = Object.values(result).reduce((s, r) => s + r, 0);
      for (const id of Object.keys(result)) {
        result[id]! /= grandTotal;
      }
      return result;
    }
    let total = Object.values(ratios).reduce((s, r) => s + r, 0);
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
