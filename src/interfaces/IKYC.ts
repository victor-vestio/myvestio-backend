import { Document } from 'mongoose';
import { UserRole, BusinessType, KYCStatus, DocumentType } from './common';

export interface DocumentFile {
  documentType: DocumentType;
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface BankDetails {
  accountNumber: string;
  bankName: string;
  accountName: string;
  bvn?: string;
}

export interface IKYC extends Document {
  _id: string;
  kycId?: string; // Virtual field from toJSON transform
  userId: string;
  userRole: UserRole;
  userBusinessType?: BusinessType;
  status: KYCStatus;
  
  // Documents storage
  documents: DocumentFile[];
  
  // Bank details for sellers, lender companies, and anchors
  bankDetails?: BankDetails;
  
  // Date of birth for individual lenders
  dateOfBirth?: Date;
  
  // Status tracking
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string; // Admin user ID
  approvalNotes?: string;
  rejectionReason?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  getRequiredDocuments(): DocumentType[];
  isComplete(): boolean;
  getMissingDocuments(): DocumentType[];
}

// Role-based document requirements
export interface DocumentRequirements {
  [UserRole.SELLER]: DocumentType[];
  [UserRole.LENDER]: {
    [BusinessType.INDIVIDUAL]: DocumentType[];
    [BusinessType.COMPANY]: DocumentType[];
  };
  [UserRole.ANCHOR]: DocumentType[];
}

// Request/Response interfaces
export interface SubmitKYCRequest {
  bankDetails?: BankDetails;
  dateOfBirth?: string;
}

export interface KYCStatusResponse {
  userId: string;
  status: KYCStatus;
  requiredDocuments: DocumentType[];
  uploadedDocuments: DocumentType[];
  missingDocuments: DocumentType[];
  submittedAt?: Date;
  reviewedAt?: Date;
  approvalNotes?: string;
  rejectionReason?: string;
}

export interface UploadDocumentResponse {
  documentType: DocumentType;
  filename: string;
  cloudinaryUrl: string;
  uploadedAt: Date;
}

export interface KYCAdminResponse {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  userBusinessType?: BusinessType;
  status: KYCStatus;
  submittedAt: Date;
  documents: {
    documentType: DocumentType;
    filename: string;
    cloudinaryUrl: string;
    uploadedAt: Date;
  }[];
  bankDetails?: BankDetails;
  dateOfBirth?: Date;
}

export interface ApproveKYCRequest {
  approvalNotes?: string;
}

export interface RejectKYCRequest {
  rejectionReason: string;
}

export interface UpdateKYCRequest {
  bankDetails?: BankDetails;
  dateOfBirth?: string;
}