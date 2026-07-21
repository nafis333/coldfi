import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, transaction } from '../db/pool';
import { AuthError, ValidationError, NotFoundError } from '../errors';
import { decryptServerKey } from './cryptoUtils';
import { generateRecoveryCode, hashRecoveryCode } from './cryptoUtils';

const SALT_ROUNDS = 12;

export interface ChangePasswordInput {
  userId: string;
  oldAuthKeyHash: string;
  newAuthKeyHash: string;
  personalSalt: string;
  encryptedPek: string;
}

export interface ChangePasswordResult {
  personalSalt: string;
  encryptedPek: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const { userId, oldAuthKeyHash, newAuthKeyHash, personalSalt, encryptedPek } = input;

  if (!newAuthKeyHash || newAuthKeyHash.length < 32) {
    throw new ValidationError('New auth key hash must be at least 32 characters');
  }

  if (oldAuthKeyHash === newAuthKeyHash) {
    throw new ValidationError('New password must be different from current password');
  }

  if (!personalSalt || !encryptedPek) {
    throw new ValidationError('Personal salt and encrypted PEK are required');
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

  await transaction(async (client) => {
    await client.query(
      `UPDATE users
       SET auth_key_hash = $1, personal_salt = $2, encrypted_pek = $3, updated_at = NOW()
       WHERE id = $4`,
      [newHashedAuthKey, personalSalt, encryptedPek, userId]
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

  return { personalSalt, encryptedPek };
}

export interface RecoverInput {
  email: string;
  recoveryCode: string;
}

export async function recoverAccount(input: RecoverInput): Promise<{ userId: string; email: string; rawPek: string }> {
  const { email, recoveryCode } = input;

  if (!email || !recoveryCode) {
    throw new ValidationError('Email and recovery code are required');
  }

  const userResult = await query(
    `SELECT id, email, recovery_code_hash, server_encrypted_pek FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (userResult.rows.length === 0) {
    throw new AuthError('ERR_INVALID_RECOVERY', 'Invalid email or recovery code');
  }

  const user = userResult.rows[0];

  if (!user.recovery_code_hash) {
    throw new AuthError('ERR_INVALID_RECOVERY', 'Invalid email or recovery code');
  }

  const normalizedCode = recoveryCode.trim().toLowerCase().replace(/-/g, '');
  const inputHash = hashRecoveryCode(normalizedCode);

  if (inputHash.length !== user.recovery_code_hash.length) {
    throw new AuthError('ERR_INVALID_RECOVERY', 'Invalid email or recovery code');
  }

  if (!crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(user.recovery_code_hash))) {
    throw new AuthError('ERR_INVALID_RECOVERY', 'Invalid email or recovery code');
  }

  if (!user.server_encrypted_pek) {
    throw new AuthError('ERR_RECOVERY_FAILED', 'No recovery data found for this account');
  }

  const rawPek = decryptServerKey(user.server_encrypted_pek);

  return { userId: user.id, email: user.email, rawPek };
}
