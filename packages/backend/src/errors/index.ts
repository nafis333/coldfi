export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly cause?: Error;

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    cause?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: this.stack }),
    };
  }
}

export class ValidationError extends AppError {
  public readonly details?: any;

  constructor(message: string, details?: any) {
    super('ERR_VALIDATION', message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export type AuthErrorCode =
  | 'ERR_UNAUTHORIZED'
  | 'ERR_TOKEN_EXPIRED'
  | 'ERR_INVALID_CREDENTIALS'
  | 'ERR_USER_LOCKED'
  | 'ERR_2FA_REQUIRED'
  | 'ERR_2FA_INVALID'
  | 'ERR_EMAIL_EXISTS'
  | 'ERR_INVALID_TOKEN'
  | 'ERR_TOKEN_REVOKED'
  | 'ERR_TOKEN_REUSED'
  | 'ERR_2FA_NOT_SETUP'
  | 'ERR_INVALID_PASSWORD'
  | 'ERR_NO_REFRESH_TOKEN'
  | 'ERR_TEMP_TOKEN_EXPIRED'
  | 'ERR_INVALID_2FA'
  | 'ERR_WRONG_PASSPHRASE'
  | 'ERR_INVALID_RECOVERY'
  | 'ERR_RECOVERY_FAILED'
  | 'ERR_GOOGLE_NOT_CONFIGURED'
  | 'ERR_INVALID_GOOGLE_TOKEN';

export class AuthError extends AppError {
  constructor(
    code: AuthErrorCode,
    message: string,
    statusCode: number = 401
  ) {
    super(code, message, statusCode);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super('ERR_FORBIDDEN', message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super('ERR_NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super('ERR_CONFLICT', message, 409);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super('ERR_RATE_LIMIT', message, 429);
    this.name = 'RateLimitError';
  }
}

export class GroupError extends AppError {
  constructor(
    code:
      | 'ERR_NOT_GROUP_MEMBER'
      | 'ERR_GROUP_NOT_FOUND'
      | 'ERR_GROUP_FULL'
      | 'ERR_ALREADY_MEMBER'
      | 'ERR_NOT_ADMIN'
      | 'ERR_NO_ACTIVE_MEMBERS',
    message: string,
    statusCode: number = 403
  ) {
    super(code, message, statusCode);
    this.name = 'GroupError';
  }
}

export class SettlementError extends AppError {
  constructor(
    code:
      | 'ERR_PROPOSAL_NOT_FOUND'
      | 'ERR_INVALID_STATUS'
      | 'ERR_NOT_PAYER'
      | 'ERR_NOT_RECEIVER'
      | 'ERR_INVALID_PARTIAL_AMOUNT',
    message: string
  ) {
    const status = code === 'ERR_PROPOSAL_NOT_FOUND' ? 404 : 400;
    super(code, message, status);
    this.name = 'SettlementError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, cause?: Error) {
    super('ERR_DATABASE', message, 500, true, cause);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, cause?: Error) {
    super('ERR_EXTERNAL_SERVICE', `[${service}] ${message}`, 502, true, cause);
    this.name = 'ExternalServiceError';
  }
}

export const ERROR_CODES = {
  ERR_UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  ERR_TOKEN_EXPIRED: { status: 401, message: 'Token expired' },
  ERR_INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  ERR_USER_LOCKED: { status: 423, message: 'Account temporarily locked' },
  ERR_2FA_REQUIRED: { status: 401, message: 'Two-factor code required' },
  ERR_2FA_INVALID: { status: 401, message: 'Invalid two-factor code' },
  ERR_EMAIL_EXISTS: { status: 409, message: 'Email already registered' },
  ERR_INVALID_TOKEN: { status: 401, message: 'Invalid token' },
  ERR_TOKEN_REVOKED: { status: 401, message: 'Token revoked' },
  ERR_VALIDATION: { status: 400, message: 'Validation failed' },
  ERR_FORBIDDEN: { status: 403, message: 'Access denied' },
  ERR_NOT_GROUP_MEMBER: { status: 403, message: 'Not a group member' },
  ERR_NOT_ADMIN: { status: 403, message: 'Admin access required' },
  ERR_NOT_FOUND: { status: 404, message: 'Resource not found' },
  ERR_GROUP_NOT_FOUND: { status: 404, message: 'Group not found' },
  ERR_CONFLICT: { status: 409, message: 'Data conflict' },
  ERR_RATE_LIMIT: { status: 429, message: 'Too many requests' },
  ERR_INTERNAL: { status: 500, message: 'Internal server error' },
  ERR_DATABASE: { status: 500, message: 'Database error' },
  ERR_EXTERNAL_SERVICE: { status: 502, message: 'External service error' },
  ERR_GROUP_FULL: { status: 400, message: 'Group is full' },
  ERR_ALREADY_MEMBER: { status: 400, message: 'Already a group member' },
  ERR_WRONG_PASSPHRASE: { status: 403, message: 'Invalid group passphrase' },
  ERR_NO_ACTIVE_MEMBERS: { status: 400, message: 'No active members to split with' },
  ERR_2FA_NOT_SETUP: { status: 400, message: 'Two-factor auth not set up' },
  ERR_INVALID_PASSWORD: { status: 401, message: 'Current password is incorrect' },
  ERR_NO_REFRESH_TOKEN: { status: 401, message: 'No refresh token provided' },
  ERR_TEMP_TOKEN_EXPIRED: { status: 401, message: 'Temporary token expired' },
  ERR_INVALID_2FA: { status: 401, message: 'Invalid two-factor code' },
  ERR_INVALID_RECOVERY: { status: 401, message: 'Invalid recovery code' },
  ERR_RECOVERY_FAILED: { status: 400, message: 'Account recovery failed' },
  ERR_SYNC_FAILED: { status: 500, message: 'Data sync failed' },
  ERR_SYNC_CONFLICT: { status: 409, message: 'Sync conflict detected' },
  ERR_PROPOSAL_NOT_FOUND: { status: 404, message: 'Proposal not found' },
  ERR_INVALID_STATUS: { status: 400, message: 'Invalid proposal status' },
  ERR_NOT_PAYER: { status: 403, message: 'Only the payer can perform this action' },
  ERR_NOT_RECEIVER: { status: 403, message: 'Only the receiver can confirm' },
  ERR_INVALID_PARTIAL_AMOUNT: { status: 400, message: 'Invalid partial amount' },
  ERR_UNKNOWN: { status: 500, message: 'An unknown error occurred' },
} as const;
