import { describe, it, expect } from 'vitest';
import {
  proposeSettlement,
  markAsPaid,
  confirmReceipt,
  rejectPayment,
  cancelProposal,
  getValidTransitions,
  ProposeSettlementInput,
} from '../settlementEngine';
import type { SettlementProposal } from '../../types/settlement';
import { SettlementStatus } from '../../types/enums';

function makeProposal(overrides: Partial<ProposeSettlementInput> = {}): SettlementProposal {
  return proposeSettlement({
    id: 'set-1',
    groupId: 'g1',
    fromUserId: 'bob',
    toUserId: 'alice',
    amount: 100,
    currency: 'INR',
    ...overrides,
  });
}

describe('settlementEngine', () => {
  describe('proposeSettlement', () => {
    it('should create a proposal with PROPOSED status', () => {
      const proposal = makeProposal();
      expect(proposal.status).toBe(SettlementStatus.PROPOSED);
      expect(proposal.amount).toBe(100);
    });
  });

  describe('markAsPaid', () => {
    it('should transition to MARKED_PAID', () => {
      const proposal = makeProposal();
      const result = markAsPaid(proposal);

      expect(result.success).toBe(true);
      expect(result.settlement!.status).toBe(SettlementStatus.MARKED_PAID);
    });

    it('should reject if not in PROPOSED status', () => {
      const proposal = makeProposal();
      const marked = markAsPaid(proposal).settlement!;
      const result = markAsPaid(marked);

      expect(result.success).toBe(false);
      expect(result.error).toContain('marked_paid');
    });

    it('should handle partial payment', () => {
      const proposal = makeProposal();
      const result = markAsPaid(proposal, 40);

      expect(result.success).toBe(true);
      expect(result.settlement!.status).toBe(SettlementStatus.SUPERSEDED);
    });

    it('should reject zero or negative partial amount', () => {
      const proposal = makeProposal();
      const result = markAsPaid(proposal, 0);

      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than 0');
    });
  });

  describe('confirmReceipt', () => {
    it('should transition to APPROVED', () => {
      const proposal = makeProposal();
      const marked = markAsPaid(proposal).settlement!;
      const result = confirmReceipt(marked);

      expect(result.success).toBe(true);
      expect(result.settlement!.status).toBe(SettlementStatus.APPROVED);
    });

    it('should reject if not in MARKED_PAID status', () => {
      const proposal = makeProposal();
      const result = confirmReceipt(proposal);

      expect(result.success).toBe(false);
    });
  });

  describe('rejectPayment', () => {
    it('should transition to REJECTED', () => {
      const proposal = makeProposal();
      const marked = markAsPaid(proposal).settlement!;
      const result = rejectPayment(marked, 'Wrong amount');

      expect(result.success).toBe(true);
      expect(result.settlement!.status).toBe(SettlementStatus.REJECTED);
      expect(result.settlement!.note).toBe('Wrong amount');
    });

    it('should reject if not in MARKED_PAID status', () => {
      const proposal = makeProposal();
      const result = rejectPayment(proposal);

      expect(result.success).toBe(false);
    });
  });

  describe('cancelProposal', () => {
    it('should transition to CANCELLED by proposer', () => {
      const proposal = makeProposal();
      const result = cancelProposal(proposal, 'bob');

      expect(result.success).toBe(true);
      expect(result.settlement!.status).toBe(SettlementStatus.CANCELLED);
    });

    it('should reject if not the proposer', () => {
      const proposal = makeProposal();
      const result = cancelProposal(proposal, 'charlie');

      expect(result.success).toBe(false);
      expect(result.error).toContain('proposer');
    });

    it('should reject if not in PROPOSED status', () => {
      const proposal = makeProposal();
      const marked = markAsPaid(proposal).settlement!;
      const result = cancelProposal(marked, 'bob');

      expect(result.success).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return correct transitions for PROPOSED', () => {
      const transitions = getValidTransitions(SettlementStatus.PROPOSED);
      expect(transitions).toContain(SettlementStatus.MARKED_PAID);
      expect(transitions).toContain(SettlementStatus.CANCELLED);
    });

    it('should return correct transitions for MARKED_PAID', () => {
      const transitions = getValidTransitions(SettlementStatus.MARKED_PAID);
      expect(transitions).toContain(SettlementStatus.APPROVED);
      expect(transitions).toContain(SettlementStatus.REJECTED);
    });

    it('should return empty for terminal states', () => {
      expect(getValidTransitions(SettlementStatus.APPROVED)).toHaveLength(0);
      expect(getValidTransitions(SettlementStatus.REJECTED)).toHaveLength(0);
      expect(getValidTransitions(SettlementStatus.CANCELLED)).toHaveLength(0);
    });
  });
});
