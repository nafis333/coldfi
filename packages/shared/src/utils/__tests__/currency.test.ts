import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  getCurrencySymbol,
  isValidCurrencyCode,
  getAllCurrencies,
  convertCurrency,
  parseCurrency,
} from '../currency';

describe('currency utils', () => {
  describe('formatCurrency', () => {
    it('should format USD with $ symbol', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100.00');
    });

    it('should format BDT with ৳ symbol', () => {
      expect(formatCurrency(1500.50, 'BDT')).toBe('৳1500.50');
    });

    it('should show negative amounts with minus sign', () => {
      expect(formatCurrency(-50, 'USD')).toBe('-$50.00');
    });

    it('should use zero decimals for JPY', () => {
      expect(formatCurrency(1000, 'JPY')).toBe('¥1000');
    });

    it('should show zero correctly', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
    });
  });

  describe('getCurrencySymbol', () => {
    it('should return known symbol', () => {
      expect(getCurrencySymbol('EUR')).toBe('€');
    });

    it('should return code itself for unknown currency', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });

  describe('isValidCurrencyCode', () => {
    it('should accept valid codes', () => {
      expect(isValidCurrencyCode('USD')).toBe(true);
      expect(isValidCurrencyCode('BDT')).toBe(true);
    });

    it('should reject invalid codes', () => {
      expect(isValidCurrencyCode('XYZ')).toBe(false);
      expect(isValidCurrencyCode('')).toBe(false);
    });
  });

  describe('getAllCurrencies', () => {
    it('should return all currencies', () => {
      const currencies = getAllCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('BDT');
      expect(currencies.length).toBeGreaterThan(30);
    });
  });

  describe('convertCurrency', () => {
    it('should return same amount for same currency', () => {
      expect(convertCurrency(100, 'USD', 'USD')).toBe(100);
    });

    it('should convert between currencies', () => {
      const result = convertCurrency(100, 'USD', 'EUR');
      expect(result).toBeGreaterThan(0);
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should throw for unsupported currency', () => {
      expect(() => convertCurrency(100, 'USD', 'XYZ')).toThrow('Unsupported currency');
    });
  });

  describe('parseCurrency', () => {
    it('should parse code-prefixed value', () => {
      const result = parseCurrency('USD 100.50');
      expect(result).toEqual({ amount: 100.50, currency: 'USD' });
    });

    it('should parse symbol-prefixed value', () => {
      const result = parseCurrency('$50');
      expect(result).toEqual({ amount: 50, currency: 'USD' });
    });

    it('should return null for unparseable string', () => {
      expect(parseCurrency('hello world')).toBeNull();
    });
  });
});
