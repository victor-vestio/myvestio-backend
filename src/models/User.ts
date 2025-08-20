import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IUser } from '../interfaces/IUser';
import { UserRole, BusinessType, UserStatus } from '../interfaces/common';

const UserSchema = new Schema<IUser>({
  _id: {
    type: String,
    default: () => uuidv4(),
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+?[\d\s-()]{10,}$/, 'Please enter a valid phone number']
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: [true, 'Role is required'],
    default: UserRole.SELLER
  },
  businessType: {
    type: String,
    enum: Object.values(BusinessType),
    required: function(this: IUser) {
      return this.role === UserRole.LENDER;
    }
  },
  businessName: {
    type: String,
    trim: true,
    maxlength: [100, 'Business name cannot exceed 100 characters'],
    required: function(this: IUser) {
      return this.businessType === BusinessType.COMPANY;
    }
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING_VERIFICATION
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isKYCApproved: {
    type: Boolean,
    default: false
  },
  
  // 2FA
  twoFactorSecret: {
    type: String,
    select: false
  },
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  
  // Security tokens
  refreshToken: {
    type: String,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  
  // Login OTP tokens
  loginToken: {
    type: String,
    select: false
  },
  loginTokenExpires: {
    type: Date,
    select: false
  },
  emailOTP: {
    type: String,
    select: false
  },
  emailOTPExpires: {
    type: Date,
    select: false
  },
  twoFAToken: {
    type: String,
    select: false
  },
  twoFATokenExpires: {
    type: Date,
    select: false
  },
  
  // Timestamps
  lastLogin: {
    type: Date
  }
}, {
  _id: false, // Disable the default _id since we're defining our own
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.userId = ret._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      delete (ret as any).password;
      delete (ret as any).refreshToken;
      delete (ret as any).passwordResetToken;
      delete (ret as any).passwordResetExpires;
      delete (ret as any).emailVerificationToken;
      delete (ret as any).emailVerificationExpires;
      delete (ret as any).twoFactorSecret;
      return ret;
    }
  }
});

// Virtual field for userId (alias for _id)
UserSchema.virtual('userId').get(function() {
  return this._id;
});

// Ensure virtual fields are included in JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ isEmailVerified: 1 });
UserSchema.index({ isKYCApproved: 1 });
UserSchema.index({ createdAt: 1 });

// Hash password before saving
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate refresh token
UserSchema.methods.generateRefreshToken = function(): string {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  this.refreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  return refreshToken;
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function(): string {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  const resetTokenExpiryMinutes = parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || '10');
  this.passwordResetExpires = new Date(Date.now() + resetTokenExpiryMinutes * 60 * 1000);
  
  return resetToken;
};

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function(): string {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  this.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
  
  const verificationTokenExpiryHours = parseInt(process.env.EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS || '24');
  this.emailVerificationExpires = new Date(Date.now() + verificationTokenExpiryHours * 60 * 60 * 1000);
  
  return verificationToken;
};

// Static method to find user by refresh token
UserSchema.statics.findByRefreshToken = function(refreshToken: string) {
  const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
  return this.findOne({ refreshToken: hashedToken }).select('+refreshToken');
};

export const User = mongoose.model<IUser>('User', UserSchema);