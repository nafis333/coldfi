import { query } from '../db/pool';
import { authenticator } from 'otplib';
import { AuthError, ValidationError, NotFoundError, ConflictError } from '../errors';
import { getTempToken } from './redis';
import { generateTokens } from './tokenService';

const ISSUER_NAME = 'ColdFi';

export interface TwoFASetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function generate2FASecret(userId: string): Promise<TwoFASetupResult> {
  const userResult = await query(
    `SELECT email, two_factor_enabled FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User');
  }

  if (userResult.rows[0].two_factor_enabled) {
    throw new ConflictError('2FA is already enabled');
  }

  const email = userResult.rows[0].email;
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, ISSUER_NAME, secret);

  await query(
    `UPDATE users SET two_factor_secret = $1, updated_at = NOW() WHERE id = $2`,
    [secret, userId]
  );

  const QRCode = await import('qrcode');
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrCodeDataUrl };
}

export async function verify2FASetup(userId: string, code: string): Promise<void> {
  const userResult = await query(
    `SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User');
  }

  if (userResult.rows[0].two_factor_enabled) {
    throw new ConflictError('2FA is already enabled');
  }

  const secret = userResult.rows[0].two_factor_secret;
  if (!secret) {
    throw new ValidationError('Call generate2FASecret first');
  }

  const isValid = authenticator.verify({ token: code, secret });
  if (!isValid) {
    throw new AuthError('ERR_INVALID_2FA', 'Invalid TOTP code');
  }

  await query(
    `UPDATE users
     SET two_factor_enabled = true, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  await query(
    `INSERT INTO user_activity_log (user_id, action, created_at)
     VALUES ($1, '2fa_enabled', NOW())`,
    [userId]
  );
}

export async function verify2FALogin(tempToken: string, code: string): Promise<any> {
  const tokenData = await getTempToken('2fa-login', tempToken);
  if (!tokenData) {
    throw new AuthError('ERR_TEMP_TOKEN_EXPIRED', 'Invalid or expired 2FA session');
  }

  const userId = tokenData.userId as string;

  const userResult = await query(
    `SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].two_factor_enabled) {
    throw new ValidationError('2FA is not enabled for this user');
  }

  const isValid = authenticator.verify({ token: code, secret: userResult.rows[0].two_factor_secret });
  if (!isValid) {
    throw new AuthError('ERR_INVALID_2FA', 'Invalid 2FA code');
  }

  const tokens = await generateTokens(userId);
  return tokens;
}

export async function getTwoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
  const result = await query(`SELECT two_factor_enabled FROM users WHERE id = $1`, [userId]);
  return { enabled: !!result.rows[0]?.two_factor_enabled };
}

export async function disable2FA(userId: string, code: string): Promise<void> {
  const userResult = await query(
    `SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User');
  }

  if (!userResult.rows[0].two_factor_enabled) {
    throw new ValidationError('2FA is not enabled');
  }

  const isValid = authenticator.verify({ token: code, secret: userResult.rows[0].two_factor_secret });
  if (!isValid) {
    throw new AuthError('ERR_INVALID_2FA', 'Invalid TOTP code');
  }

  await query(
    `UPDATE users
     SET two_factor_enabled = false, two_factor_secret = NULL, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  await query(
    `INSERT INTO user_activity_log (user_id, action, created_at)
     VALUES ($1, '2fa_disabled', NOW())`,
    [userId]
  );
}
