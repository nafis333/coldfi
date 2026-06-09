import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, transaction } from '../db/pool';
import { config } from '../config';
import { AuthError, ValidationError, ConflictError, NotFoundError } from '../errors';
import { isValidEmail } from '@coldfi/shared';
import { authenticator } from 'otplib';
import { setTempToken, getTempToken } from './redis';
import { logger } from './logger';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const ISSUER_NAME = 'ColdFi';

function hashToken(token: string): string {
  return crypto.createHash('sha512').update(token).digest('hex');
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  role: string;
  userId: string;
  displayName: string;
  personalSalt: string;
}

export interface RegisterInput {
  email: string;
  authKeyHash: string;
  displayName?: string;
}

export interface RegisterResult {
  userId: string;
  personalSalt: string;
  role: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { email, authKeyHash, displayName } = input;

  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  if (!authKeyHash || authKeyHash.length < 32) {
    throw new ValidationError('Auth key hash is required and must be at least 32 characters');
  }

  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw new ConflictError('Email is already registered');
  }

  const hashedAuthKey = await bcrypt.hash(authKeyHash, SALT_ROUNDS);

  const personalSalt = crypto.randomBytes(32).toString('hex');

  const userId = crypto.randomUUID();
  const isOwner = email.toLowerCase() === 'coldwolfpack@gmail.com';
  const role = isOwner ? 'owner' : 'user';

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, email, display_name, auth_key_hash, personal_salt, role, personal_data_enc, personal_vc, default_currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
      [userId, email.toLowerCase(), displayName || null, hashedAuthKey, personalSalt, role, Buffer.from(''), '[]', 'USD']
    );

    await client.query(
      `INSERT INTO user_activity_log (user_id, action, ip_address, created_at)
       VALUES ($1, 'register', NULL, NOW())`,
      [userId]
    );

    if (isOwner) {
      await client.query(
        `INSERT INTO user_activity_log (user_id, action, metadata, created_at)
         VALUES ($1, 'admin_granted', $2, NOW())`,
        [userId, JSON.stringify({ reason: 'preset admin email', email: email.toLowerCase() })]
      );
    }
  });

  return { userId, personalSalt, role };
}

export interface LoginInput {
  email: string;
  authKeyHash: string;
}

export interface LoginResult {
  userId: string;
  personalSalt: string;
  role: string;
  requires2FA: boolean;
  tempToken?: string;
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, authKeyHash } = input;

  const userResult = await query(
    `SELECT id, auth_key_hash, personal_salt, two_factor_enabled, role
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new AuthError('ERR_INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const user = userResult.rows[0];

  // Rolling window lockout — count failed attempts in the last N minutes
  const recentFails = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_activity_log
     WHERE user_id = $1 AND action = 'login_failed' AND created_at > NOW() - $2::interval`,
    [user.id, `${config.LOGIN_WINDOW_MINUTES} minutes`]
  );

  const failedCount = Number(recentFails.rows[0]?.count || 0);
  if (failedCount >= config.MAX_LOGIN_ATTEMPTS) {
    const oldestFail = await query<{ created_at: string }>(
      `SELECT created_at FROM user_activity_log
       WHERE user_id = $1 AND action = 'login_failed'
       ORDER BY created_at ASC LIMIT 1`,
      [user.id]
    );
    const lockUntil = new Date(oldestFail.rows[0]!.created_at);
    lockUntil.setMinutes(lockUntil.getMinutes() + config.LOGIN_WINDOW_MINUTES);
    const remaining = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
    throw new AuthError('ERR_USER_LOCKED', `Account locked. Try again in ${remaining} minutes`, 423);
  }

  const isValid = await bcrypt.compare(authKeyHash, user.auth_key_hash);

  if (!isValid) {
    await query(
      `INSERT INTO user_activity_log (user_id, action, metadata, created_at)
       VALUES ($1, 'login_failed', $2, NOW())`,
      [user.id, JSON.stringify({ attempts: failedCount + 1 })]
    );

    throw new AuthError('ERR_INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await query(
    `INSERT INTO user_activity_log (user_id, action, created_at)
     VALUES ($1, 'login_success', NOW())`,
    [user.id]
  );

  const role = user.role || 'user';

  if (user.two_factor_enabled) {
    const tempToken = crypto.randomUUID();
    await setTempToken('2fa-login', tempToken, { userId: user.id }, 300);

    return {
      userId: user.id,
      personalSalt: user.personal_salt,
      role,
      requires2FA: true,
      tempToken,
    };
  }

  return {
    userId: user.id,
    personalSalt: user.personal_salt,
    role,
    requires2FA: false,
  };
}

