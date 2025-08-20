import { Document } from 'mongoose';
import { UserRole, BusinessType, UserStatus } from './common';

export interface IUser extends Document {
  _id: string;
  userId: string; // Virtual field for easier access
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  businessType?: BusinessType;
  businessName?: string;
  status: UserStatus;
  isEmailVerified: boolean;
  isKYCApproved: boolean;
  
  // 2FA
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  
  // Security
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  
  // Login OTP tokens
  loginToken?: string;
  loginTokenExpires?: Date;
  emailOTP?: string;
  emailOTPExpires?: Date;
  twoFAToken?: string;
  twoFATokenExpires?: Date;
  
  // Timestamps
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateRefreshToken(): string;
  generatePasswordResetToken(): string;
  generateEmailVerificationToken(): string;
}

// Request interfaces for auth endpoints
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  businessType?: BusinessType;
  businessName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface LoginStepOneResponse {
  message: string;
  loginToken: string; // Always need token for OTP step
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isKYCApproved: boolean;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
  };
}

export interface VerifyEmailOTPRequest {
  loginToken: string;
  emailOTP: string;
}

export interface VerifyEmailOTPResponse {
  requires2FA: boolean;
  twoFAToken?: string; // Token for 2FA step if needed
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isKYCApproved: boolean;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
  };
  accessToken?: string; // Full JWT if no 2FA required
  refreshToken?: string;
}

export interface VerifyTwoFARequest {
  twoFAToken: string;
  twoFACode: string;
}

export interface AuthResponse {
  user: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isKYCApproved: boolean;
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  businessName?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface Enable2FAResponse {
  twoFASecret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export interface Verify2FARequest {
  token: string;
}