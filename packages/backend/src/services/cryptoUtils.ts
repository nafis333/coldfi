import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';

export function encryptServerKey(plaintext: string): string {
  const key = Buffer.from(config.SERVER_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptServerKey(ciphertext: string): string {
  const key = Buffer.from(config.SERVER_ENCRYPTION_KEY, 'hex');
  const parts = ciphertext.split(':');
  const iv = Buffer.from(parts[0]!, 'hex');
  const tag = Buffer.from(parts[1]!, 'hex');
  const encrypted = Buffer.from(parts[2]!, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha512').update(token).digest('hex');
}

export function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(12);
  const hex = bytes.toString('hex');
  return hex.match(/.{4}/g)!.join('-');
}

export function hashRecoveryCode(code: string): string {
  return bcrypt.hashSync(code, 10);
}

export function verifyRecoveryCode(code: string, hash: string): boolean {
  return bcrypt.compareSync(code, hash);
}
