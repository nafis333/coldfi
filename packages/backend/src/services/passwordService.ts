import bcrypt from 'bcrypt';
import { query, transaction } from '../db/pool';
import { AuthError, ValidationError, NotFoundError } from '../errors';
import { decryptServerKey, encryptServerKey } from './cryptoUtils';
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } from './cryptoUtils';

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
    const user = await client.query(
      `SELECT server_encrypted_pek FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );

    let serverEncryptedPek = null;
    if (user.rows[0]?.server_encrypted_pek) {
      const rawPek = decryptServerKey(user.rows[0].server_encrypted_pek);
      serverEncryptedPek = encryptServerKey(rawPek);
    }

    await client.query(
      `UPDATE users
       SET auth_key_hash = $1, personal_salt = $2, encrypted_pek = $3, server_encrypted_pek = COALESCE($4, server_encrypted_pek), updated_at = NOW()
       WHERE id = $5`,
      [newHashedAuthKey, personalSalt, encryptedPek, serverEncryptedPek, userId]
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

  if (!verifyRecoveryCode(normalizedCode, user.recovery_code_hash)) {
    throw new AuthError('ERR_INVALID_RECOVERY', 'Invalid email or recovery code');
  }

  if (!user.server_encrypted_pek) {
    throw new AuthError('ERR_RECOVERY_FAILED', 'No recovery data found for this account');
  }

  let rawPek: string;
  try {
    rawPek = decryptServerKey(user.server_encrypted_pek);
  } catch {
    throw new AuthError('ERR_RECOVERY_FAILED', 'Failed to decrypt recovery data');
  }

  return { userId: user.id, email: user.email, rawPek };
}
