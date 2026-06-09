export enum CryptoErrorCode {
  KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  INVALID_KEY = 'INVALID_KEY',
  INVALID_CIPHERTEXT = 'INVALID_CIPHERTEXT',
  INVALID_SALT = 'INVALID_SALT',
  INVALID_IV = 'INVALID_IV',
  RECOVERY_KEY_INVALID = 'RECOVERY_KEY_INVALID',
  RECOVERY_KEY_DECRYPT_FAILED = 'RECOVERY_KEY_DECRYPT_FAILED',
  PASSPHRASE_MISMATCH = 'PASSPHRASE_MISMATCH',
  UNSUPPORTED_ALGORITHM = 'UNSUPPORTED_ALGORITHM',
  CRYPTO_ENGINE_UNAVAILABLE = 'CRYPTO_ENGINE_UNAVAILABLE',
}

export class CryptoError extends Error {
  public readonly code: CryptoErrorCode;
  public readonly cause?: Error;

  constructor(code: CryptoErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'CryptoError';
    this.code = code;
    this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CryptoError);
    } else {
      this.stack = new Error().stack;
    }
  }

  toJSON(): { name: string; code: string; message: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
    };
  }

  static fromUnknown(error: unknown, fallbackCode?: CryptoErrorCode): CryptoError {
    if (error instanceof CryptoError) return error;
    if (error instanceof Error) return new CryptoError(fallbackCode ?? CryptoErrorCode.ENCRYPTION_FAILED, error.message, error);
    return new CryptoError(fallbackCode ?? CryptoErrorCode.ENCRYPTION_FAILED, String(error));
  }
}
