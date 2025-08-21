export enum UserRole {
  SELLER = 'seller',
  LENDER = 'lender',
  ANCHOR = 'anchor',
  ADMIN = 'admin'
}

export enum BusinessType {
  INDIVIDUAL = 'individual',
  COMPANY = 'company'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export enum KYCStatus {
  NOT_SUBMITTED = 'not_submitted',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  INCOMPLETE = 'incomplete'
}

export enum DocumentType {
  // Common Documents
  GOVERNMENT_ID = 'government_id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  
  // Business Documents
  CAC = 'cac',
  TIN = 'tin',
  TAX_CLEARANCE = 'tax_clearance',
  SIGNATORY_LIST = 'signatory_list',
  BOARD_RESOLUTION = 'board_resolution',
  
  // Financial Documents
  AUDITED_FINANCIALS = 'audited_financials',
  BANK_STATEMENTS = 'bank_statements',
  
  // Additional
  DATE_OF_BIRTH_CERTIFICATE = 'date_of_birth_certificate'
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ANCHOR_APPROVED = 'anchor_approved',
  ADMIN_VERIFIED = 'admin_verified',
  LISTED = 'listed',
  FUNDED = 'funded',
  REPAID = 'repaid',
  SETTLED = 'settled',
  REJECTED = 'rejected'
}