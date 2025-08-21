import { getResendClient } from '../config/resend';
import { EmailOptions, EmailTemplate } from '../utils/types';
import { IUser } from '../interfaces/IUser';
import { KYCStatus } from '../interfaces/common';

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

  static async sendKYCStatusUpdate(user: IUser, status: KYCStatus, notes?: string): Promise<boolean> {
    const template = this.getKYCStatusUpdateTemplate(user, status, notes);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendInvoiceStatusUpdate(user: IUser, invoice: any, status: string, message?: string): Promise<boolean> {
    const template = this.getInvoiceStatusUpdateTemplate(user, invoice, status, message);
    
    return await this.sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendInvoiceSubmittedNotification(anchor: IUser, invoice: any, seller: IUser): Promise<boolean> {
    const template = this.getInvoiceSubmittedTemplate(anchor, invoice, seller);
    
    return await this.sendEmail({
      to: anchor.email,
      subject: template.subject,
      html: template.htmlContent,
      text: template.textContent
    });
  }

  static async sendInvoiceListedNotification(lender: IUser, invoice: any): Promise<boolean> {
    const template = this.getInvoiceListedTemplate(lender, invoice);
    
    return await this.sendEmail({
      to: lender.email,
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

  private static getKYCStatusUpdateTemplate(user: IUser, status: KYCStatus, notes?: string): EmailTemplate {
    let statusColor = '#3498db';
    let statusTitle = 'KYC Status Update';
    let statusMessage = '';
    let actionRequired = '';

    switch (status) {
      case KYCStatus.SUBMITTED:
        statusColor = '#f39c12';
        statusTitle = 'KYC Documents Submitted';
        statusMessage = 'Thank you for submitting your KYC documents. Our team will review them and get back to you within 3-5 business days.';
        actionRequired = 'No further action is required at this time. We will notify you once the review is complete.';
        break;

      case KYCStatus.UNDER_REVIEW:
        statusColor = '#f39c12';
        statusTitle = 'KYC Under Review';
        statusMessage = 'Your KYC documents are currently being reviewed by our compliance team.';
        actionRequired = 'Please wait for the review to complete. We will contact you if we need any additional information.';
        break;

      case KYCStatus.APPROVED:
        statusColor = '#27ae60';
        statusTitle = 'KYC Approved - Welcome to Vestio!';
        statusMessage = 'Congratulations! Your KYC documents have been approved. You now have full access to all Vestio features.';
        actionRequired = 'You can now start using all platform features including creating and managing invoices, accessing financing options, and more.';
        break;

      case KYCStatus.REJECTED:
        statusColor = '#e74c3c';
        statusTitle = 'KYC Documents Require Attention';
        statusMessage = 'After reviewing your submitted documents, we need you to address some issues before we can approve your KYC.';
        actionRequired = 'Please review the feedback below, update your documents accordingly, and resubmit for review.';
        break;

      default:
        statusMessage = 'Your KYC status has been updated.';
        actionRequired = 'Please log in to your account to view the current status.';
    }

    const loginLink = `${this.frontendUrl}/login`;
    const kycLink = `${this.frontendUrl}/dashboard/kyc`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${statusTitle} - Vestio</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: ${statusColor};">${statusTitle}</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>${statusMessage}</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <h3>Status: ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</h3>
            <p><strong>Next Steps:</strong> ${actionRequired}</p>
            
            ${notes ? `
              <div style="margin-top: 15px; padding: 15px; background-color: #fff; border-radius: 3px; border: 1px solid #ddd;">
                <h4 style="margin: 0 0 10px 0;">Additional Notes:</h4>
                <p style="margin: 0;">${notes}</p>
              </div>
            ` : ''}
          </div>
          
          ${status === KYCStatus.APPROVED ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${kycLink}" style="background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Access Your Dashboard</a>
            </div>
          ` : status === KYCStatus.REJECTED ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${kycLink}" style="background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Update KYC Documents</a>
            </div>
          ` : `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginLink}" style="background-color: ${statusColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Account Status</a>
            </div>
          `}
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 30px;">
            <h4>Need Help?</h4>
            <p style="margin: 5px 0;">If you have any questions about the KYC process or need assistance, please don't hesitate to contact our support team.</p>
          </div>
          
          <p style="margin-top: 30px;">Best regards,<br>The Vestio Compliance Team</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      ${statusTitle}
      
      Hello ${user.firstName},
      
      ${statusMessage}
      
      Status: ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      Next Steps: ${actionRequired}
      
      ${notes ? `Additional Notes: ${notes}\n` : ''}
      
      ${status === KYCStatus.APPROVED ? `Access your dashboard: ${kycLink}` : 
        status === KYCStatus.REJECTED ? `Update your documents: ${kycLink}` : 
        `View account status: ${loginLink}`}
      
      If you need help, please contact our support team.
      
      Best regards,
      The Vestio Compliance Team
    `;

    return {
      subject: `${statusTitle} - Vestio`,
      htmlContent,
      textContent
    };
  }

  private static getInvoiceStatusUpdateTemplate(user: IUser, invoice: any, status: string, message?: string): EmailTemplate {
    const invoiceLink = `${this.frontendUrl}/invoices/${invoice._id || invoice.id}`;
    const dashboardLink = `${this.frontendUrl}/dashboard`;

    const statusMap: { [key: string]: { title: string; color: string; description: string; action: string } } = {
      'submitted': {
        title: 'Invoice Submitted for Review',
        color: '#3498db',
        description: 'Your invoice has been submitted and is awaiting anchor approval.',
        action: 'Track Progress'
      },
      'anchor_approved': {
        title: 'Invoice Approved by Anchor',
        color: '#2ecc71',
        description: 'Great news! Your anchor has approved your invoice. It will now undergo admin verification.',
        action: 'View Details'
      },
      'admin_verified': {
        title: 'Invoice Verified - Ready for Listing',
        color: '#27ae60',
        description: 'Your invoice has been verified by our team and is ready to be listed in the marketplace.',
        action: 'View Invoice'
      },
      'listed': {
        title: 'Invoice Listed in Marketplace',
        color: '#f39c12',
        description: 'Your invoice is now live in the marketplace and available for funding by lenders.',
        action: 'View Marketplace'
      },
      'funded': {
        title: 'Invoice Successfully Funded',
        color: '#e74c3c',
        description: 'Congratulations! Your invoice has been funded. Funds will be disbursed to your account shortly.',
        action: 'View Transaction'
      },
      'rejected': {
        title: 'Invoice Requires Attention',
        color: '#e74c3c',
        description: 'Your invoice requires some updates before it can proceed further.',
        action: 'Update Invoice'
      }
    };

    const statusInfo = statusMap[status] || {
      title: 'Invoice Status Update',
      color: '#95a5a6',
      description: 'Your invoice status has been updated.',
      action: 'View Invoice'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${statusInfo.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: ${statusInfo.color};">${statusInfo.title}</h1>
          
          <p>Hello ${user.firstName},</p>
          
          <p>${statusInfo.description}</p>
          
          ${message ? `<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid ${statusInfo.color}; margin: 20px 0;">
            <p style="margin: 0; font-style: italic;">${message}</p>
          </div>` : ''}
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoice._id}</p>
            <p><strong>Amount:</strong> ${invoice.currency} ${invoice.amount?.toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invoiceLink}" style="background-color: ${statusInfo.color}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">${statusInfo.action}</a>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 30px;">
            <h4>Next Steps:</h4>
            <p style="margin: 5px 0;">
              ${status === 'submitted' ? 'Your anchor will review the invoice and either approve or request changes.' :
                status === 'anchor_approved' ? 'Our admin team will verify the invoice details and documents.' :
                status === 'admin_verified' ? 'The invoice will be listed in the marketplace shortly.' :
                status === 'listed' ? 'Lenders can now view and fund your invoice.' :
                status === 'funded' ? 'Monitor your dashboard for disbursement updates.' :
                status === 'rejected' ? 'Review the feedback and update your invoice as needed.' :
                'Check your dashboard for the latest updates.'}
            </p>
          </div>
          
          <p style="margin-top: 30px;">Best regards,<br>The Vestio Team</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      ${statusInfo.title}
      
      Hello ${user.firstName},
      
      ${statusInfo.description}
      
      ${message ? `Message: ${message}\n` : ''}
      
      Invoice Details:
      - Invoice Number: ${invoice._id}
      - Amount: ${invoice.currency} ${invoice.amount?.toLocaleString()}
      - Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
      - Status: ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      
      View invoice: ${invoiceLink}
      
      Best regards,
      The Vestio Team
    `;

    return {
      subject: `${statusInfo.title} - Invoice ${invoice._id}`,
      htmlContent,
      textContent
    };
  }

  private static getInvoiceSubmittedTemplate(anchor: IUser, invoice: any, seller: IUser): EmailTemplate {
    const reviewLink = `${this.frontendUrl}/anchor/pending-approvals`;
    const invoiceLink = `${this.frontendUrl}/invoices/${invoice._id || invoice.id}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Invoice Submitted for Review</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #3498db;">New Invoice Submitted for Review</h1>
          
          <p>Hello ${anchor.firstName},</p>
          
          <p>A new invoice has been submitted by <strong>${seller.firstName} ${seller.lastName}</strong> and requires your approval.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Invoice Details:</h3>
            <p><strong>Invoice Number:</strong> ${invoice._id}</p>
            <p><strong>Seller:</strong> ${seller.firstName} ${seller.lastName} ${seller.businessName ? `(${seller.businessName})` : ''}</p>
            <p><strong>Amount:</strong> ${invoice.currency} ${invoice.amount?.toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Description:</strong> ${invoice.description}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reviewLink}" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin-right: 10px;">Review Invoice</a>
            <a href="${invoiceLink}" style="background-color: #95a5a6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">View Details</a>
          </div>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin-top: 30px;">
            <h4>Action Required:</h4>
            <p style="margin: 5px 0;">Please review the invoice and supporting documents, then approve or reject with appropriate feedback.</p>
          </div>
          
          <p style="margin-top: 30px;">Best regards,<br>The Vestio Team</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Invoice Submitted for Review
      
      Hello ${anchor.firstName},
      
      A new invoice has been submitted by ${seller.firstName} ${seller.lastName} and requires your approval.
      
      Invoice Details:
      - Invoice Number: ${invoice._id}
      - Seller: ${seller.firstName} ${seller.lastName} ${seller.businessName ? `(${seller.businessName})` : ''}
      - Amount: ${invoice.currency} ${invoice.amount?.toLocaleString()}
      - Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
      - Description: ${invoice.description}
      
      Review pending approvals: ${reviewLink}
      
      Best regards,
      The Vestio Team
    `;

    return {
      subject: `New Invoice Submitted - ${invoice._id}`,
      htmlContent,
      textContent
    };
  }

  private static getInvoiceListedTemplate(lender: IUser, invoice: any): EmailTemplate {
    const marketplaceLink = `${this.frontendUrl}/marketplace`;
    const invoiceLink = `${this.frontendUrl}/marketplace/invoices/${invoice._id || invoice.id}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>New Investment Opportunity Available</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #f39c12;">New Investment Opportunity Available</h1>
          
          <p>Hello ${lender.firstName},</p>
          
          <p>A new invoice has been listed in the marketplace that matches your investment criteria.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3>Investment Opportunity:</h3>
            <p><strong>Invoice Number:</strong> ${invoice._id}</p>
            <p><strong>Amount:</strong> ${invoice.currency} ${invoice.amount?.toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
            <p><strong>Days Until Due:</strong> ${invoice.daysUntilDue} days</p>
            <p><strong>Anchor:</strong> ${invoice.anchor?.businessName || `${invoice.anchor?.firstName} ${invoice.anchor?.lastName}`}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invoiceLink}" style="background-color: #f39c12; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin-right: 10px;">View Investment</a>
            <a href="${marketplaceLink}" style="background-color: #95a5a6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Browse Marketplace</a>
          </div>
          
          <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; border-left: 4px solid #bee5eb; margin-top: 30px;">
            <h4>Investment Highlights:</h4>
            <ul style="margin: 5px 0;">
              <li>Verified invoice with anchor approval</li>
              <li>Secure transaction processing</li>
              <li>Transparent fee structure</li>
              <li>Professional dispute resolution</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">Best regards,<br>The Vestio Investment Team</p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
      New Investment Opportunity Available
      
      Hello ${lender.firstName},
      
      A new invoice has been listed in the marketplace that matches your investment criteria.
      
      Investment Opportunity:
      - Invoice Number: ${invoice._id}
      - Amount: ${invoice.currency} ${invoice.amount?.toLocaleString()}
      - Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}
      - Days Until Due: ${invoice.daysUntilDue} days
      - Anchor: ${invoice.anchor?.businessName || `${invoice.anchor?.firstName} ${invoice.anchor?.lastName}`}
      
      View investment: ${invoiceLink}
      Browse marketplace: ${marketplaceLink}
      
      Best regards,
      The Vestio Investment Team
    `;

    return {
      subject: `New Investment Opportunity - ${invoice._id}`,
      htmlContent,
      textContent
    };
  }
}