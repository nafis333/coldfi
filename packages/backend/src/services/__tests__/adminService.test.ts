import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/pool', () => ({
  query: vi.fn(),
}));

vi.mock('../../config', () => ({
  config: { ADMIN_API_KEY: 'test-admin-key-12345' },
}));

import { query } from '../../db/pool';
import {
  getAdminAuthMethods,
  getSystemInfo,
  getBannedUserCleanupCount,
} from '../adminService';

const mockQuery = query as ReturnType<typeof vi.fn>;

describe('adminService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getAdminAuthMethods', () => {
    it('should include jwt and api-key when configured', async () => {
      const methods = await getAdminAuthMethods();
      expect(methods).toContain('jwt');
      expect(methods).toContain('api-key');
    });
  });

  describe('getSystemInfo', () => {
    it('should return system information', async () => {
      const info = await getSystemInfo();
      expect(info).toHaveProperty('version', '1.0.0');
      expect(info).toHaveProperty('nodeVersion');
      expect(info).toHaveProperty('uptime');
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('memory');
      expect(info.memory).toHaveProperty('total');
      expect(info.memory).toHaveProperty('free');
    });
  });

  describe('getBannedUserCleanupCount', () => {
    it('should return count from query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: 5 }] } as any);
      const count = await getBannedUserCleanupCount();
      expect(count).toBe(5);
    });

    it('should return 0 when no results', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as any);
      const count = await getBannedUserCleanupCount();
      expect(count).toBe(0);
    });
  });


});
