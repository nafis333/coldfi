import { describe, it, expect } from 'vitest';
import {
  formatDate,
  parseDate,
  getMonthRange,
  isInPeriod,
  daysBetween,
} from '../dates';

describe('date utils', () => {
  describe('formatDate', () => {
    it('should format short format', () => {
      const d = new Date(2024, 0, 15);
      expect(formatDate(d, 'short')).toMatch(/01\/15\/2024/);
    });

    it('should format iso format', () => {
      const d = new Date(2024, 0, 15);
      expect(formatDate(d, 'iso')).toBe('2024-01-15');
    });

    it('should accept string input', () => {
      expect(formatDate('2024-06-01', 'iso')).toBe('2024-06-01');
    });

    it('should parse date-only strings as local dates, not UTC midnight', () => {
      expect(formatDate('2024-01-01', 'iso')).toBe('2024-01-01');
      expect(formatDate('2024-01-01', 'long', 'en-US')).toContain('2024');
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2024);
    });

    it('should return null for invalid date', () => {
      expect(parseDate('not-a-date')).toBeNull();
    });
  });

  describe('getMonthRange', () => {
    it('should return start and end of month', () => {
      const range = getMonthRange('2024-06-10');
      expect(range.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(range.start.localeCompare(range.end)).toBeLessThan(0);
    });

    it('should keep the calendar month for date-only strings regardless of local timezone offset', () => {
      const range = getMonthRange('2024-01-01');
      expect(range.start).toBe('2024-01-01');
      expect(range.end).toBe('2024-01-31');
    });
  });

  describe('isInPeriod', () => {
    it('should return true for date within period', () => {
      expect(isInPeriod('2024-06-15', '2024-06-01', '2024-06-30')).toBe(true);
    });

    it('should return false for date before period', () => {
      expect(isInPeriod('2024-05-31', '2024-06-01', '2024-06-30')).toBe(false);
    });

    it('should return false for date after period', () => {
      expect(isInPeriod('2024-07-01', '2024-06-01', '2024-06-30')).toBe(false);
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between two dates', () => {
      expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9);
    });

    it('should handle reversed order', () => {
      expect(daysBetween('2024-01-10', '2024-01-01')).toBe(9);
    });

    it('should return 0 for same date', () => {
      expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0);
    });
  });
});
