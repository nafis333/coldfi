import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/pool', () => ({
  query: vi.fn(),
  transaction: vi.fn(),
  getClient: vi.fn(),
  closePool: vi.fn(),
  pool: {},
}));
vi.mock('../redis', () => ({
  setTempToken: vi.fn(),
  getTempToken: vi.fn(),
  getRedis: vi.fn().mockReturnValue({}),
  setupRedis: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
}));
vi.mock('../../config', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars-long',
    JWT_ACCESS_EXPIRY: '15m',
    MAX_LOGIN_ATTEMPTS: 5,
    LOGIN_WINDOW_MINUTES: 15,
    PBKDF2_ITERATIONS: 100000,
  },
}));

import { query, transaction } from '../../db/pool';
import { setTempToken, getTempToken } from '../redis';
import {
  registerUser,
  loginUser,
  generateTokens,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  changePassword,
} from '../authService';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockTransaction = transaction as ReturnType<typeof vi.fn>;
const mockSetTempToken = setTempToken as ReturnType<typeof vi.fn>;
const mockGetTempToken = getTempToken as ReturnType<typeof vi.fn>;

function mockTransactionImpl() {
  mockTransaction.mockImplementation(async (fn: any) => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    return fn(mockClient as any);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockTransactionImpl();
});

describe('registerUser', () => {
  it('should register a user with valid input', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 } as any);

    const result = await registerUser({
      email: 'test@example.com',
      authKeyHash: 'a'.repeat(64),
      displayName: 'Test User',
    });

    expect(result).toHaveProperty('userId');
    expect(result).toHaveProperty('personalSalt');
    expect(result.personalSalt).toHaveLength(64);
  });

  it('should reject invalid email', async () => {
    await expect(
      registerUser({
        email: 'not-an-email',
        authKeyHash: 'a'.repeat(64),
      })
    ).rejects.toThrow('Invalid email format');
  });

  it('should reject short authKeyHash', async () => {
    await expect(
      registerUser({
        email: 'test@example.com',
        authKeyHash: 'short',
      })
    ).rejects.toThrow('at least 32 characters');
  });

  it('should reject duplicate email', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'existing-user' }],
      rowCount: 1,
    } as any);

    await expect(
      registerUser({
        email: 'dupe@example.com',
        authKeyHash: 'a'.repeat(64),
      })
    ).rejects.toThrow('Email is already registered');
  });
});

describe('loginUser', () => {
  const hashedAuthKey = bcrypt.hashSync('a'.repeat(64), 4);

  it('should login with valid credentials', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          auth_key_hash: hashedAuthKey,
          personal_salt: 'salt123',
          two_factor_enabled: false,
          role: 'user',
        }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const result = await loginUser({
      email: 'test@example.com',
      authKeyHash: 'a'.repeat(64),
    });

    expect(result.userId).toBe('user-1');
    expect(result.personalSalt).toBe('salt123');
    expect(result.role).toBe('user');
    expect(result.requires2FA).toBe(false);
  });

  it('should reject wrong password', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          auth_key_hash: hashedAuthKey,
          personal_salt: 'salt123',
          two_factor_enabled: false,
          role: 'user',
        }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
      } as any);

    await expect(
      loginUser({
        email: 'test@example.com',
        authKeyHash: 'b'.repeat(64),
      })
    ).rejects.toThrow('Invalid email or password');
  });

  it('should reject login when account is locked', async () => {
    const oldestDate = new Date(Date.now() - 600000).toISOString();
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          auth_key_hash: hashedAuthKey,
          personal_salt: 'salt123',
          two_factor_enabled: false,
          role: 'user',
        }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ count: 5 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ created_at: oldestDate }],
        rowCount: 1,
      } as any);

    await expect(
      loginUser({
        email: 'test@example.com',
        authKeyHash: 'a'.repeat(64),
      })
    ).rejects.toThrow('Account locked');
  });

  it('should return tempToken when 2FA is enabled', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'user-1',
          auth_key_hash: hashedAuthKey,
          personal_salt: 'salt123',
          two_factor_enabled: true,
          role: 'user',
        }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [{ count: 0 }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    mockSetTempToken.mockResolvedValueOnce(undefined);

    const result = await loginUser({
      email: 'test@example.com',
      authKeyHash: 'a'.repeat(64),
    });

    expect(result.requires2FA).toBe(true);
    expect(result.role).toBe('user');
    expect(result.tempToken).toBeDefined();
  });
});

