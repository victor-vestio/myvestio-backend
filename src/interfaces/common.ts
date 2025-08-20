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