const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH = 32;

function deriveKeyBytes(
  password: string,
  baseSalt: Uint8Array,
  context: string
): Promise<Uint8Array> {
  const contextSalt = new Uint8Array(baseSalt.length + context.length);
  contextSalt.set(new TextEncoder().encode(context));
  contextSalt.set(baseSalt, context.length);
  return derivePBKDF2Bytes(password, contextSalt);
}

async function derivePBKDF2Bytes(
  secret: string | Uint8Array,
  salt: Uint8Array
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secret instanceof Uint8Array ? secret : new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-512' },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(derived);
}

export async function deriveAuthKey(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  try {
    return deriveKeyBytes(password, salt, 'coldfi:auth:');
  } catch {
    throw new Error('Key derivation failed');
  }
}

export async function derivePEK(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  try {
    return deriveKeyBytes(password, salt, 'coldfi:pek:');
  } catch {
    throw new Error('Key derivation failed');
  }
}

export async function deriveGroupKey(
  passphrase: string,
  groupId: string
): Promise<CryptoKey> {
  try {
    const encoder = new TextEncoder();
    const salt = encoder.encode(`coldfi-gk-${groupId}`);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 600000,
        hash: 'SHA-512',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } catch {
    throw new Error('Key derivation failed');
  }
}

export async function deriveMemberLogKey(
  gk: Uint8Array,
  memberIndex: number
): Promise<Uint8Array> {
  try {
    const prefix = new TextEncoder().encode('coldfi:member-log:');
    const saltBytes = new Uint8Array(prefix.length + 4);
    saltBytes.set(prefix);
    new DataView(saltBytes.buffer).setUint32(prefix.length, memberIndex, false);
    return derivePBKDF2Bytes(gk, saltBytes);
  } catch {
    throw new Error('Key derivation failed');
  }
}

export function generateSalt(length: number = SALT_LENGTH): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const IV_LENGTH = 12;
const TAG_LENGTH = 128;

export interface EncryptedPayload {
  ciphertext: string;
}

function aesEncrypt(
  aesKey: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    aesKey,
    data
  );
}

function aesDecrypt(
  aesKey: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    aesKey,
    data
  );
}

export async function encryptData(
  key: CryptoKey,
  plaintext: string
): Promise<string> {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await aesEncrypt(key, iv, encoded);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return uint8ArrayToBase64(combined);
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

export async function decryptData(
  key: CryptoKey,
  ciphertext: string
): Promise<string> {
  try {
    const combined = base64ToUint8Array(ciphertext);
    if (combined.length < IV_LENGTH + 16) {
      throw new Error('Ciphertext is too short to contain IV and auth tag');
    }
    const iv = combined.slice(0, IV_LENGTH);
    const encryptedData = combined.slice(IV_LENGTH);
    const decrypted = await aesDecrypt(key, iv, encryptedData);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

export async function encryptWithRawKey(
  key: Uint8Array,
  plaintext: string
): Promise<EncryptedPayload> {
  const aesKey = await crypto.subtle.importKey(
    'raw', key,
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt']
  );
  const ciphertext = await encryptData(aesKey, plaintext);
  return { ciphertext };
}

export async function decryptWithRawKey(
  key: Uint8Array,
  ciphertext: string
): Promise<string> {
  const aesKey = await crypto.subtle.importKey(
    'raw', key,
    { name: 'AES-GCM', length: 256 },
    false, ['decrypt']
  );
  return decryptData(aesKey, ciphertext);
}

export async function deriveKey(
  password: string,
  saltBase64: string
): Promise<CryptoKey> {
  const salt = base64ToUint8Array(saltBase64);
  const keyBytes = await derivePEK(password, salt);
  return importKey(keyBytes);
}

export function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJson<T>(
  key: Uint8Array,
  data: T
): Promise<EncryptedPayload> {
  return encryptWithRawKey(key, JSON.stringify(data));
}

export async function decryptJson<T>(
  key: Uint8Array,
  ciphertext: string
): Promise<T> {
  const plaintext = await decryptWithRawKey(key, ciphertext);
  return JSON.parse(plaintext) as T;
}
