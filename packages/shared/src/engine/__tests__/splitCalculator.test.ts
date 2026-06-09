import { describe, it, expect } from 'vitest';
import { calculateSplits } from '../splitCalculator';
import { SplitMode } from '../../types/enums';

describe('calculateSplits', () => {
  it('should split equally by default in ratio mode', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b', 'c'],
    });

    expect(splits).toHaveLength(3);
    const total = splits.reduce((s: number, r) => s + r.amount, 0);
    expect(total).toBe(100);
    splits.forEach((r) => expect(r.ratio).toBeCloseTo(1 / 3));
  });

  it('should split by custom ratios', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b'],
      ratios: { a: 0.3, b: 0.7 },
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(30);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(70);
  });

  it('should handle fixed mode with exact amounts', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.FIXED,
      memberIds: ['a', 'b'],
      fixedAmounts: { a: 40, b: 60 },
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(40);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(60);
  });

  it('should scale fixed amounts when they do not match total', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.FIXED,
      memberIds: ['a', 'b'],
      fixedAmounts: { a: 20, b: 30 },
    });

    const total = splits.reduce((s: number, r) => s + r.amount, 0);
    expect(total).toBe(100);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('fixed_scaled');
  });

  it('should handle itemized items with shared items', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b'],
      itemizedItems: [
        { id: '1', name: 'Pizza', amount: 60, assignedTo: ['a', 'b'] },
        { id: '2', name: 'Drink A', amount: 20, assignedTo: ['a'] },
        { id: '3', name: 'Drink B', amount: 20, assignedTo: ['b'] },
      ],
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(50);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(50);
  });

  it('should handle itemized items with personal items', () => {
    const { splits } = calculateSplits({
      totalAmount: 80,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b'],
      itemizedItems: [
        { id: '1', name: 'Shared appetizer', amount: 40, assignedTo: ['a', 'b'] },
        { id: '2', name: 'A dessert', amount: 20, assignedTo: ['a'] },
        { id: '3', name: 'B dessert', amount: 20, assignedTo: ['b'] },
      ],
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(40);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(40);
  });

  it('should round correctly without losing pennies', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b', 'c'],
    });

    const total = splits.reduce((s: number, r) => s + r.amount, 0);
    expect(total).toBe(100);
  });

  it('should emit ratio_normalized warning when ratios do not sum to 1', () => {
    const { warnings } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b'],
      ratios: { a: 0.5, b: 1.0 },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('ratio_normalized');
  });

  it('should emit itemized_scaled warning when items total does not match', () => {
    const { warnings } = calculateSplits({
      totalAmount: 100,
      splitMode: 'itemized' as SplitMode,
      memberIds: ['a', 'b'],
      itemizedItems: [
        { id: '1', name: 'Item', amount: 80, assignedTo: ['a'] },
      ],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('itemized_scaled');
  });
});
