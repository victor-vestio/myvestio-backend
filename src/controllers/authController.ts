import { Response } from "express";
import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { User } from "../models/User";
import JWTService from "../config/jwt";
import { EmailService } from "../services/emailService";
import { AuthenticatedRequest } from "../utils/types";
import { ApiResponse, UserStatus, UserRole } from "../interfaces/common";
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  LoginStepOneResponse,
  VerifyEmailOTPRequest,
  VerifyEmailOTPResponse,
  VerifyTwoFARequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  Verify2FARequest,
  Enable2FAResponse,
} from "../interfaces/IUser";

export class AuthController {
  static async register(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<AuthResponse>>
  ): Promise<void> {
    try {
      const userData: RegisterRequest = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        email: userData.email.toLowerCase(),
      });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "Registration failed",
          error: "User with this email already exists",
        });
        return;
      }

      // Create new user
      const user = new User({
        ...userData,
        email: userData.email.toLowerCase(),
        status: UserStatus.PENDING_VERIFICATION,
      });

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Generate JWT tokens
      const tokens = JWTService.generateTokens(user);

      // Store refresh token
      const refreshTokenHash = crypto
        .createHash("sha256")
        .update(tokens.refreshToken)
        .digest("hex");
      user.refreshToken = refreshTokenHash;
      await user.save();

      // Send welcome email with verification
      await EmailService.sendWelcomeEmail(user, verificationToken);

      const response: AuthResponse = {
        user: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isKYCApproved: user.isKYCApproved,
          isEmailVerified: user.isEmailVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: response,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: "Internal server error",
      });
    }
  }

  static async login(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<LoginStepOneResponse>>
  ): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      // Find user and include password for comparison
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password"
      );

      if (!user || !(await user.comparePassword(password))) {
        res.status(401).json({
          success: false,
          message: "Login failed",
          error: "Invalid email or password",
        });
        return;
      }

      // Check if account is suspended
      if (user.status === UserStatus.SUSPENDED) {
        res.status(403).json({
          success: false,
          message: "Login failed",
          error: "Account has been suspended. Please contact support.",
        });
        return;
      }

      // Generate login token and email OTP (ALWAYS for every login)
      const loginToken = crypto.randomBytes(32).toString("hex");
      const emailOTP = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

      const hashedLoginToken = crypto
        .createHash("sha256")
        .update(loginToken)
        .digest("hex");
      const hashedEmailOTP = crypto
        .createHash("sha256")
        .update(emailOTP)
        .digest("hex");

      // Store tokens with configurable expiry
      const tokenExpiryMinutes = parseInt(
        process.env.LOGIN_TOKEN_EXPIRY_MINUTES || "5"
      );
      const otpExpiryMinutes = parseInt(
        process.env.EMAIL_OTP_EXPIRY_MINUTES || "5"
      );

      user.loginToken = hashedLoginToken;
      user.loginTokenExpires = new Date(
        Date.now() + tokenExpiryMinutes * 60 * 1000
      );
      user.emailOTP = hashedEmailOTP;
      user.emailOTPExpires = new Date(
        Date.now() + otpExpiryMinutes * 60 * 1000
      );
      await user.save();

      // Send email OTP
      const emailSent = await EmailService.sendLoginOTP(user, emailOTP);
      if (!emailSent) {
        res.status(500).json({
          success: false,
          message: "Failed to send verification email",
          error: "Email service unavailable",
        });
        return;
      }

      const userData = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isKYCApproved: user.isKYCApproved,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      };

      const response: LoginStepOneResponse = {
        message: "Please check your email for the verification code",
        loginToken,
        user: userData,
      };

      res.status(200).json({
        success: true,
        message: "Verification code sent to your email",
        data: response,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: "Internal server error",
      });
    }
  }

  static async verifyEmailOTP(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<VerifyEmailOTPResponse>>
  ): Promise<void> {
    try {
      const { loginToken, emailOTP }: VerifyEmailOTPRequest = req.body;

      // Universal dev OTP bypass in development
      if (process.env.NODE_ENV === "development" && emailOTP === "000000") {
        console.log(
          `[DEV] Using universal dev OTP for login token: ${loginToken}`
        );

        // Find user with just the login token (skip OTP verification)
        const hashedLoginToken = crypto
          .createHash("sha256")
          .update(loginToken)
          .digest("hex");

        const user = await User.findOne({
          loginToken: hashedLoginToken,
          loginTokenExpires: { $gt: new Date() },
        }).select("+twoFactorSecret");

        if (!user) {
          res.status(401).json({
            success: false,
            message: "Verification failed",
            error: "Invalid or expired login token",
          });
          return;
        }

        // Clear login token (but skip OTP clearing since we didn't verify it)
        user.loginToken = undefined;
        user.loginTokenExpires = undefined;
        user.emailOTP = undefined;
        user.emailOTPExpires = undefined;

        const userData = {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isKYCApproved: user.isKYCApproved,
          isEmailVerified: user.isEmailVerified,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
        };

        // Check if 2FA is enabled
        if (user.isTwoFactorEnabled) {
          // Generate 2FA token for next step
          const twoFAToken = crypto.randomBytes(32).toString("hex");
          const hashedTwoFAToken = crypto
            .createHash("sha256")
            .update(twoFAToken)
            .digest("hex");

          const twoFATokenExpiryMinutes = parseInt(
            process.env.TWO_FA_TOKEN_EXPIRY_MINUTES || "5"
          );

          user.twoFAToken = hashedTwoFAToken;
          user.twoFATokenExpires = new Date(
            Date.now() + twoFATokenExpiryMinutes * 60 * 1000
          );
          await user.save();

          const response: VerifyEmailOTPResponse = {
            requires2FA: true,
            twoFAToken,
            user: userData,
          };

          res.status(200).json({
            success: true,
            message:
              "[DEV] Universal OTP accepted. Please provide your 2FA authenticator code",
            data: response,
          });
          return;
        }

        // No 2FA required - complete login
        await user.save();

        // Update last login and activate account if pending
        user.lastLogin = new Date();
        if (user.status === UserStatus.PENDING_VERIFICATION) {
          user.status = UserStatus.ACTIVE;
        }

        // Generate new tokens
        const tokens = JWTService.generateTokens(user);

        // Store refresh token
        const refreshTokenHash = crypto
          .createHash("sha256")
          .update(tokens.refreshToken)
          .digest("hex");
        user.refreshToken = refreshTokenHash;
        await user.save();

        // Send login alert email (optional)
        const loginDetails = {
          ip: req.ip || "Unknown",
          userAgent: req.get("User-Agent") || "Unknown",
          timestamp: new Date(),
        };
        EmailService.sendLoginAlert(user, loginDetails).catch(console.error);

        const response: VerifyEmailOTPResponse = {
          requires2FA: false,
          user: userData,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        };

        res.status(200).json({
          success: true,
          message: "[DEV] Login successful with universal OTP",
          data: response,
        });
        return;
      }

      // Normal OTP verification for production or non-dev OTP
      const hashedLoginToken = crypto
        .createHash("sha256")
        .update(loginToken)
        .digest("hex");
      const hashedEmailOTP = crypto
        .createHash("sha256")
        .update(emailOTP)
        .digest("hex");

      // Find user with matching tokens
      const user = await User.findOne({
        loginToken: hashedLoginToken,
        loginTokenExpires: { $gt: new Date() },
        emailOTP: hashedEmailOTP,
        emailOTPExpires: { $gt: new Date() },
      }).select("+twoFactorSecret");

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Verification failed",
          error: "Invalid or expired verification code",
        });
        return;
      }

      // Clear email OTP tokens
      user.loginToken = undefined;
      user.loginTokenExpires = undefined;
      user.emailOTP = undefined;
      user.emailOTPExpires = undefined;

      const userData = {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isKYCApproved: user.isKYCApproved,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      };

      // Check if 2FA is enabled
      if (user.isTwoFactorEnabled) {
        // Generate 2FA token for next step
        const twoFAToken = crypto.randomBytes(32).toString("hex");
        const hashedTwoFAToken = crypto
          .createHash("sha256")
          .update(twoFAToken)
          .digest("hex");

        const twoFATokenExpiryMinutes = parseInt(
          process.env.TWO_FA_TOKEN_EXPIRY_MINUTES || "5"
        );

        user.twoFAToken = hashedTwoFAToken;
        user.twoFATokenExpires = new Date(
          Date.now() + twoFATokenExpiryMinutes * 60 * 1000
        );
        await user.save();

        const response: VerifyEmailOTPResponse = {
          requires2FA: true,
          twoFAToken,
          user: userData,
        };

        res.status(200).json({
          success: true,
          message: "Please provide your 2FA authenticator code",
          data: response,
        });
        return;
      }

      // No 2FA required - complete login
      await user.save();

      // Update last login and activate account if pending
      user.lastLogin = new Date();
      if (user.status === UserStatus.PENDING_VERIFICATION) {
        user.status = UserStatus.ACTIVE;
      }

      // Generate new tokens
      const tokens = JWTService.generateTokens(user);

      // Store refresh token
      const refreshTokenHash = crypto
        .createHash("sha256")
        .update(tokens.refreshToken)
        .digest("hex");
      user.refreshToken = refreshTokenHash;
      await user.save();

      // Send login alert email (optional)
      const loginDetails = {
        ip: req.ip || "Unknown",
        userAgent: req.get("User-Agent") || "Unknown",
        timestamp: new Date(),
      };
      EmailService.sendLoginAlert(user, loginDetails).catch(console.error);

      const response: VerifyEmailOTPResponse = {
        requires2FA: false,
        user: userData,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: response,
      });
    } catch (error: any) {
      console.error("Email OTP verification error:", error);
      res.status(500).json({
        success: false,
        message: "Verification failed",
        error: "Internal server error",
      });
    }
  }

  static async verifyTwoFA(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<AuthResponse>>
  ): Promise<void> {
    try {
      const { twoFAToken, twoFACode }: VerifyTwoFARequest = req.body;

      // Universal dev 2FA bypass in development
      if (process.env.NODE_ENV === "development" && twoFACode === "000000") {
        console.log(
          `[DEV] Using universal dev 2FA code for token: ${twoFAToken}`
        );

        // Find user with just the 2FA token (skip 2FA verification)
        const hashedTwoFAToken = crypto
          .createHash("sha256")
          .update(twoFAToken)
          .digest("hex");

        const user = await User.findOne({
          twoFAToken: hashedTwoFAToken,
          twoFATokenExpires: { $gt: new Date() },
        }).select("+twoFactorSecret");

        if (!user) {
          res.status(401).json({
            success: false,
            message: "2FA verification failed",
            error: "Invalid or expired 2FA token",
          });
          return;
        }

        // Clear 2FA token
        user.twoFAToken = undefined;
        user.twoFATokenExpires = undefined;

        // Complete the login process with dev message
        console.log(
          `[DEV] Completing login with universal 2FA for user: ${user.email}`
        );
        await AuthController.completeLoginWithAuthResponse(user, req, res);
        return;
      }

      // Normal 2FA verification for production or non-dev 2FA
      const hashedTwoFAToken = crypto
        .createHash("sha256")
        .update(twoFAToken)
        .digest("hex");

      // Find user with matching 2FA token
      const user = await User.findOne({
        twoFAToken: hashedTwoFAToken,
        twoFATokenExpires: { $gt: new Date() },
      }).select("+twoFactorSecret");

      if (!user) {
        res.status(401).json({
          success: false,
          message: "2FA verification failed",
          error: "Invalid or expired 2FA token",
        });
        return;
      }

      // Verify 2FA code
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: "base32",
        token: twoFACode,
        window: 2,
      });

      if (!verified) {
        res.status(401).json({
          success: false,
          message: "2FA verification failed",
          error: "Invalid 2FA code",
        });
        return;
      }

      // Clear 2FA token
      user.twoFAToken = undefined;
      user.twoFATokenExpires = undefined;

      // Complete the login process
      await AuthController.completeLoginWithAuthResponse(user, req, res);
    } catch (error: any) {
      console.error("2FA verification error:", error);
      res.status(500).json({
        success: false,
        message: "2FA verification failed",
        error: "Internal server error",
      });
    }
  }

  private static async completeLoginWithAuthResponse(
    user: any,
    req: AuthenticatedRequest,
    res: Response<ApiResponse<AuthResponse>>
  ): Promise<void> {
    // Update last login and activate account if pending
    user.lastLogin = new Date();
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      user.status = UserStatus.ACTIVE;
    }

    // Generate new tokens
    const tokens = JWTService.generateTokens(user);

    // Store refresh token
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(tokens.refreshToken)
      .digest("hex");
    user.refreshToken = refreshTokenHash;
    await user.save();

    // Send login alert email (optional)
    const loginDetails = {
      ip: req.ip || "Unknown",
      userAgent: req.get("User-Agent") || "Unknown",
      timestamp: new Date(),
    };
    EmailService.sendLoginAlert(user, loginDetails).catch(console.error);

    const response: AuthResponse = {
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isKYCApproved: user.isKYCApproved,
        isEmailVerified: user.isEmailVerified,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: response,
    });
  }

  static async logout(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      if (req.user) {
        // Clear refresh token
        req.user.refreshToken = undefined;
        await req.user.save();
      }

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Logout failed",
        error: "Internal server error",
      });
    }
  }

  static async refreshToken(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<{ accessToken: string }>>
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: "Refresh failed",
          error: "Refresh token is required",
        });
        return;
      }

      // Verify refresh token
      const payload = JWTService.verifyRefreshToken(refreshToken);

      // Find user with matching refresh token
      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      const user = await User.findOne({
        _id: payload.userId,
        refreshToken: hashedToken,
        status: UserStatus.ACTIVE,
      });

      if (!user) {
        res.status(401).json({
          success: false,
          message: "Refresh failed",
          error: "Invalid refresh token",
        });
        return;
      }

      // Generate new access token
      const newAccessToken = JWTService.generateAccessToken({
        userId: user.userId,
        email: user.email,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: { accessToken: newAccessToken },
      });
    } catch (error: any) {
      console.error("Refresh token error:", error);
      res.status(401).json({
        success: false,
        message: "Refresh failed",
        error: "Invalid or expired refresh token",
      });
    }
  }

  static async getProfile(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = req.user!;

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          role: user.role,
          businessType: user.businessType,
          businessName: user.businessName,
          status: user.status,
          isEmailVerified: user.isEmailVerified,
          isKYCApproved: user.isKYCApproved,
          isTwoFactorEnabled: user.isTwoFactorEnabled,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      console.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
        error: "Internal server error",
      });
    }
  }

  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = req.user!;
      const updates: UpdateProfileRequest = req.body;

      // Update allowed fields
      Object.keys(updates).forEach((key) => {
        if (updates[key as keyof UpdateProfileRequest] !== undefined) {
          (user as any)[key] = updates[key as keyof UpdateProfileRequest];
        }
      });

      await user.save();

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          businessName: user.businessName,
        },
      });
    } catch (error: any) {
      console.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update profile",
        error: "Internal server error",
      });
    }
  }

  static async changePassword(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = await User.findById(req.user!._id).select("+password");
      const { currentPassword, newPassword }: ChangePasswordRequest = req.body;

      if (!user || !(await user.comparePassword(currentPassword))) {
        res.status(400).json({
          success: false,
          message: "Password change failed",
          error: "Current password is incorrect",
        });
        return;
      }

      user.password = newPassword;
      user.refreshToken = undefined; // Invalidate all refresh tokens
      await user.save();

      // Send confirmation email
      await EmailService.sendPasswordResetSuccess(user);

      res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error: any) {
      console.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: "Internal server error",
      });
    }
  }

  static async forgotPassword(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const { email }: ForgotPasswordRequest = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });

      // Always return success to prevent email enumeration
      if (!user) {
        res.status(200).json({
          success: true,
          message:
            "If an account with this email exists, a password reset link has been sent",
        });
        return;
      }

      // Generate reset token
      const resetToken = user.generatePasswordResetToken();
      await user.save();

      // Send reset email
      const emailSent = await EmailService.sendPasswordReset(user, resetToken);

      if (!emailSent) {
        res.status(500).json({
          success: false,
          message: "Failed to send password reset email",
          error: "Email service unavailable",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Password reset link has been sent to your email",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process password reset request",
        error: "Internal server error",
      });
    }
  }

  static async resetPassword(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const { token, password }: ResetPasswordRequest = req.body;

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: new Date() },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: "Password reset failed",
          error: "Invalid or expired reset token",
        });
        return;
      }

      // Update password and clear reset token
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.refreshToken = undefined; // Invalidate all refresh tokens
      await user.save();

      // Send confirmation email
      await EmailService.sendPasswordResetSuccess(user);

      res.status(200).json({
        success: true,
        message: "Password has been reset successfully",
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset password",
        error: "Internal server error",
      });
    }
  }

  static async verifyEmail(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const { token }: VerifyEmailRequest = req.body;

      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date() },
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: "Email verification failed",
          error: "Invalid or expired verification token",
        });
        return;
      }

      // Mark email as verified
      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      if (user.status === UserStatus.PENDING_VERIFICATION) {
        user.status = UserStatus.ACTIVE;
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error: any) {
      console.error("Verify email error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify email",
        error: "Internal server error",
      });
    }
  }

  static async resendVerificationEmail(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = req.user!;

      if (user.isEmailVerified) {
        res.status(400).json({
          success: false,
          message: "Email already verified",
          error: "Your email address is already verified",
        });
        return;
      }

      // Generate new verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send verification email
      const emailSent = await EmailService.sendEmailVerification(
        user,
        verificationToken
      );

      if (!emailSent) {
        res.status(500).json({
          success: false,
          message: "Failed to send verification email",
          error: "Email service unavailable",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Verification email has been sent",
      });
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to resend verification email",
        error: "Internal server error",
      });
    }
  }

  static async enable2FA(
    req: AuthenticatedRequest,
    res: Response<ApiResponse<Enable2FAResponse>>
  ): Promise<void> {
    try {
      const user = req.user!;

      if (user.isTwoFactorEnabled) {
        res.status(400).json({
          success: false,
          message: "2FA already enabled",
          error:
            "Two-factor authentication is already enabled for this account",
        });
        return;
      }

      // Generate 2FA secret
      const secret = speakeasy.generateSecret({
        name: `Vestio (${user.email})`,
        issuer: "Vestio",
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      // Generate backup codes
      const backupCodes = Array.from({ length: 8 }, () =>
        crypto.randomBytes(4).toString("hex").toUpperCase()
      );

      // Store secret (but don't enable 2FA yet)
      user.twoFactorSecret = secret.base32;
      await user.save();

      res.status(200).json({
        success: true,
        message:
          "2FA setup initiated. Please verify with your authenticator app.",
        data: {
          twoFASecret: secret.base32,
          qrCodeDataUrl: qrCode,
          backupCodes,
        },
      });
    } catch (error: any) {
      console.error("Enable 2FA error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to enable 2FA",
        error: "Internal server error",
      });
    }
  }

  static async verify2FA(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = await User.findById(req.user!._id).select(
        "+twoFactorSecret"
      );
      const { token }: Verify2FARequest = req.body;

      if (!user || !user.twoFactorSecret) {
        res.status(400).json({
          success: false,
          message: "2FA verification failed",
          error: "2FA setup not initiated",
        });
        return;
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token,
        window: 2,
      });

      if (!verified) {
        res.status(400).json({
          success: false,
          message: "2FA verification failed",
          error: "Invalid verification code",
        });
        return;
      }

      // Enable 2FA
      user.isTwoFactorEnabled = true;
      await user.save();

      // Send confirmation email
      await EmailService.send2FAEnabled(user);

      res.status(200).json({
        success: true,
        message: "2FA has been successfully enabled",
      });
    } catch (error: any) {
      console.error("Verify 2FA error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to verify 2FA",
        error: "Internal server error",
      });
    }
  }

  static async disable2FA(
    req: AuthenticatedRequest,
    res: Response<ApiResponse>
  ): Promise<void> {
    try {
      const user = await User.findById(req.user!._id).select("+password");
      const { password } = req.body;

      if (!user || !(await user.comparePassword(password))) {
        res.status(400).json({
          success: false,
          message: "2FA disable failed",
          error: "Invalid password",
        });
        return;
      }

      if (!user.isTwoFactorEnabled) {
        res.status(400).json({
          success: false,
          message: "2FA not enabled",
          error: "Two-factor authentication is not enabled for this account",
        });
        return;
      }

      // Disable 2FA
      user.isTwoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save();

      res.status(200).json({
        success: true,
        message: "2FA has been disabled",
      });
    } catch (error: any) {
      console.error("Disable 2FA error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to disable 2FA",
        error: "Internal server error",
      });
    }
  }
}
