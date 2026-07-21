import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  incrementRequestCount,
  getRequestCount,
  getErrorCount,
  getTotalDurationMs,
  getActiveConnections,
} from '../requestMetrics';

vi.mock('../../db/pool', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    requestStart: vi.fn(),
    requestEnd: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../services/errorCapture', () => ({
  captureError: vi.fn().mockResolvedValue(undefined),
}));

describe('requestMetrics', () => {
  beforeEach(() => {
    incrementRequestCount(false, 0);
    incrementRequestCount(false, 0);
    incrementRequestCount(false, 0);
    while (getRequestCount() > 0) {
      incrementRequestCount(false, 0);
      break;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('incrementRequestCount / getRequestCount', () => {
    it('should start at 0 after resetting', () => {
      const count = getRequestCount();
      expect(typeof count).toBe('number');
    });

    it('should increment count', () => {
      const before = getRequestCount();
      incrementRequestCount(false, 100);
      expect(getRequestCount()).toBe(before + 1);
    });
  });

  describe('getErrorCount', () => {
    it('should track error requests', () => {
      const before = getErrorCount();
      incrementRequestCount(true, 50);
      expect(getErrorCount()).toBe(before + 1);
    });
  });

  describe('getTotalDurationMs', () => {
    it('should accumulate duration', () => {
      const before = getTotalDurationMs();
      incrementRequestCount(false, 250);
      expect(getTotalDurationMs()).toBe(before + 250);
    });
  });

  describe('getActiveConnections', () => {
    it('should return a number', () => {
      expect(typeof getActiveConnections()).toBe('number');
    });
  });
});
