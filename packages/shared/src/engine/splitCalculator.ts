import { ItemizedItem } from '../types/group';
import { SplitMode } from '../types/enums';

export interface SplitResult {
  memberId: string;
  amount: number;
  ratio: number;
}

export interface SplitWarning {
  type: 'ratio_normalized' | 'fixed_scaled' | 'fixed_negative' | 'itemized_scaled';
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

  if (memberIds.length === 0 || !(totalAmount > 0)) {
    const warnings: SplitWarning[] = [];
    if (totalAmount < 0) {
      warnings.push({ type: 'fixed_scaled', message: `Negative total amount (${totalAmount}) rejected` });
    }
    return { splits: [], warnings };
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
    const rawRatio = entry[1];
    const ratio = Math.max(0, rawRatio);
    const isLast = i === entries.length - 1;
    const rawAmount = isLast ? totalAmount - allocated : totalAmount * ratio;
    const amount = Math.round(rawAmount * 100) / 100;
    if (rawRatio < 0) {
      warnings.push({
        type: 'ratio_normalized',
        message: `Negative ratio for ${memberId}, clamped to 0`,
      });
    }
    allocated += Math.max(0, amount);
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

  const warnings: SplitWarning[] = [];
  const safeFixed: Record<string, number> = {};
  for (const id of memberIds) {
    const raw = fixedAmounts[id] ?? 0;
    if (raw < 0) {
      safeFixed[id] = 0;
      warnings.push({
        type: 'fixed_negative',
        message: `Negative fixed amount for ${id} (${raw}), clamped to 0`,
      });
    } else {
      safeFixed[id] = raw;
    }
  }

  const specifiedTotal = memberIds.reduce((s, id) => s + safeFixed[id]!, 0);
  if (specifiedTotal <= 0) {
    return calculateRatioSplits(totalAmount, memberIds);
  }

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
    const rawAmount = safeFixed[memberId]!;
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
    const validAssignees = item.assignedTo.filter((id) => memberIds.includes(id));
    const distributeEqual = (targets: string[]) => {
      const perPerson = targets.length > 0 ? scaledAmount / targets.length : 0;
      for (const id of targets) {
        amounts[id] = (amounts[id] ?? 0) + perPerson;
      }
    };

    if (item.splitMode === 'exact' && item.splitAmounts) {
      const specifiedTotal = validAssignees.reduce((s, id) => s + (item.splitAmounts?.[id] ?? 0), 0);
      if (specifiedTotal <= 0) {
        distributeEqual(validAssignees.length > 0 ? validAssignees : memberIds);
        continue;
      }
      const itemScale = scaledAmount / specifiedTotal;
      for (const id of validAssignees) {
        const raw = Math.max(0, item.splitAmounts[id] ?? 0);
        amounts[id] = (amounts[id] ?? 0) + raw * itemScale;
      }
    } else if (item.splitMode === 'percentage' && item.splitAmounts) {
      const totalPct = validAssignees.reduce((s, id) => s + (item.splitAmounts?.[id] ?? 0), 0);
      if (totalPct <= 0) {
        distributeEqual(validAssignees.length > 0 ? validAssignees : memberIds);
        continue;
      }
      for (const id of validAssignees) {
        const pct = Math.max(0, item.splitAmounts[id] ?? 0);
        const share = (scaledAmount * pct) / totalPct;
        amounts[id] = (amounts[id] ?? 0) + share;
      }
    } else if (validAssignees.length === 0) {
      distributeEqual(memberIds);
    } else if (validAssignees.length === 1) {
      amounts[validAssignees[0]!] = (amounts[validAssignees[0]!] ?? 0) + scaledAmount;
    } else {
      distributeEqual(validAssignees);
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
    const filtered: Record<string, number> = {};
    for (const [id, r] of Object.entries(ratios)) {
      if (memberIds.includes(id)) filtered[id] = r;
    }

    const missingCount = memberIds.filter(id => !(id in filtered)).length;
    const hasMissing = missingCount > 0;
    if (hasMissing) {
      const specifiedTotal = Object.values(filtered).reduce((s, r) => s + r, 0);
      if (specifiedTotal > 0) {
        const avgWeight = specifiedTotal / Object.keys(filtered).length;
        const result: Record<string, number> = { ...filtered };
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
      return equalRatiosFor(memberIds);
    }

    let total = Object.values(filtered).reduce((s, r) => s + r, 0);
    if (total > 0 && Math.abs(total - 1) > 0.001) {
      const normalized: Record<string, number> = {};
      for (const [id, ratio] of Object.entries(filtered)) {
        normalized[id] = ratio / total;
      }
      return normalized;
    }
    if (total > 0) {
      return { ...filtered };
    }
    return equalRatiosFor(memberIds);
  }

  return equalRatiosFor(memberIds);
}

function equalRatiosFor(memberIds: string[]): Record<string, number> {
  const equalRatio = 1 / memberIds.length;
  const result: Record<string, number> = {};
  for (const id of memberIds) {
    result[id] = equalRatio;
  }
  return result;
}
