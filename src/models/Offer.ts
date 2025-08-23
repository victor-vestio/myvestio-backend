import mongoose, { Schema, Document } from 'mongoose';
import { IOffer } from '../interfaces/IOffer';
import { OfferStatus } from '../interfaces/common';
import { v4 as uuidv4 } from 'uuid';

const OfferSchema = new Schema<IOffer>({
  _id: {
    type: String,
    default: () => `OFF-${uuidv4()}`
  },
  
  invoiceId: {
    type: String,
    ref: 'Invoice',
    required: true,
    index: true
  },
  
  lenderId: {
    type: String,
    ref: 'User',
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: [0, 'Offer amount must be positive'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Offer amount must be a valid positive number'
    }
  },
  
  interestRate: {
    type: Number,
    required: true,
    min: [0, 'Interest rate must be positive'],
    max: [100, 'Interest rate cannot exceed 100%'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 0 && value <= 100;
      },
      message: 'Interest rate must be between 0 and 100'
    }
  },
  
  fundingPercentage: {
    type: Number,
    required: true,
    min: [1, 'Funding percentage must be at least 1%'],
    max: [100, 'Funding percentage cannot exceed 100%'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value >= 1 && value <= 100;
      },
      message: 'Funding percentage must be between 1 and 100'
    }
  },
  
  tenure: {
    type: Number,
    required: true,
    min: [1, 'Tenure must be at least 1 day'],
    max: [365, 'Tenure cannot exceed 365 days'],
    validate: {
      validator: function(value: number) {
        return Number.isInteger(value) && value >= 1 && value <= 365;
      },
      message: 'Tenure must be an integer between 1 and 365 days'
    }
  },
  
  terms: {
    type: String,
    trim: true,
    maxlength: [2000, 'Terms cannot exceed 2000 characters']
  },
  
  status: {
    type: String,
    enum: Object.values(OfferStatus),
    default: OfferStatus.PENDING,
    index: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    validate: {
      validator: function(this: IOffer, value: Date) {
        return value > this.createdAt;
      },
      message: 'Expiration date must be after creation date'
    }
  },
  
  // Action timestamps
  acceptedAt: Date,
  rejectedAt: Date,
  withdrawnAt: Date,
  expiredAt: Date,
  
  // Action reasons
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  
  withdrawalReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Withdrawal reason cannot exceed 500 characters']
  },
  
  // Competitive bidding
  isCounterOffer: {
    type: Boolean,
    default: false
  },
  
  originalOfferId: {
    type: String,
    ref: 'Offer'
  },
  
  counterOfferCount: {
    type: Number,
    default: 0,
    min: [0, 'Counter offer count cannot be negative']
  },
  
  // Financial calculations
  totalInterestAmount: Number,
  totalRepaymentAmount: Number,
  dailyInterestRate: Number,
  
  // Metadata
  lenderNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Lender notes cannot exceed 1000 characters']
  },
  
  acceptanceNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Acceptance notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
OfferSchema.index({ invoiceId: 1, status: 1 });
OfferSchema.index({ lenderId: 1, status: 1 });
OfferSchema.index({ status: 1, expiresAt: 1 });
OfferSchema.index({ createdAt: -1 });
OfferSchema.index({ amount: -1 });
OfferSchema.index({ interestRate: 1 });

// Compound indexes for competitive bidding
OfferSchema.index({ invoiceId: 1, status: 1, interestRate: 1 });
OfferSchema.index({ invoiceId: 1, status: 1, amount: -1 });
OfferSchema.index({ invoiceId: 1, status: 1, createdAt: -1 });

// TTL index for automatic cleanup of expired offers
OfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual fields
OfferSchema.virtual('isExpired').get(function() {
  return new Date() > new Date(this.expiresAt);
});

OfferSchema.virtual('timeUntilExpiry').get(function() {
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60))); // Minutes until expiry
});

OfferSchema.virtual('isActive').get(function() {
  return this.status === OfferStatus.PENDING && !this.isExpired;
});

OfferSchema.virtual('effectiveAnnualRate').get(function() {
  // Calculate effective annual rate considering tenure
  if (!this.interestRate || !this.tenure) return 0;
  return (this.interestRate * 365) / this.tenure;
});

// Instance methods
OfferSchema.methods.canBeWithdrawn = function(): boolean {
  return this.status === OfferStatus.PENDING && !this.isExpired;
};

OfferSchema.methods.canBeAccepted = function(): boolean {
  return this.status === OfferStatus.PENDING && !this.isExpired;
};

