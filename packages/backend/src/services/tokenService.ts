import crypto from 'crypto';
import { query, transaction } from '../db/pool';
import { config, parseExpirySeconds } from '../config';
import { AuthError } from '../errors';
import { decryptServerKey, hashToken } from './cryptoUtils';
import { assertUserNotRestricted } from './userRestrictions';
import { logger } from './logger';
import jwt from 'jsonwebtoken';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: string;
  userId: string;
  displayName: string;
  personalSalt: string;
  encryptedPek: string;
  email: string;
  rawPek?: string;
  isGoogleUser: boolean;
}

export async function generateTokens(userId: string): Promise<TokenPair> {
  const userResult = await query(
    `SELECT role, display_name, personal_salt, encrypted_pek, email, google_id, server_encrypted_pek FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  const role = user?.role ?? 'user';
  const displayName = user?.display_name ?? '';
  const personalSalt = user?.personal_salt ?? '';
  const encryptedPek = user?.encrypted_pek ?? '';
  const email = user?.email ?? '';
  const isGoogleUser = !!(user?.google_id);
  let rawPek: string | undefined;
  if (user?.server_encrypted_pek) {
    try {
      rawPek = decryptServerKey(user.server_encrypted_pek);
    } catch (e) {
      logger.error('Failed to decrypt server PEK', { userId, error: String(e) });
    }
  }

  const accessToken = jwt.sign(
    { userId, role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRY } as jwt.SignOptions
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = hashToken(refreshToken);

  const refreshExpirySeconds = parseExpirySeconds(config.JWT_REFRESH_EXPIRY, 30 * 86400);
  const expiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [userId, refreshTokenHash, expiresAt]
  );

  const expiresIn = parseExpirySeconds(config.JWT_ACCESS_EXPIRY, 900);

  return { accessToken, refreshToken, expiresIn, role, userId, displayName, personalSalt, encryptedPek, email, rawPek, isGoogleUser };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(refreshToken);

  const result = await transaction(async (client) => {
    const tokenResult = await client.query(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      throw new AuthError('ERR_INVALID_TOKEN', 'Invalid refresh token');
    }

    const storedToken = tokenResult.rows[0];

    if (storedToken.revoked_at) {
      const revokedAgoMs = Date.now() - new Date(storedToken.revoked_at).getTime();
      // A just-revoked token is almost always a benign refresh race between
      // two tabs sharing the same cookie — the loser can retry with the
      // rotated cookie. Only treat old reuse as theft and revoke everything.
      if (revokedAgoMs > 60_000) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [storedToken.user_id]
        );
      }
      throw new AuthError('ERR_TOKEN_REUSED', 'Refresh token has been revoked. Please log in again.');
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      throw new AuthError('ERR_TOKEN_EXPIRED', 'Refresh token expired');
    }

    const userResult = await client.query(
      `SELECT locked_until FROM users WHERE id = $1 FOR UPDATE`,
      [storedToken.user_id]
    );
    if (userResult.rows.length > 0 && userResult.rows[0].locked_until) {
      const lockedUntil = new Date(userResult.rows[0].locked_until);
      if (lockedUntil > new Date()) {
        throw new AuthError('ERR_USER_LOCKED', 'Account is locked. Please try again later.', 423);
      }
    }

    await assertUserNotRestricted(storedToken.user_id);

    const updateResult = await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
      [storedToken.id]
    );

    if (updateResult.rowCount === 0) {
      const row = await client.query(
        `SELECT revoked_at FROM refresh_tokens WHERE id = $1`,
        [storedToken.id]
      );
      const revokedAt = row.rows[0]?.revoked_at;
      if (revokedAt && Date.now() - new Date(revokedAt).getTime() > 60_000) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [storedToken.user_id]
        );
      }
      throw new AuthError('ERR_TOKEN_REUSED', 'Refresh token has been revoked. Please log in again.');
    }

    return storedToken.user_id;
  });

  return generateTokens(result);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function logoutUser(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);

  // Idempotent: a stale cookie (already-revoked token, token rotation after
  // refresh) must not turn logout into an error for the client.
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
    [userId, tokenHash]
  );

  await query(
    `INSERT INTO user_activity_log (user_id, action, created_at)
     VALUES ($1, 'logout', NOW())`,
    [userId]
  );
}

export async function logoutAllDevices(userId: string): Promise<{ revokedCount: number }> {
  const result = await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  await query(
    `INSERT INTO user_activity_log (user_id, action, metadata, created_at)
     VALUES ($1, 'logout_all', $2, NOW())`,
    [userId, JSON.stringify({ revokedCount: result.rowCount })]
  );

  return { revokedCount: result.rowCount || 0 };
}
