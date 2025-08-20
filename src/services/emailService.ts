import { getResendClient } from '../config/resend';
import { EmailOptions, EmailTemplate } from '../utils/types';
import { IUser } from '../interfaces/IUser';

export class EmailService {
  private static fromEmail = process.env.FROM_EMAIL || 'noreply@myvestio.net';
  private static frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  private static getResend() {
    return getResendClient();
  }

  private static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const emailData: any = {
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html || options.text || ''
      };

      if (options.text) {
        emailData.text = options.text;
      }

      await this.getResend().emails.send(emailData);
      
      console.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  static async sendWelcomeEmail(user: IUser, verificationToken?: string): Promise<boolean> {
    const template = this.getWelcomeTemplate(user, verificationToken);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendEmailVerification(user: IUser, verificationToken: string): Promise<boolean> {
    const template = this.getEmailVerificationTemplate(user, verificationToken);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendPasswordReset(user: IUser, resetToken: string): Promise<boolean> {
    const template = this.getPasswordResetTemplate(user, resetToken);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendPasswordResetSuccess(user: IUser): Promise<boolean> {
    const template = this.getPasswordResetSuccessTemplate(user);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async send2FAEnabled(user: IUser): Promise<boolean> {
    const template = this.get2FAEnabledTemplate(user);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendLoginOTP(user: IUser, otpCode: string): Promise<boolean> {
    const template = this.getLoginOTPTemplate(user, otpCode);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendLoginAlert(user: IUser, loginDetails: { ip: string; userAgent: string; timestamp: Date }): Promise<boolean> {
    const template = this.getLoginAlertTemplate(user, loginDetails);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  private static getWelcomeTemplate(user: IUser, verificationToken?: string): EmailTemplate {
    const verificationLink = verificationToken 
      ? `${this.frontendUrl}/verify-email?token=${verificationToken}`
      : null;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Welcome to Vestio, ${user.firstName}!</h1>
          
          <p>Thank you for joining Vestio, the premier invoice financing platform. We're excited to have you as part of our community.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Your Account Details:</h3>
            <p><strong>Name:</strong> ${user.firstName} ${user.lastName}</p>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Role:</strong> ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</p>
          </div>
          
          ${verificationLink ? `
            <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h3>Verify Your Email Address</h3>
              <p>To complete your registration and access all features, please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${verificationLink}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
              </div>
              <p style="font-size: 12px; color: #666;">This link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
            </div>
          ` : ''}
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>The Vestio Team</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Welcome to Vestio, ${user.firstName}!
      
      Thank you for joining Vestio, the premier invoice financing platform.
      
      Your Account Details:
      Name: ${user.firstName} ${user.lastName}
      Email: ${user.email}
      Role: ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
      
      ${verificationToken ? `
      Verify Your Email Address:
      To complete your registration, please visit: ${verificationLink}
      This link will expire in 24 hours.
      ` : ''}
      
      If you have any questions, please contact our support team.
      
      Best regards,
      The Vestio Team
    `;

    return {
      subject: 'Welcome to Vestio - Your Invoice Financing Platform',
      htmlContent,
      textContent
    };
  }

  private static getEmailVerificationTemplate(user: IUser, verificationToken: string): EmailTemplate {
    const verificationLink = `${this.frontendUrl}/verify-email?token=${verificationToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Verify Your Email Address</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Please verify your email address to complete your Vestio account setup and access all features.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email Address</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">${verificationLink}</p>
          
          <p style="font-size: 12px; color: #666; margin-top: 30px;">This verification link will expire in 24 hours. If you didn't create this account, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Verify Your Email Address
      
      Hello ${user.firstName},
      
      Please verify your email address to complete your Vestio account setup.
      
      Verification link: ${verificationLink}
      
      This link will expire in 24 hours. If you didn't create this account, please ignore this email.
    `;

    return {
      subject: 'Verify Your Email Address - Vestio',
      htmlContent,
      textContent
    };
  }

  private static getPasswordResetTemplate(user: IUser, resetToken: string): EmailTemplate {
    const resetLink = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Your Password - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Reset Your Password</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>We received a request to reset your password for your Vestio account. Click the button below to set a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 3px;">${resetLink}</p>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Security Notice:</strong> This password reset link will expire in 10 minutes for security reasons. If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Reset Your Password
      
      Hello ${user.firstName},
      
      We received a request to reset your password for your Vestio account.
      
      Reset link: ${resetLink}
      
      This link will expire in 10 minutes for security reasons. If you didn't request this reset, please ignore this email.
    `;

    return {
      subject: 'Reset Your Password - Vestio',
      htmlContent,
      textContent
    };
  }

  private static getPasswordResetSuccessTemplate(user: IUser): EmailTemplate {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset Successful - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #27ae60;">Password Reset Successful</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Your password has been successfully reset for your Vestio account.</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <p style="margin: 0;"><strong>Security Confirmation:</strong> If you didn't make this change, please contact our support team immediately.</p>
          </div>
          
          <p>For security reasons, we recommend that you:</p>
          <ul>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication</li>
            <li>Keep your account information secure</li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Password Reset Successful
      
      Hello ${user.firstName},
      
      Your password has been successfully reset for your Vestio account.
      
      If you didn't make this change, please contact our support team immediately.
    `;

    return {
      subject: 'Password Reset Successful - Vestio',
      htmlContent,
      textContent
    };
  }

  private static get2FAEnabledTemplate(user: IUser): EmailTemplate {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Two-Factor Authentication Enabled - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #27ae60;">Two-Factor Authentication Enabled</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Two-factor authentication (2FA) has been successfully enabled for your Vestio account. Your account is now more secure!</p>
          
          <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <p style="margin: 0;"><strong>Enhanced Security:</strong> Your account is now protected by an additional layer of security. You'll need your authenticator app to log in.</p>
          </div>
          
          <p>Important reminders:</p>
          <ul>
            <li>Keep your backup codes in a safe place</li>
            <li>Don't share your 2FA codes with anyone</li>
            <li>If you lose access to your authenticator app, use your backup codes</li>
          </ul>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Two-Factor Authentication Enabled
      
      Hello ${user.firstName},
      
      2FA has been successfully enabled for your Vestio account.
      
      Keep your backup codes safe and don't share your 2FA codes with anyone.
    `;

    return {
      subject: 'Two-Factor Authentication Enabled - Vestio',
      htmlContent,
      textContent
    };
  }

  private static getLoginOTPTemplate(user: IUser, otpCode: string): EmailTemplate {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Login Verification Code - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">Login Verification Code</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>Please use the following code to complete your login to Vestio:</p>
          
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #2c3e50; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otpCode}
            </div>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Security Notice:</strong> This code will expire in 5 minutes. If you didn't request this code, please ignore this email and consider changing your password.</p>
          </div>
          
          <p>For your security, never share this code with anyone. Vestio will never ask for your verification code via phone or email.</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      Login Verification Code
      
      Hello ${user.firstName},
      
      Please use the following code to complete your login to Vestio:
      
      ${otpCode}
      
      This code will expire in 5 minutes. If you didn't request this code, please ignore this email.
    `;

    return {
      subject: 'Your Vestio Login Code',
      htmlContent,
      textContent
    };
  }

  private static getLoginAlertTemplate(user: IUser, loginDetails: { ip: string; userAgent: string; timestamp: Date }): EmailTemplate {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Login Alert - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #f39c12;">New Login Alert</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>We detected a new login to your Vestio account. If this was you, you can safely ignore this email.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Login Details:</h3>
            <p><strong>Time:</strong> ${loginDetails.timestamp.toLocaleString()}</p>
            <p><strong>IP Address:</strong> ${loginDetails.ip}</p>
            <p><strong>Device:</strong> ${loginDetails.userAgent}</p>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Security Alert:</strong> If you didn't log in at this time, please secure your account immediately by changing your password and enabling 2FA.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Login Alert
      
      Hello ${user.firstName},
      
      New login detected:
      Time: ${loginDetails.timestamp.toLocaleString()}
      IP: ${loginDetails.ip}
      
      If this wasn't you, please secure your account immediately.
    `;

    return {
      subject: 'New Login Alert - Vestio',
      htmlContent,
      textContent
    };
  }
}