OfferSchema.methods.canBeRejected = function(): boolean {
  return this.status === OfferStatus.PENDING && !this.isExpired;
};

OfferSchema.methods.calculateFinancials = function(invoiceAmount: number) {
  // Calculate funding amount based on percentage
  const fundingAmount = (invoiceAmount * this.fundingPercentage) / 100;
  
  // Calculate daily interest rate
  const dailyRate = this.interestRate / 365 / 100;
  
  // Calculate total interest over tenure
  const totalInterest = fundingAmount * dailyRate * this.tenure;
  
  // Calculate total repayment
  const totalRepayment = fundingAmount + totalInterest;
  
  return {
    fundingAmount,
    dailyInterestRate: dailyRate,
    totalInterestAmount: totalInterest,
    totalRepaymentAmount: totalRepayment,
    netProfitForLender: totalInterest,
    effectiveAnnualRate: (this.interestRate * 365) / this.tenure
  };
};

OfferSchema.methods.expire = function() {
  this.status = OfferStatus.EXPIRED;
  this.expiredAt = new Date();
  return this.save();
};

OfferSchema.methods.withdraw = function(reason?: string) {
  this.status = OfferStatus.WITHDRAWN;
  this.withdrawnAt = new Date();
  if (reason) this.withdrawalReason = reason;
  return this.save();
};

OfferSchema.methods.accept = function(notes?: string) {
  this.status = OfferStatus.ACCEPTED;
  this.acceptedAt = new Date();
  if (notes) this.acceptanceNotes = notes;
  return this.save();
};

OfferSchema.methods.reject = function(reason?: string) {
  this.status = OfferStatus.REJECTED;
  this.rejectedAt = new Date();
  if (reason) this.rejectionReason = reason;
  return this.save();
};

// Pre-save middleware
OfferSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-calculate financial fields
  if (this.isModified('amount') || this.isModified('interestRate') || this.isModified('tenure') || this.isModified('fundingPercentage')) {
    const dailyRate = this.interestRate / 365 / 100;
    this.dailyInterestRate = dailyRate;
    
    if (this.amount) {
      // this.amount is already the funding amount (calculated in controller)
      const fundingAmount = this.amount;
      const totalInterest = fundingAmount * dailyRate * this.tenure;
      this.totalInterestAmount = totalInterest;
      this.totalRepaymentAmount = fundingAmount + totalInterest;
    }
  }
  
  // Set expiration if not set (default 48 hours)
  if (!this.expiresAt && this.isNew) {
    this.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
  }
  
  next();
});

// Static methods
OfferSchema.statics.getOffersForInvoice = function(invoiceId: string, status?: OfferStatus) {
  const query: any = { invoiceId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 }).populate('lenderId', 'firstName lastName businessName email');
};

OfferSchema.statics.getOffersForLender = function(lenderId: string, status?: OfferStatus) {
  const query: any = { lenderId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 }).populate('invoiceId');
};

OfferSchema.statics.getPendingOffers = function() {
  return this.find({ 
    status: OfferStatus.PENDING,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

OfferSchema.statics.getExpiredOffers = function() {
  return this.find({
    status: OfferStatus.PENDING,
    expiresAt: { $lte: new Date() }
  });
};

OfferSchema.statics.getBestOffers = function(invoiceId: string, limit = 5) {
  return this.find({
    invoiceId,
    status: OfferStatus.PENDING,
    expiresAt: { $gt: new Date() }
  })
  .sort({ interestRate: 1, amount: -1, createdAt: 1 }) // Best rate, highest amount, earliest
  .limit(limit)
  .populate('lenderId', 'firstName lastName businessName email');
};

OfferSchema.statics.getCompetitiveAnalysis = function(invoiceId: string) {
  return this.aggregate([
    {
      $match: {
        invoiceId,
        status: OfferStatus.PENDING,
        expiresAt: { $gt: new Date() }
      }
    },
    {
      $group: {
        _id: null,
        totalOffers: { $sum: 1 },
        avgInterestRate: { $avg: '$interestRate' },
        minInterestRate: { $min: '$interestRate' },
        maxInterestRate: { $max: '$interestRate' },
        avgAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' },
        avgFundingPercentage: { $avg: '$fundingPercentage' },
        maxFundingPercentage: { $max: '$fundingPercentage' }
      }
    }
  ]);
};

export const Offer = mongoose.model<IOffer>('Offer', OfferSchema);