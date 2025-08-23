import mongoose, { Schema, Document } from 'mongoose';
import { IInvoice } from '../interfaces/IInvoice';
import { InvoiceStatus } from '../interfaces/common';
import { v4 as uuidv4 } from 'uuid';

const InvoiceSchema = new Schema<IInvoice>({
  _id: {
    type: String,
    default: () => `INV-${uuidv4()}`
  },
  
  sellerId: {
    type: String,
    ref: 'User',
    required: true,
    index: true
  },
  
  anchorId: {
    type: String,
    ref: 'User',
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount must be positive'],
    validate: {
      validator: function(value: number) {
        return Number.isFinite(value) && value > 0;
      },
      message: 'Amount must be a valid positive number'
    }
  },
  
  currency: {
    type: String,
    required: true,
    default: 'NGN',
    enum: ['NGN'],
    uppercase: true
  },
  
  issueDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(value: Date) {
        return value <= new Date();
      },
      message: 'Issue date cannot be in the future'
    }
  },
  
  dueDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(this: IInvoice, value: Date) {
        return value > this.issueDate;
      },
      message: 'Due date must be after issue date'
    }
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  invoiceDocument: {
    filename: {
      type: String,
      required: false
    },
    originalName: {
      type: String,
      required: false
    },
    cloudinaryUrl: {
      type: String,
      required: false
    },
    cloudinaryPublicId: {
      type: String,
      required: false
    },
    fileSize: {
      type: Number,
      required: false
    },
    mimeType: {
      type: String,
      required: false
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  supportingDocuments: [{
    documentType: {
      type: String,
      required: true,
      enum: ['purchase_order', 'delivery_note', 'contract', 'other']
    },
    filename: String,
    originalName: String,
    cloudinaryUrl: String,
    cloudinaryPublicId: String,
    fileSize: Number,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  status: {
    type: String,
    enum: Object.values(InvoiceStatus),
    default: InvoiceStatus.DRAFT,
    index: true
  },
  
  // Status tracking timestamps
  submittedAt: Date,
  anchorApprovalDate: Date,
  anchorRejectionDate: Date,
  adminVerificationDate: Date,
  listedAt: Date,
  fundedAt: Date,
  repaymentDate: Date,
  settlementDate: Date,
  
  // Review and approval data
  anchorApprovalNotes: String,
  anchorRejectionReason: String,
  adminVerificationNotes: String,
  adminRejectionReason: String,
  verifiedBy: {
    type: String,
    ref: 'User'
  },
  
  // Admin-controlled marketplace funding terms
  marketplaceFundingTerms: {
    maxFundingAmount: {
      type: Number,
      min: [0, 'Maximum funding amount must be positive'],
      validate: {
        validator: function(this: IInvoice, value: number) {
          if (value && this.amount) {
            return value <= this.amount;
          }
          return true;
        },
        message: 'Maximum funding amount cannot exceed invoice amount'
      }
    },
    recommendedInterestRate: {
      type: Number,
      min: [0, 'Recommended interest rate must be positive'],
      max: [50, 'Recommended interest rate cannot exceed 50%']
    },
    maxTenure: {
      type: Number,
      min: [1, 'Maximum tenure must be at least 1 day'],
      max: [365, 'Maximum tenure cannot exceed 365 days'],
      validate: {
        validator: function(this: IInvoice, value: number) {
          if (value && this.daysUntilDue) {
            return value <= this.daysUntilDue;
          }
          return true;
        },
        message: 'Maximum tenure cannot exceed days until due date'
      }
    }
  },
  
  // Financial data
  fundingAmount: {
    type: Number,
    min: [0, 'Funding amount must be positive'],
    validate: {
      validator: function(this: IInvoice, value: number) {
        if (value && this.amount) {
          return value <= this.amount;
        }
        return true;
      },
      message: 'Funding amount cannot exceed invoice amount'
    }
  },
  
  interestRate: {
    type: Number,
    min: [0, 'Interest rate must be positive'],
    max: [50, 'Interest rate cannot exceed 50%']
  },
  
  fundedBy: {
    type: String,
    ref: 'User'
  },
  
  // Payment tracking
  totalRepaymentAmount: Number,
  repaidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Repaid amount must be positive']
  },
  
  // Metadata
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Audit trail
  statusHistory: [{
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: String,
      ref: 'User'
    },
    notes: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
InvoiceSchema.index({ sellerId: 1, status: 1 });
InvoiceSchema.index({ anchorId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1 });
InvoiceSchema.index({ amount: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ 'statusHistory.timestamp': -1 });

// Compound indexes for common queries
InvoiceSchema.index({ status: 1, dueDate: 1 });
InvoiceSchema.index({ sellerId: 1, createdAt: -1 });
InvoiceSchema.index({ anchorId: 1, createdAt: -1 });

// Virtual fields
InvoiceSchema.virtual('daysUntilDue').get(function() {
  const now = new Date();
  const due = new Date(this.dueDate);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

InvoiceSchema.virtual('isOverdue').get(function() {
  return new Date() > new Date(this.dueDate);
});

InvoiceSchema.virtual('fundingPercentage').get(function() {
  if (!this.fundingAmount || !this.amount) return 0;
  return (this.fundingAmount / this.amount) * 100;
});

InvoiceSchema.virtual('repaymentProgress').get(function() {
  if (!this.totalRepaymentAmount || !this.repaidAmount) return 0;
  return (this.repaidAmount / this.totalRepaymentAmount) * 100;
});

// Instance methods
InvoiceSchema.methods.canBeEdited = function(): boolean {
  return this.status === InvoiceStatus.DRAFT || this.status === InvoiceStatus.REJECTED;
};

InvoiceSchema.methods.canBeSubmitted = function(): boolean {
  return (this.status === InvoiceStatus.DRAFT || this.status === InvoiceStatus.REJECTED) && 
         this.invoiceDocument && 
         this.invoiceDocument.cloudinaryUrl;
};

InvoiceSchema.methods.canBeApprovedByAnchor = function(): boolean {
  return this.status === InvoiceStatus.SUBMITTED;
};

InvoiceSchema.methods.canBeVerifiedByAdmin = function(): boolean {
  return this.status === InvoiceStatus.ANCHOR_APPROVED;
};

InvoiceSchema.methods.canBeListed = function(): boolean {
  return this.status === InvoiceStatus.ADMIN_VERIFIED;
};

InvoiceSchema.methods.canBeFunded = function(): boolean {
  return this.status === InvoiceStatus.LISTED;
};

InvoiceSchema.methods.addStatusHistory = function(status: InvoiceStatus, changedBy?: string, notes?: string) {
  this.statusHistory.push({
    status,
    timestamp: new Date(),
    changedBy,
    notes
  });
};

InvoiceSchema.methods.calculateTotalRepayment = function(interestRate: number, days?: number): number {
  if (!days) {
    const fundedDate = this.fundedAt || new Date();
    const dueDate = new Date(this.dueDate);
    days = Math.ceil((dueDate.getTime() - fundedDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  const dailyRate = interestRate / 365 / 100;
  const interestAmount = this.fundingAmount * dailyRate * days;
  return this.fundingAmount + interestAmount;
};

// Pre-save middleware
InvoiceSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update status timestamps
  if (this.isModified('status')) {
    const now = new Date();
    
    switch (this.status) {
      case InvoiceStatus.SUBMITTED:
        if (!this.submittedAt) this.submittedAt = now;
        break;
      case InvoiceStatus.ANCHOR_APPROVED:
        if (!this.anchorApprovalDate) this.anchorApprovalDate = now;
        break;
      case InvoiceStatus.ADMIN_VERIFIED:
        if (!this.adminVerificationDate) this.adminVerificationDate = now;
        break;
      case InvoiceStatus.LISTED:
        if (!this.listedAt) this.listedAt = now;
        break;
      case InvoiceStatus.FUNDED:
        if (!this.fundedAt) this.fundedAt = now;
        // Calculate total repayment amount
        if (this.interestRate && this.fundingAmount) {
          this.totalRepaymentAmount = this.calculateTotalRepayment(this.interestRate);
        }
        break;
      case InvoiceStatus.REPAID:
        if (!this.repaymentDate) this.repaymentDate = now;
        break;
      case InvoiceStatus.SETTLED:
        if (!this.settlementDate) this.settlementDate = now;
        break;
    }
    
    // Add to status history
    this.addStatusHistory(this.status);
  }
  
  next();
});

// Static methods
InvoiceSchema.statics.getInvoicesByStatus = function(status: InvoiceStatus | InvoiceStatus[]) {
  const statusArray = Array.isArray(status) ? status : [status];
  return this.find({ status: { $in: statusArray } });
};

InvoiceSchema.statics.getInvoicesForSeller = function(sellerId: string, status?: InvoiceStatus) {
  const query: any = { sellerId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

InvoiceSchema.statics.getInvoicesForAnchor = function(anchorId: string, status?: InvoiceStatus) {
  const query: any = { anchorId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

InvoiceSchema.statics.getPendingApprovals = function(anchorId?: string) {
  const query: any = { status: InvoiceStatus.SUBMITTED };
  if (anchorId) query.anchorId = anchorId;
  return this.find(query).sort({ submittedAt: 1 });
};

InvoiceSchema.statics.getMarketplaceInvoices = function(filters: any = {}) {
  const query: any = { status: InvoiceStatus.LISTED };
  
  if (filters.minAmount) query.amount = { $gte: filters.minAmount };
  if (filters.maxAmount) query.amount = { ...query.amount, $lte: filters.maxAmount };
  if (filters.currency) query.currency = filters.currency;
  if (filters.anchorId) query.anchorId = filters.anchorId;
  
  return this.find(query).sort({ listedAt: -1 });
};

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);