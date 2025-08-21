import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IKYC, DocumentFile, BankDetails } from '../interfaces/IKYC';
import { UserRole, BusinessType, KYCStatus, DocumentType } from '../interfaces/common';

const DocumentFileSchema = new Schema<DocumentFile>({
  documentType: {
    type: String,
    enum: Object.values(DocumentType),
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  cloudinaryUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const BankDetailsSchema = new Schema<BankDetails>({
  accountNumber: {
    type: String,
    required: true,
    trim: true
  },
  bankName: {
    type: String,
    required: true,
    trim: true
  },
  accountName: {
    type: String,
    required: true,
    trim: true
  },
  bvn: {
    type: String,
    trim: true
  }
}, { _id: false });

const KYCSchema = new Schema<IKYC>({
  _id: {
    type: String,
    default: () => uuidv4()
  },
  userId: {
    type: String,
    required: true,
    unique: true,
    ref: 'User'
  },
  userRole: {
    type: String,
    enum: Object.values(UserRole),
    required: true
  },
  userBusinessType: {
    type: String,
    enum: Object.values(BusinessType)
  },
  status: {
    type: String,
    enum: Object.values(KYCStatus),
    default: KYCStatus.NOT_SUBMITTED
  },
  documents: [DocumentFileSchema],
  bankDetails: BankDetailsSchema,
  dateOfBirth: {
    type: Date
  },
  submittedAt: {
    type: Date
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: String,
    ref: 'User'
  },
  approvalNotes: {
    type: String,
    trim: true
  },
  rejectionReason: {
    type: String,
    trim: true
  }
}, {
  _id: false,
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.kycId = ret._id;
      delete (ret as any)._id;
      delete (ret as any).__v;
      return ret;
    }
  }
});

// Indexes
KYCSchema.index({ userId: 1 });
KYCSchema.index({ status: 1 });
KYCSchema.index({ userRole: 1 });
KYCSchema.index({ submittedAt: 1 });

// Document requirements based on role and business type
const DOCUMENT_REQUIREMENTS: {
  [UserRole.SELLER]: DocumentType[];
  [UserRole.LENDER]: {
    [BusinessType.INDIVIDUAL]: DocumentType[];
    [BusinessType.COMPANY]: DocumentType[];
  };
  [UserRole.ANCHOR]: DocumentType[];
  [UserRole.ADMIN]: DocumentType[];
} = {
  [UserRole.SELLER]: [
    DocumentType.CAC,
    DocumentType.GOVERNMENT_ID,
    DocumentType.PROOF_OF_ADDRESS
  ],
  [UserRole.LENDER]: {
    [BusinessType.INDIVIDUAL]: [
      DocumentType.GOVERNMENT_ID,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.DATE_OF_BIRTH_CERTIFICATE
    ],
    [BusinessType.COMPANY]: [
      DocumentType.CAC,
      DocumentType.GOVERNMENT_ID,
      DocumentType.PROOF_OF_ADDRESS,
      DocumentType.SIGNATORY_LIST
    ]
  },
  [UserRole.ANCHOR]: [
    DocumentType.CAC,
    DocumentType.TIN,
    DocumentType.TAX_CLEARANCE,
    DocumentType.PROOF_OF_ADDRESS,
    DocumentType.SIGNATORY_LIST,
    DocumentType.BOARD_RESOLUTION,
    DocumentType.AUDITED_FINANCIALS,
    DocumentType.BANK_STATEMENTS
  ],
  [UserRole.ADMIN]: [] // Admins don't require KYC documents
};

// Get required documents for a user
KYCSchema.methods.getRequiredDocuments = function(this: IKYC): DocumentType[] {
  const userRole = this.userRole as UserRole;
  
  if (userRole === UserRole.LENDER) {
    const businessType: BusinessType = this.userBusinessType || BusinessType.INDIVIDUAL;
    return DOCUMENT_REQUIREMENTS[UserRole.LENDER][businessType] || [];
  }
  
  return DOCUMENT_REQUIREMENTS[userRole] || [];
};

// Check if all required documents are uploaded
KYCSchema.methods.isComplete = function(this: IKYC): boolean {
  const userRole = this.userRole as UserRole;
  
  // Admins are always considered complete (no KYC required)
  if (userRole === UserRole.ADMIN) {
    return true;
  }
  
  const requiredDocs = this.getRequiredDocuments();
  const uploadedDocTypes = this.documents.map((doc: DocumentFile) => doc.documentType);
  
  // Check if all required documents are uploaded
  const allDocsUploaded = requiredDocs.every((docType: DocumentType) => uploadedDocTypes.includes(docType));
  
  // Check if bank details are required and provided
  const bankDetailsRequired = [UserRole.SELLER, UserRole.ANCHOR].includes(userRole) ||
    (userRole === UserRole.LENDER && this.userBusinessType === BusinessType.COMPANY);
  const bankDetailsProvided = !bankDetailsRequired || Boolean(
    this.bankDetails && 
    this.bankDetails.accountNumber && 
    this.bankDetails.bankName && 
    this.bankDetails.accountName
  );
  
  // Check if date of birth is required and provided
  const dobRequired = userRole === UserRole.LENDER && this.userBusinessType === BusinessType.INDIVIDUAL;
  const dobProvided = !dobRequired || Boolean(this.dateOfBirth);
  
  return allDocsUploaded && bankDetailsProvided && dobProvided;
};

// Get missing documents
KYCSchema.methods.getMissingDocuments = function(this: IKYC): DocumentType[] {
  const requiredDocs = this.getRequiredDocuments();
  const uploadedDocTypes = this.documents.map((doc: DocumentFile) => doc.documentType);
  
  return requiredDocs.filter((docType: DocumentType) => !uploadedDocTypes.includes(docType));
};

// Pre-save middleware to update status
KYCSchema.pre<IKYC>('save', function(next) {
  // If documents are being submitted for the first time
  if (this.status === KYCStatus.NOT_SUBMITTED && this.documents.length > 0) {
    this.status = this.isComplete() ? KYCStatus.SUBMITTED : KYCStatus.INCOMPLETE;
    if (this.status === KYCStatus.SUBMITTED && !this.submittedAt) {
      this.submittedAt = new Date();
    }
  }
  
  // If updating an incomplete submission
  if (this.status === KYCStatus.INCOMPLETE && this.isComplete()) {
    this.status = KYCStatus.SUBMITTED;
    if (!this.submittedAt) {
      this.submittedAt = new Date();
    }
  }
  
  next();
});

export const KYC = mongoose.model<IKYC>('KYC', KYCSchema);
export { DOCUMENT_REQUIREMENTS };