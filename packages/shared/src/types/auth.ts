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
  refreshTokenId: string;
}

export interface RegisterRequest {
  email: string;
  authKeyHash: string;
  displayName?: string;
}

export interface RegisterResponse {
  userId: string;
  personalSalt: string;
}

export interface LoginRequest {
  email: string;
  authKeyHash: string;
}

export interface LoginResponse {
  accessToken: string;
  personalSalt: string;
  displayName: string;
  twoFactorRequired: boolean;
  tempToken?: string;
}

export interface TwoFactorVerifyRequest {
  tempToken: string;
  totpCode: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  newAuthKeyHash: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
}
