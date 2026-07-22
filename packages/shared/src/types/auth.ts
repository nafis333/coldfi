export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  defaultCurrency: string;
  timezone: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  authKeyHash: string;
  personalSalt: string;
  encryptedPek: string;
  rawPek: string;
  displayName?: string;
}

export interface RegisterResponse {
  userId: string;
  personalSalt: string;
  encryptedPek: string;
  role: string;
  accessToken: string;
  displayName: string;
  recoveryCode: string;
}

export interface LoginRequest {
  email: string;
  authKeyHash: string;
}

export interface LoginResponse {
  accessToken?: string;
  role?: string;
  userId: string;
  displayName?: string;
  personalSalt: string;
  encryptedPek: string;
  email?: string;
  rawPek?: string;
  isGoogleUser?: boolean;
  requires2FA?: boolean;
  tempToken?: string;
}

export interface TwoFactorVerifyRequest {
  tempToken: string;
  code: string;
}

export interface TwoFactorVerifyResponse {
  accessToken: string;
  role: string;
  userId: string;
  displayName: string;
  personalSalt: string;
  encryptedPek: string;
  email: string;
  isGoogleUser: boolean;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface GoogleLoginResponse {
  accessToken: string;
  role: string;
  userId: string;
  displayName: string;
  personalSalt: string;
  encryptedPek: string;
  email: string;
  isGoogleUser: boolean;
  googleNewUser: boolean;
}

export interface ChangePasswordRequest {
  oldAuthKeyHash: string;
  newAuthKeyHash: string;
  personalSalt: string;
  encryptedPek: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  role: string;
  userId: string;
  displayName: string;
  personalSalt: string;
  encryptedPek: string;
  email: string;
  rawPek?: string;
  isGoogleUser: boolean;
}

export interface RecoverRequest {
  email: string;
  recoveryCode: string;
}

export interface RecoverResponse {
  tempToken: string;
  rawPek: string;
}

export interface RecoverCompleteRequest {
  tempToken: string;
  authKeyHash: string;
  personalSalt: string;
  encryptedPek: string;
}

export interface ProfileUpdateRequest {
  displayName?: string;
  defaultCurrency?: string;
  timezone?: string;
}
