import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, transaction } from '../db/pool';
import { config } from '../config';
import { AuthError, ValidationError, ConflictError, NotFoundError } from '../errors';
import { isValidEmail } from '@coldfi/shared';
import { setTempToken } from './redis';
import { assertUserNotRestricted } from './userRestrictions';
import { encryptServerKey, generateRecoveryCode, hashRecoveryCode } from './cryptoUtils';
import { generateTokens } from './tokenService';
import { OAuth2Client } from 'google-auth-library';

const googleClient = config.GOOGLE_CLIENT_ID
  ? new OAuth2Client(config.GOOGLE_CLIENT_ID)
  : null;

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  authKeyHash: string;
  personalSalt: string;
  encryptedPek: string;
  rawPek: string;
  displayName?: string;
}

export interface RegisterResult {
  userId: string;
  personalSalt: string;
  encryptedPek: string;
  role: string;
  recoveryCode: string;
}

export interface LoginInput {
  email: string;
  authKeyHash: string;
}

export interface LoginResult {
  userId: string;
  personalSalt: string;
  encryptedPek: string;
  role: string;
  requires2FA: boolean;
  tempToken?: string;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const { email, authKeyHash, displayName, personalSalt, encryptedPek, rawPek } = input;

  if (!isValidEmail(email)) {
    throw new ValidationError('Invalid email format');
  }

  if (!authKeyHash || authKeyHash.length < 32) {
    throw new ValidationError('Auth key hash is required and must be at least 32 characters');
  }

  const hashedAuthKey = await bcrypt.hash(authKeyHash, SALT_ROUNDS);
  const serverEncryptedPek = encryptServerKey(rawPek);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = hashRecoveryCode(recoveryCode);

