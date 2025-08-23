import { Document } from 'mongoose';
import { InvoiceStatus } from './common';

// Document interface for file uploads
export interface InvoiceDocumentData {
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

// Supporting document interface
export interface SupportingDocument {
  documentType: 'purchase_order' | 'delivery_note' | 'contract' | 'other';
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

// Status history tracking
export interface StatusHistoryEntry {
  status: InvoiceStatus;
  timestamp: Date;
  changedBy?: string;
  notes?: string;
}

// Main Invoice interface
export interface IInvoice extends Document {
  // Basic invoice information
  _id: string; // UUID with INV- prefix
  sellerId: string;
  anchorId: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  description: string;
  
  // Document storage
  invoiceDocument?: InvoiceDocumentData;
  supportingDocuments: SupportingDocument[];
  
  // Status tracking
  status: InvoiceStatus;
  submittedAt?: Date;
  anchorApprovalDate?: Date;
  anchorRejectionDate?: Date;
  adminVerificationDate?: Date;
  listedAt?: Date;
  fundedAt?: Date;
  repaymentDate?: Date;
  settlementDate?: Date;
  
  // Review and approval data
  anchorApprovalNotes?: string;
  anchorRejectionReason?: string;
  adminVerificationNotes?: string;
  adminRejectionReason?: string;
  verifiedBy?: string;
  
  // Admin-controlled marketplace funding terms
  marketplaceFundingTerms?: {
    maxFundingAmount?: number;
    recommendedInterestRate?: number;
    maxTenure?: number;
  };
  
  // Financial data
  fundingAmount?: number;
  interestRate?: number;
  fundedBy?: string;
  totalRepaymentAmount?: number;
  repaidAmount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  statusHistory: StatusHistoryEntry[];
  
  // Virtual fields
  daysUntilDue: number;
  isOverdue: boolean;
  fundingPercentage: number;
  repaymentProgress: number;
  
  // Instance methods
  canBeEdited(): boolean;
  canBeSubmitted(): boolean;
  canBeApprovedByAnchor(): boolean;
  canBeVerifiedByAdmin(): boolean;
  canBeListed(): boolean;
  canBeFunded(): boolean;
  addStatusHistory(status: InvoiceStatus, changedBy?: string, notes?: string): void;
  calculateTotalRepayment(interestRate: number, days?: number): number;
}

// Request/Response DTOs

export interface CreateInvoiceRequest {
  anchorId: string;
  amount: number;
  currency?: string;
  issueDate: string | Date;
  dueDate: string | Date;
  description: string;
}

export interface UpdateInvoiceRequest {
  anchorId?: string;
  amount?: number;
  currency?: string;
  issueDate?: string | Date;
  dueDate?: string | Date;
  description?: string;
}

export interface SubmitInvoiceRequest {
  // Optional additional data when submitting
  finalNotes?: string;
}

export interface AnchorApprovalRequest {
  action: 'approve' | 'reject';
  notes?: string;
}

export interface AdminVerificationRequest {
  action: 'verify' | 'reject';
  notes?: string;
  verificationDetails?: {
    documentsVerified: boolean;
    complianceChecked: boolean;
    riskAssessment?: string;
  };
  fundingTerms?: {
    maxFundingAmount: number;
    recommendedInterestRate: number;
    maxTenure?: number;
  };
}

// Response DTOs

export interface InvoiceBasicResponse {
  invoiceId: string;
  sellerId: string;
  anchorId: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  description: string;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  daysUntilDue: number;
  isOverdue: boolean;
}

export interface InvoiceDetailedResponse extends InvoiceBasicResponse {
  invoiceDocument: {
    filename: string;
    originalName: string;
    cloudinaryUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
  };
  supportingDocuments: Array<{
    documentType: string;
    filename: string;
    originalName: string;
    cloudinaryUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: Date;
  }>;
  
  // Status timestamps
  submittedAt?: Date;
  anchorApprovalDate?: Date;
  anchorRejectionDate?: Date;
  adminVerificationDate?: Date;
  listedAt?: Date;
  fundedAt?: Date;
  repaymentDate?: Date;
  settlementDate?: Date;
  
  // Review data
  anchorApprovalNotes?: string;
  anchorRejectionReason?: string;
  adminVerificationNotes?: string;
  adminRejectionReason?: string;
  