describe('generateTokens', () => {
  it('should return access and refresh tokens', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ role: 'user' }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({
        rows: [],
        rowCount: 1,
      } as any);

    const result = await generateTokens('user-1');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBe(900);

    const decoded = jwt.verify(result.accessToken, 'test-secret-key-that-is-at-least-32-chars-long') as any;
    expect(decoded.userId).toBe('user-1');
    expect(decoded.role).toBe('user');
  });
});

describe('refreshAccessToken', () => {
  it('should rotate tokens on valid refresh', async () => {
    const token = 'valid-refresh-token';
    const tokenHash = crypto.createHash('sha512').update(token).digest('hex');

    mockQuery
      .mockResolvedValueOnce({
        rows: [{
          id: 'token-1',
          user_id: 'user-1',
          expires_at: new Date(Date.now() + 86400000),
          revoked_at: null,
        }],
        rowCount: 1,
      } as any)
      .mockResolvedValueOnce({ rows: [{ locked_until: null }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ role: 'user' }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

    const result = await refreshAccessToken(token);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('should reject revoked token and revoke all user tokens', async () => {
    const token = 'revoked-token';

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'token-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() + 86400000),
        revoked_at: new Date(),
      }],
      rowCount: 1,
    } as any);

    await expect(refreshAccessToken(token)).rejects.toThrow('Refresh token reuse detected');
  });

  it('should reject expired token', async () => {
    const token = 'expired-token';

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'token-1',
        user_id: 'user-1',
        expires_at: new Date(Date.now() - 86400000),
        revoked_at: null,
      }],
      rowCount: 1,
    } as any);

    await expect(refreshAccessToken(token)).rejects.toThrow('Refresh token expired');
  });
});

describe('logoutUser', () => {
  it('should revoke refresh token', async () => {
    const token = 'logout-token';
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'token-1' }],
      rowCount: 1,
    } as any);

    await expect(logoutUser('user-1', token)).resolves.toBeUndefined();
  });

  it('should reject if token not found', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    } as any);

    await expect(logoutUser('user-1', 'bad-token')).rejects.toThrow('not found or already revoked');
  });
});

describe('logoutAllDevices', () => {
  it('should revoke all refresh tokens for user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 3,
    } as any);

    const result = await logoutAllDevices('user-1');
    expect(result.revokedCount).toBe(3);
  });
});

describe('changePassword', () => {
  const oldHash = bcrypt.hashSync('a'.repeat(64), 4);

  it('should change password with valid old password', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ auth_key_hash: oldHash }],
      rowCount: 1,
    } as any);

    const result = await changePassword({
      userId: 'user-1',
      oldAuthKeyHash: 'a'.repeat(64),
      newAuthKeyHash: 'b'.repeat(64),
    });

    expect(result.personalSalt).toHaveLength(64);
  });

  it('should reject wrong old password', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ auth_key_hash: oldHash }],
      rowCount: 1,
    } as any);

    await expect(
      changePassword({
        userId: 'user-1',
        oldAuthKeyHash: 'wrong-hash-that-is-long-enough-for-validation!!',
        newAuthKeyHash: 'b'.repeat(64),
      })
    ).rejects.toThrow('Current password is incorrect');
  });

  it('should reject short new auth key', async () => {
    await expect(
      changePassword({
        userId: 'user-1',
        oldAuthKeyHash: 'a'.repeat(64),
        newAuthKeyHash: 'short',
      })
    ).rejects.toThrow('at least 32 characters');
  });
});
