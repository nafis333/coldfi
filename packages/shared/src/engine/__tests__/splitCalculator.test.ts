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

  // === TEST PLAN SCENARIOS ===
  // R4: Single member
  it('should handle single member (R4)', () => {
    const { splits } = calculateSplits({
      totalAmount: 50,
      splitMode: SplitMode.RATIO,
      memberIds: ['a'],
    });

    expect(splits).toHaveLength(1);
    expect(splits[0]!.amount).toBe(50);
    expect(splits[0]!.ratio).toBe(1);
  });

  // R5: Uneven ratios with rounding remainder
  it('should assign rounding remainder to last member (R5)', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b', 'c'],
      ratios: { a: 0.33, b: 0.33, c: 0.34 },
    });

    const total = splits.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(100);
    // Last member (c) should absorb the penny rounding
    expect(splits.find((r) => r.memberId === 'c')!.amount).toBe(34);
  });

  // F3: Fixed amounts over total (auto-scaled down)
  it('should scale fixed amounts down when total is exceeded (F3)', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 80,
      splitMode: SplitMode.FIXED,
      memberIds: ['a', 'b'],
      fixedAmounts: { a: 60, b: 40 },
    });

    const total = splits.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(80);
    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(48);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(32);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.type).toBe('fixed_scaled');
  });

  // F4: Missing member fixed amount (treated as 0, then scaled)
  it('should treat missing fixed amounts as 0 and scale proportionally (F4)', () => {
    const { splits, warnings } = calculateSplits({
      totalAmount: 90,
      splitMode: SplitMode.FIXED,
      memberIds: ['a', 'b', 'c'],
      fixedAmounts: { a: 30 },
    });

    const total = splits.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(90);
    // specifiedTotal=30, scaleFactor=90/30=3 → a=90, b=0, c=0
    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(90);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(0);
    expect(splits.find((r) => r.memberId === 'c')!.amount).toBe(0);
    expect(warnings).toHaveLength(1);
  });

  // F5: No fixed amounts (falls back to equal)
  it('should fall back to equal split when no fixed amounts provided (F5)', () => {
    const { splits } = calculateSplits({
      totalAmount: 60,
      splitMode: SplitMode.FIXED,
      memberIds: ['a', 'b', 'c'],
    });

    const total = splits.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(60);
    splits.forEach((r) => expect(r.amount).toBeCloseTo(20));
  });

  // I3: Unassigned items split equally
  it('should split unassigned items equally among all members (I3)', () => {
    const { splits } = calculateSplits({
      totalAmount: 60,
      splitMode: 'itemized' as SplitMode,
      memberIds: ['a', 'b', 'c'],
      itemizedItems: [
        { id: '1', name: 'Shared', amount: 30, assignedTo: [] },
        { id: '2', name: 'Personal A', amount: 30, assignedTo: ['a'] },
      ],
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(40); // 30 + 10
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(10);
    expect(splits.find((r) => r.memberId === 'c')!.amount).toBe(10);
  });

  // I4: Single item assigned to all
  it('should split a single shared item equally (I4)', () => {
    const { splits } = calculateSplits({
      totalAmount: 90,
      splitMode: SplitMode.RATIO,
      memberIds: ['a', 'b', 'c'],
      itemizedItems: [
        { id: '1', name: 'Shared bill', amount: 90, assignedTo: ['a', 'b', 'c'] },
      ],
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(30);
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(30);
    expect(splits.find((r) => r.memberId === 'c')!.amount).toBe(30);
  });

  // I5: Multiple items with overlapping assignments
  it('should handle overlapping item assignments correctly (I5)', () => {
    const { splits } = calculateSplits({
      totalAmount: 100,
      splitMode: 'itemized' as SplitMode,
      memberIds: ['a', 'b', 'c'],
      itemizedItems: [
        { id: '1', name: 'Item A-B', amount: 40, assignedTo: ['a', 'b'] },
        { id: '2', name: 'Item B-C', amount: 60, assignedTo: ['b', 'c'] },
      ],
    });

    expect(splits.find((r) => r.memberId === 'a')!.amount).toBe(20); // 40/2
    expect(splits.find((r) => r.memberId === 'b')!.amount).toBe(50); // 40/2 + 60/2
    expect(splits.find((r) => r.memberId === 'c')!.amount).toBe(30); // 60/2
  });
});
