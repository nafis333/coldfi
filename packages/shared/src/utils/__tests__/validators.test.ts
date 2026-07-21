import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isValidPassword,
  isValidAmount,
  isValidCurrency,
  isValidUUID,
} from '../validators';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('should accept valid email', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('should reject email without @', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('should reject email without domain', () => {
      expect(isValidEmail('user@')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    it('should accept valid password', () => {
      const result = isValidPassword('Str0ng!Pass');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short password', () => {
      const result = isValidPassword('Sh0rt!');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = isValidPassword('str0ng!pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain an uppercase letter');
    });

    it('should reject password without digit', () => {
      const result = isValidPassword('Strong!Pass');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain a digit');
    });

    it('should reject common password', () => {
      const result = isValidPassword('Password123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password is too common');
    });
  });

  describe('isValidAmount', () => {
    it('should accept valid amount', () => {
      expect(isValidAmount(100)).toBe(true);
    });

    it('should reject negative amount', () => {
      expect(isValidAmount(-10)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(isValidAmount(NaN)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(isValidAmount(Infinity)).toBe(false);
    });

    it('should reject non-number', () => {
      expect(isValidAmount('100')).toBe(false);
    });
  });

  describe('isValidCurrency', () => {
    it('should accept valid currency', () => {
      expect(isValidCurrency('USD')).toBe(true);
      expect(isValidCurrency('BDT')).toBe(true);
    });

    it('should reject invalid currency', () => {
      expect(isValidCurrency('XYZ')).toBe(false);
    });
  });

  describe('isValidUUID', () => {
    it('should accept valid UUID v4', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('should reject non-UUID string', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should reject UUID with wrong version', () => {
      expect(isValidUUID('550e8400-e29b-31d4-a716-446655440000')).toBe(false);
    });
  });
});