  const userId = crypto.randomUUID();
  const adminEmails = (config.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isOwner = adminEmails.includes(email.toLowerCase());
  const role = isOwner ? 'owner' : 'user';

  try {
    await transaction(async (client) => {
      const existing = await client.query('SELECT id FROM users WHERE email = $1 FOR UPDATE', [email.toLowerCase()]);
      if (existing.rows.length > 0) {
        throw new ConflictError('Email is already registered');
      }

      await client.query(
        `INSERT INTO users (id, email, display_name, password_hash, auth_key_hash, personal_salt, encrypted_pek, role, personal_data_enc, personal_vc, default_currency, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [userId, email.toLowerCase(), displayName || null, hashedAuthKey, hashedAuthKey, personalSalt, encryptedPek, role, Buffer.from(''), '[]', 'BDT']
      );

      await client.query(
        `UPDATE users SET server_encrypted_pek = $1 WHERE id = $2`,
        [serverEncryptedPek, userId]
      );

      await client.query(
        `UPDATE users SET recovery_code_hash = $1 WHERE id = $2`,
        [recoveryCodeHash, userId]
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
  } catch (error: any) {
    if (error?.code === '23505' || error instanceof ConflictError) {
      throw new ConflictError('Email is already registered');
    }
    throw error;
  }

  return { userId, personalSalt, encryptedPek, role, recoveryCode };
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, authKeyHash } = input;

  const userResult = await query(
    `SELECT id, auth_key_hash, personal_salt, encrypted_pek, two_factor_enabled, role, locked_until
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new AuthError('ERR_INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const user = userResult.rows[0];

  await assertUserNotRestricted(user.id);

  // locked_until is the single source of truth for lockout (also enforced on token refresh).
  const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
  if (lockedUntil && lockedUntil.getTime() > Date.now()) {
    const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
    throw new AuthError('ERR_USER_LOCKED', `Account locked. Try again in ${remaining} minutes`, 423);
  }

  const recentFails = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_activity_log
     WHERE user_id = $1 AND action = 'login_failed' AND created_at > NOW() - $2::interval`,
    [user.id, `${config.LOGIN_WINDOW_MINUTES} minutes`]
  );

  const failedCount = Number(recentFails.rows[0]?.count || 0);
  if (failedCount >= config.MAX_LOGIN_ATTEMPTS) {
    const oldestFail = await query<{ created_at: string }>(
      `SELECT created_at FROM user_activity_log
       WHERE user_id = $1 AND action = 'login_failed' AND created_at > NOW() - $2::interval
       ORDER BY created_at ASC LIMIT 1`,
      [user.id, `${config.LOGIN_WINDOW_MINUTES} minutes`]
    );
    const lockUntil = new Date(oldestFail.rows[0]!.created_at);
    lockUntil.setMinutes(lockUntil.getMinutes() + config.LOGIN_WINDOW_MINUTES);
    await query(
      `UPDATE users SET locked_until = $1 WHERE id = $2`,
      [lockUntil.toISOString(), user.id]
    );
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
    `DELETE FROM user_activity_log WHERE user_id = $1 AND action = 'login_failed' AND created_at > NOW() - $2::interval`,
    [user.id, `${config.LOGIN_WINDOW_MINUTES} minutes`]
  );

  await query(
    `UPDATE users SET locked_until = NULL WHERE id = $1`,
    [user.id]
  );

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
      encryptedPek: user.encrypted_pek || '',
      role,
      requires2FA: true,
      tempToken,
    };
  }

  return {
    userId: user.id,
    personalSalt: user.personal_salt,
    encryptedPek: user.encrypted_pek || '',
    role,
    requires2FA: false,
  };
}

export async function googleLogin(
  idToken: string
): Promise<any> {
  if (!googleClient) {
    throw new AuthError('ERR_GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new AuthError('ERR_INVALID_GOOGLE_TOKEN', 'Invalid Google token');
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const displayName = payload.name || '';

  const existingByEmail = await transaction(async (client) => {
    const result = await client.query(
      `SELECT id, google_id FROM users WHERE email = $1 FOR UPDATE`,
      [email]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (user.google_id && user.google_id !== googleId) {
        throw new AuthError(
          'ERR_GOOGLE_ACCOUNT_MISMATCH',
          'This email is already linked to a different Google account. Sign in with that account or reset your password.',
          409
        );
      }
      await assertUserNotRestricted(user.id);
      if (!user.google_id) {
        await client.query(
          `UPDATE users SET google_id = $1, display_name = COALESCE(NULLIF($2, ''), display_name), updated_at = NOW() WHERE id = $3`,
          [googleId, displayName, user.id]
        );
      }
      return { existing: true, userId: user.id, googleNewUser: false };
    }
    return { existing: false };
  });

  if (existingByEmail.existing) {
    const tokens = await generateTokens(existingByEmail.userId);
    return { ...tokens, googleNewUser: false };
  }

  const existingByGoogle = await query(
    `SELECT id FROM users WHERE google_id = $1`,
    [googleId]
  );

  if (existingByGoogle.rows.length > 0) {
    const tokens = await generateTokens(existingByGoogle.rows[0].id);
    return { ...tokens, googleNewUser: false };
  }

  const userId = crypto.randomUUID();
  const adminEmails = (config.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const isOwner = adminEmails.includes(email.toLowerCase());
  const role = isOwner ? 'owner' : 'user';
  const internalPass = crypto.randomBytes(32).toString('hex');
  const authKeyHash = await bcrypt.hash(internalPass, SALT_ROUNDS);

  const personalSaltBytes = crypto.randomBytes(32).toString('base64');
  const pekBytes = crypto.randomBytes(32);
  const pekBase64 = pekBytes.toString('base64');
  const serverEncryptedPek = encryptServerKey(pekBase64);

  await transaction(async (client) => {
    await client.query(
      `INSERT INTO users (id, email, display_name, password_hash, auth_key_hash, personal_salt, encrypted_pek, server_encrypted_pek, role, google_id, personal_data_enc, personal_vc, default_currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
      [userId, email, displayName || null, authKeyHash, authKeyHash, personalSaltBytes, pekBase64, serverEncryptedPek, role, googleId, Buffer.from(''), '[]', 'BDT']
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
        [userId, JSON.stringify({ reason: 'preset admin email', email })]
      );
    }
  });

  const tokens = await generateTokens(userId);
  return { ...tokens, googleNewUser: true, personalSalt: personalSaltBytes, encryptedPek: pekBase64 };
}

export async function updateProfile(
  userId: string,
  updates: { displayName?: string; defaultCurrency?: string; timezone?: string }
): Promise<{ displayName: string | null; defaultCurrency: string; timezone: string }> {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.displayName !== undefined) {
    fields.push(`display_name = $${idx++}`);
    values.push(updates.displayName || null);
  }
  if (updates.defaultCurrency !== undefined) {
    fields.push(`default_currency = $${idx++}`);
    values.push(updates.defaultCurrency);
  }
  if (updates.timezone !== undefined) {
    fields.push(`timezone = $${idx++}`);
    values.push(updates.timezone);
  }

  if (fields.length === 0) {
    throw new ValidationError('No fields to update');
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING display_name, default_currency, timezone`,
    values
  );

  if (result.rows.length === 0) {
    throw new NotFoundError('User not found');
  }

  return {
    displayName: result.rows[0].display_name,
    defaultCurrency: result.rows[0].default_currency,
    timezone: result.rows[0].timezone,
  };
}
