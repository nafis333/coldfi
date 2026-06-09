import { describe, it, expect, beforeAll } from 'vitest';
import {
  deriveAuthKey,
  derivePEK,
  deriveGroupKey,
  deriveMemberLogKey,
  generateSalt,
  uint8ArrayToHex,
} from '../crypto';
import {
  encryptWithRawKey,
  decryptWithRawKey,
  encryptJson,
  decryptJson,
} from '../crypto';
import {
  generateRecoveryPhrase,
  generateRecoveryBundle,
  recoverPEK,
  formatRecoveryPhraseForDisplay,
} from '../recovery';

describe('Key Derivation', () => {
  const testSalt = generateSalt();

  it('should derive auth keys deterministically', async () => {
    const key1 = await deriveAuthKey('test-passphrase', testSalt);
    const key2 = await deriveAuthKey('test-passphrase', testSalt);

    expect(uint8ArrayToHex(key1)).toBe(uint8ArrayToHex(key2));
  });

  it('should derive different keys for different passphrases', async () => {
    const key1 = await deriveAuthKey('passphrase-one', testSalt);
    const key2 = await deriveAuthKey('passphrase-two', testSalt);

    expect(uint8ArrayToHex(key1)).not.toBe(uint8ArrayToHex(key2));
  });

  it('should derive different keys for different salts', async () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const key1 = await deriveAuthKey('test-passphrase', salt1);
    const key2 = await deriveAuthKey('test-passphrase', salt2);

    expect(uint8ArrayToHex(key1)).not.toBe(uint8ArrayToHex(key2));
  });

  it('should return 32-byte Uint8Array keys', async () => {
    const authKey = await deriveAuthKey('test-passphrase', testSalt);
    const pek = await derivePEK('test-passphrase', testSalt);

    expect(authKey).toBeInstanceOf(Uint8Array);
    expect(authKey.length).toBe(32);
    expect(pek).toBeInstanceOf(Uint8Array);
    expect(pek.length).toBe(32);
  });

  it('should derive group key from passphrase and group id', async () => {
    const groupKey = await deriveGroupKey('group-passphrase', 'group-1');

    expect(groupKey).toBeInstanceOf(CryptoKey);
  });

  it('should derive different group keys for different group ids', async () => {
    const gk1 = await deriveGroupKey('test', 'group-a');
    const gk2 = await deriveGroupKey('test', 'group-b');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode('test-data');
    const ct1 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, gk1, plaintext));
    const ct2 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, gk2, plaintext));
    expect(uint8ArrayToHex(ct1)).not.toBe(uint8ArrayToHex(ct2));
  });

  it('should derive unique member log keys', async () => {
    const gkBytes = crypto.getRandomValues(new Uint8Array(32));
    const mk1 = await deriveMemberLogKey(gkBytes, 0);
    const mk2 = await deriveMemberLogKey(gkBytes, 1);

    expect(uint8ArrayToHex(mk1)).not.toBe(uint8ArrayToHex(mk2));
    expect(mk1.length).toBe(32);
    expect(mk2.length).toBe(32);
  });

  it('should generate random salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();

    expect(salt1).toHaveLength(32);
    expect(salt2).toHaveLength(32);
    expect(uint8ArrayToHex(salt1)).not.toBe(uint8ArrayToHex(salt2));
  });

  it('should generate salt of specified length', () => {
    const salt = generateSalt(16);
    expect(salt).toHaveLength(16);
  });
});

describe('AES-GCM Encryption', () => {
  let testKey: Uint8Array;

  beforeAll(() => {
    testKey = generateSalt();
  });

  it('should encrypt and decrypt roundtrip', async () => {
    const plaintext = 'Hello, ColdFi!';
    const encrypted = await encryptWithRawKey(testKey, plaintext);
    const decrypted = await decryptWithRawKey(testKey, encrypted.ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt empty string', async () => {
    const encrypted = await encryptWithRawKey(testKey, '');
    const decrypted = await decryptWithRawKey(testKey, encrypted.ciphertext);

    expect(decrypted).toBe('');
  });

  it('should encrypt and decrypt unicode', async () => {
    const plaintext = 'Hello 你好 مرحبا 🎉';
    const encrypted = await encryptWithRawKey(testKey, plaintext);
    const decrypted = await decryptWithRawKey(testKey, encrypted.ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt large data', async () => {
    const plaintext = 'x'.repeat(100000);
    const encrypted = await encryptWithRawKey(testKey, plaintext);
    const decrypted = await decryptWithRawKey(testKey, encrypted.ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', async () => {
    const plaintext = 'Same data twice';
    const enc1 = await encryptWithRawKey(testKey, plaintext);
    const enc2 = await encryptWithRawKey(testKey, plaintext);

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it('should fail to decrypt with wrong key', async () => {
    const plaintext = 'Secret data';
    const encrypted = await encryptWithRawKey(testKey, plaintext);
    const wrongKey = generateSalt();

    await expect(decryptWithRawKey(wrongKey, encrypted.ciphertext)).rejects.toThrow();
  });

  it('should fail to decrypt corrupted ciphertext', async () => {
    const { ciphertext } = await encryptWithRawKey(testKey, 'test data');
    const corrupted = ciphertext.slice(0, -4) + 'XXXX';

    await expect(decryptWithRawKey(testKey, corrupted)).rejects.toThrow();
  });

  it('should encrypt and decrypt JSON objects', async () => {
    const data = { name: 'Test', amount: 100.50, tags: ['a', 'b'] };
    const encrypted = await encryptJson(testKey, data);
    const decrypted = await decryptJson(testKey, encrypted.ciphertext);

    expect(decrypted).toEqual(data);
  });
});

describe('Recovery Key', () => {
  const userSalt = generateSalt();
  let testPek: Uint8Array;

  beforeAll(() => {
    testPek = generateSalt();
  });

  it('should generate recovery phrase', () => {
    const phrase = generateRecoveryPhrase();
    const words = phrase.split(' ');

    expect(words.length).toBe(24);
    for (const word of words) {
      expect(word.length).toBeGreaterThan(0);
    }
  });

  it('should generate recovery key bundle', async () => {
    const bundle = await generateRecoveryBundle(testPek, userSalt);

    expect(bundle.recoveryPhrase).toBeDefined();
    expect(bundle.encryptedPek).toBeDefined();
    expect(bundle.recoveryKeyHash).toBeDefined();
    expect(bundle.recoveryPhrase.split(' ').length).toBe(24);
  });

  it('should recover PEK from recovery phrase', async () => {
    const bundle = await generateRecoveryBundle(testPek, userSalt);
    const recoveredPek = await recoverPEK(bundle.recoveryPhrase, userSalt, bundle.encryptedPek);

    // Verify recovered PEK works
    const testData = 'recovery test data';
    const encrypted = await encryptWithRawKey(testPek, testData);
    const decrypted = await decryptWithRawKey(recoveredPek, encrypted.ciphertext);

    expect(decrypted).toBe(testData);
  });

  it('should fail with wrong recovery phrase', { timeout: 30000 }, async () => {
    const bundle = await generateRecoveryBundle(testPek, userSalt);
    const wrongPhrase = generateRecoveryPhrase();

    await expect(
      recoverPEK(wrongPhrase, userSalt, bundle.encryptedPek)
    ).rejects.toThrow();
  });

  it('should generate unique recovery phrases', async () => {
    const bundle1 = await generateRecoveryBundle(testPek, userSalt);
    const bundle2 = await generateRecoveryBundle(testPek, userSalt);

    expect(bundle1.recoveryPhrase).not.toBe(bundle2.recoveryPhrase);
  });
});