export async function generateTokens(userId: string): Promise<TokenPair> {
  const userResult = await query(
    `SELECT role, display_name, personal_salt FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  const role = user?.role ?? 'user';
  const displayName = user?.display_name ?? '';
  const personalSalt = user?.personal_salt ?? '';

  const accessToken = jwt.sign(
    { userId, role },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRY } as jwt.SignOptions
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = hashToken(refreshToken);

  const match = config.JWT_REFRESH_EXPIRY.match(/^(\d+)([smhd])$/);
  const days = match ? parseInt(match[1]!, 10) : 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [userId, refreshTokenHash, expiresAt]
  );

  const match = config.JWT_ACCESS_EXPIRY.match(/^(\d+)([smhd])$/);
  let expiresIn = 900;
  if (match) {
    const num = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    expiresIn = num * (multipliers[unit] || 60);
  } else {
    logger.warn(`Unrecognized JWT_ACCESS_EXPIRY format "${config.JWT_ACCESS_EXPIRY}", falling back to 900s`, { module: 'auth' });
  }

  return { accessToken, refreshToken, expiresIn, role, userId, displayName, personalSalt };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  const tokenHash = hashToken(refreshToken);

  const result = await query(
    `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AuthError('ERR_INVALID_TOKEN', 'Invalid refresh token');
  }

  const storedToken = result.rows[0];

  if (storedToken.revoked_at) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [storedToken.user_id]
    );
    throw new AuthError('ERR_TOKEN_REVOKED', 'Refresh token reuse detected. All sessions revoked.');
  }

  if (new Date(storedToken.expires_at) < new Date()) {
    throw new AuthError('ERR_TOKEN_EXPIRED', 'Refresh token expired');
  }

  const userResult = await query(
    `SELECT locked_until FROM users WHERE id = $1`,
    [storedToken.user_id]
  );
  if (userResult.rows.length > 0 && userResult.rows[0].locked_until) {
    const lockedUntil = new Date(userResult.rows[0].locked_until);
    if (lockedUntil > new Date()) {
      throw new AuthError('ERR_USER_LOCKED', 'Account is locked. Please try again later.', 423);
    }
  }

  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
    [storedToken.id]
  );

  return generateTokens(storedToken.user_id);
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function logoutUser(userId: string, refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);

  const result = await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL
     RETURNING id`,
    [userId, tokenHash]
  );

  if (result.rows.length === 0) {
    throw new AuthError('ERR_INVALID_TOKEN', 'Refresh token not found or already revoked');
  }

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

export interface ChangePasswordInput {
  userId: string;
  oldAuthKeyHash: string;
  newAuthKeyHash: string;
}

export interface ChangePasswordResult {
  personalSalt: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const { userId, oldAuthKeyHash, newAuthKeyHash } = input;

  if (!newAuthKeyHash || newAuthKeyHash.length < 32) {
    throw new ValidationError('New auth key hash must be at least 32 characters');
  }

  if (oldAuthKeyHash === newAuthKeyHash) {
    throw new ValidationError('New password must be different from current password');
  }

  const userResult = await query(
    `SELECT auth_key_hash FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new NotFoundError('User');
  }

  const isValid = await bcrypt.compare(oldAuthKeyHash, userResult.rows[0].auth_key_hash);
  if (!isValid) {
    throw new AuthError('ERR_INVALID_PASSWORD', 'Current password is incorrect');
  }

  const newHashedAuthKey = await bcrypt.hash(newAuthKeyHash, SALT_ROUNDS);

  const newPersonalSalt = crypto.randomBytes(32).toString('hex');

  await transaction(async (client) => {
    await client.query(
      `UPDATE users
       SET auth_key_hash = $1, personal_salt = $2, updated_at = NOW()
       WHERE id = $3`,
      [newHashedAuthKey, newPersonalSalt, userId]
    );

    await client.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );

    await client.query(
      `INSERT INTO user_activity_log (user_id, action, created_at)
       VALUES ($1, 'password_changed', NOW())`,
      [userId]
    );
  });

  return { personalSalt: newPersonalSalt };
}

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

export async function verify2FALogin(tempToken: string, code: string): Promise<TokenPair> {
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

  return generateTokens(userId);
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