  // Financial data
  fundingAmount?: number;
  interestRate?: number;
  totalRepaymentAmount?: number;
  repaidAmount?: number;
  fundingPercentage?: number;
  repaymentProgress?: number;
  
  // Related user data
  seller?: {
    userId: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    email: string;
  };
  anchor?: {
    userId: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    email: string;
  };
  fundedBy?: {
    userId: string;
    firstName: string;
    lastName: string;
    businessName?: string;
  };
}

export interface InvoiceMarketplaceResponse {
  invoiceId: string;
  amount: number;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  description: string;
  daysUntilDue: number;
  isOverdue: boolean;
  listedAt: Date;
  
  // Seller info (limited for marketplace)
  seller: {
    businessName?: string;
    firstName: string;
    lastName: string;
  };
  
  // Anchor info (trust indicator)
  anchor: {
    businessName?: string;
    firstName: string;
    lastName: string;
    userId: string; // For anchor verification
  };
  
  // Document preview
  invoicePreview?: {
    cloudinaryUrl: string;
    thumbnailUrl: string;
  };
  
  // Market indicators
  offerCount?: number;
  avgOfferRate?: number;
  timeOnMarket: number; // days since listed
}

export interface InvoiceListResponse {
  invoices: InvoiceBasicResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters?: {
    status?: InvoiceStatus[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    amountRange?: {
      min: number;
      max: number;
    };
    currency?: string;
    search?: string;
  };
}

export interface InvoiceAnalyticsResponse {
  summary: {
    totalInvoices: number;
    totalValue: number;
    averageAmount: number;
    currency: string;
  };
  
  statusBreakdown: Array<{
    status: InvoiceStatus;
    count: number;
    totalValue: number;
    percentage: number;
  }>;
  
  monthlyTrends: Array<{
    month: string;
    invoicesCreated: number;
    invoicesCompleted: number;
    totalValue: number;
    avgProcessingTime: number; // days
  }>;
  
  performance: {
    avgApprovalTime: number; // days
    avgFundingTime: number; // days
    successRate: number; // percentage
    overdueRate: number; // percentage
  };
}

// Search and filter interfaces

export interface InvoiceSearchFilters {
  status?: InvoiceStatus | InvoiceStatus[];
  sellerId?: string;
  anchorId?: string;
  fundedBy?: string;
  
  // Amount filters
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  
  // Date filters
  dateFrom?: Date;
  dateTo?: Date;
  dueDateFrom?: Date;
  dueDateTo?: Date;
  
  // Status date filters
  submittedFrom?: Date;
  submittedTo?: Date;
  approvedFrom?: Date;
  approvedTo?: Date;
  
  // Text search
  search?: string; // searches in description, invoice number
  
  // Sorting
  sortBy?: 'createdAt' | 'amount' | 'dueDate' | 'submittedAt' | 'approvedAt';
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  page?: number;
  limit?: number;
}

export interface MarketplaceFilters {
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  anchorId?: string;
  maxDaysUntilDue?: number;
  sortBy?: 'listedAt' | 'amount' | 'dueDate' | 'offerCount';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Audit and logging interfaces

export interface InvoiceAuditEntry {
  invoiceId: string;
  action: string;
  performedBy: string;
  performedAt: Date;
  oldData?: any;
  newData?: any;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

// File upload interfaces

export interface InvoiceFileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ProcessedInvoiceFile {
  filename: string;
  originalName: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  documentType: 'main_invoice' | 'supporting_document';
}

// Real-time update interfaces

export interface InvoiceStatusUpdate {
  type: 'status_change' | 'status_update' | 'document_uploaded' | 'offer_received' | 'funded' | 'repaid';
  invoiceId: string;
  oldStatus?: InvoiceStatus;
  newStatus?: InvoiceStatus;
  message?: string;
  timestamp: Date;
  metadata?: {
    offerId?: string;
    funderId?: string;
    fundedBy?: string;
    amount?: number;
    fundingAmount?: number;
    interestRate?: number;
    notes?: string;
    anchorId?: string;
    adminId?: string;
  };
}

export interface InvoiceNotification {
  recipientId: string;
  recipientRole: 'seller' | 'anchor' | 'lender' | 'admin';
  type: 'invoice_submitted' | 'invoice_approved' | 'invoice_rejected' | 'invoice_funded' | 'repayment_due';
  invoiceId: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  metadata?: any;
}