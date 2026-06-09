import { describe, it, expect } from 'vitest';
import { generateMinimalTransfers } from '../minimalTransferAlgorithm';
import type { DetailedBalance } from '../balanceCalculator';

describe('generateMinimalTransfers', () => {
  it('should generate a single transfer for two members', () => {
    const balances: DetailedBalance[] = [
      { userId: 'alice', net: 50, owesTo: {}, owedBy: { bob: 50 } },
      { userId: 'bob', net: -50, owesTo: { alice: 50 }, owedBy: {} },
    ];

    const result = generateMinimalTransfers(balances, 'INR');

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]!.fromUserId).toBe('bob');
    expect(result.transfers[0]!.toUserId).toBe('alice');
    expect(result.transfers[0]!.amount).toBe(50);
  });

  it('should minimize transfers for three members', () => {
    const balances: DetailedBalance[] = [
      { userId: 'alice', net: 100, owesTo: {}, owedBy: { bob: 50, charlie: 50 } },
      { userId: 'bob', net: -30, owesTo: { alice: 50 }, owedBy: { charlie: 20 } },
      { userId: 'charlie', net: -70, owesTo: { alice: 50, bob: 20 }, owedBy: {} },
    ];

    const result = generateMinimalTransfers(balances, 'INR');

    expect(result.transfers.length).toBeLessThanOrEqual(3);
    const totalIn = result.transfers.reduce((s, t) => s + t.amount, 0);
    expect(totalIn).toBe(100);
  });

  it('should return no transfers when all balances are zero', () => {
    const balances: DetailedBalance[] = [
      { userId: 'alice', net: 0, owesTo: {}, owedBy: {} },
      { userId: 'bob', net: 0, owesTo: {}, owedBy: {} },
    ];

    const result = generateMinimalTransfers(balances, 'INR');
    expect(result.transfers).toHaveLength(0);
  });

  it('should handle multiple creditors and debtors', () => {
    const balances: DetailedBalance[] = [
      { userId: 'a', net: 60, owesTo: {}, owedBy: {} },
      { userId: 'b', net: 40, owesTo: {}, owedBy: {} },
      { userId: 'c', net: -50, owesTo: {}, owedBy: {} },
      { userId: 'd', net: -50, owesTo: {}, owedBy: {} },
    ];

    const result = generateMinimalTransfers(balances, 'INR');

    expect(result.transfers.length).toBeLessThanOrEqual(4);
    const totalIn = result.transfers.reduce((s, t) => s + t.amount, 0);
    expect(totalIn).toBe(100);
  });
});
