import { Document } from 'mongoose';
import { OfferStatus, PaginationOptions } from './common';

// Main Offer interface
export interface IOffer extends Document {
  // Unique identifiers
  _id: string; // UUID with OFF- prefix
  invoiceId: string;
  lenderId: string;
  
  // Financial terms
  amount: number;
  interestRate: number; // Annual percentage
  fundingPercentage: number; // Percentage of invoice amount to fund
  tenure: number; // Days
  terms?: string;
  
  // Status and timestamps
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  
  // Action timestamps
  acceptedAt?: Date;
  rejectedAt?: Date;
  withdrawnAt?: Date;
  expiredAt?: Date;
  
  // Action reasons
  rejectionReason?: string;
  withdrawalReason?: string;
  
  // Competitive bidding
  isCounterOffer: boolean;
  originalOfferId?: string;
  counterOfferCount: number;
  
  // Financial calculations
  totalInterestAmount?: number;
  totalRepaymentAmount?: number;
  dailyInterestRate?: number;
  
  // Metadata
  lenderNotes?: string;
  acceptanceNotes?: string;
  
  // Virtual fields
  isExpired: boolean;
  timeUntilExpiry: number; // Minutes
  isActive: boolean;
  effectiveAnnualRate: number;
  
  // Instance methods
  canBeWithdrawn(): boolean;
  canBeAccepted(): boolean;
  canBeRejected(): boolean;
  calculateFinancials(invoiceAmount: number): OfferFinancialCalculation;
  expire(): Promise<IOffer>;
  withdraw(reason?: string): Promise<IOffer>;
  accept(notes?: string): Promise<IOffer>;
  reject(reason?: string): Promise<IOffer>;
}

// Financial calculation result
export interface OfferFinancialCalculation {
  fundingAmount: number;
  dailyInterestRate: number;
  totalInterestAmount: number;
  totalRepaymentAmount: number;
  netProfitForLender: number;
  effectiveAnnualRate: number;
}

// ============================================
// REQUEST INTERFACES
// ============================================

// Create offer request
export interface CreateOfferRequest {
  invoiceId: string;
  amount?: number; // Optional - can derive from invoice amount and percentage
  interestRate: number;
  fundingPercentage: number;
  tenure: number;
  terms?: string;
  lenderNotes?: string;
  expiresAt?: Date; // Optional - defaults to 48 hours
}

// Update offer request (for counter-offers)
export interface UpdateOfferRequest {
  interestRate?: number;
  fundingPercentage?: number;
  tenure?: number;
  terms?: string;
  lenderNotes?: string;
  expiresAt?: Date;
}

// Accept offer request
export interface AcceptOfferRequest {
  acceptanceNotes?: string;
}

// Reject offer request
export interface RejectOfferRequest {
  rejectionReason: string;
}

// Withdraw offer request
export interface WithdrawOfferRequest {
  withdrawalReason?: string;
}

// Create counter-offer request
export interface CreateCounterOfferRequest {
  originalOfferId: string;
  interestRate: number;
  fundingPercentage: number;
  tenure: number;
  terms?: string;
  lenderNotes?: string;
}

// ============================================
// RESPONSE INTERFACES
// ============================================

// Basic offer response
export interface OfferBasicResponse {
  offerId: string;
  lenderId: string;
  lenderBusinessName?: string;
  amount: number;
  interestRate: number;
  fundingPercentage: number;
  tenure: number;
  status: OfferStatus;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
  timeUntilExpiry: string;
  effectiveAnnualRate: number;
}

// Detailed offer response
export interface OfferDetailedResponse extends OfferBasicResponse {
  terms?: string;
  lenderNotes?: string;
  acceptanceNotes?: string;
  rejectionReason?: string;
  withdrawalReason?: string;
  
  // Timestamps
  updatedAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  withdrawnAt?: Date;
  expiredAt?: Date;
  
  // Financial details
  totalInterestAmount?: number;
  totalRepaymentAmount?: number;
  dailyInterestRate?: number;
  
  // Competitive bidding
  isCounterOffer: boolean;
  originalOfferId?: string;
  counterOfferCount: number;
  
  // Invoice details (populated)
  invoice?: {
    _id: string;
    amount: number;
    currency: string;
    dueDate: Date;
    description: string;
    sellerName: string;
    anchorName: string;
  };
  
  // Lender details (populated)
  lender?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    businessName?: string;
    businessType?: string;
  };
}

// Offer list response
export interface OfferListResponse {
  offers: OfferBasicResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOffers: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Competitive analysis response
export interface CompetitiveAnalysisResponse {
  totalOffers: number;
  statistics: {
    interestRate: {
      min: number;
      max: number;
      average: number;
    };
    amount: {
      min: number;
      max: number;
      average: number;
    };
    fundingPercentage: {
      average: number;
      max: number;
    };
  };
  bestOffers: OfferBasicResponse[];
  marketPosition?: {
    betterThanPercent: number;
    rank: number;
  };
}

// ============================================
// FILTER AND SEARCH INTERFACES
// ============================================

// Marketplace filters for lenders
export interface MarketplaceOfferFilters extends PaginationOptions {
  // Invoice filters
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  minDaysUntilDue?: number;
  maxDaysUntilDue?: number;
  anchorId?: string;
  
  // Offer filters
  minInterestRate?: number;
  maxInterestRate?: number;
  minFundingPercentage?: number;
  maxFundingPercentage?: number;
  minTenure?: number;
  maxTenure?: number;
  
  // Status filters
  status?: OfferStatus[];
  excludeMyOffers?: boolean; // For lenders browsing
  
  // Sorting options
  sortBy?: 'createdAt' | 'interestRate' | 'amount' | 'expiresAt' | 'effectiveAnnualRate';
  sortOrder?: 'asc' | 'desc';
}

// Seller offer filters
export interface SellerOfferFilters extends PaginationOptions {
  invoiceId?: string;
  status?: OfferStatus[];
  minInterestRate?: number;
  maxInterestRate?: number;
  minAmount?: number;
  maxAmount?: number;
  
  // Sorting options
  sortBy?: 'createdAt' | 'interestRate' | 'amount' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
}

// Lender portfolio filters
export interface LenderPortfolioFilters extends PaginationOptions {
  status?: OfferStatus[];
  invoiceStatus?: string[];
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: Date;
  dateTo?: Date;
  
  // Sorting options
  sortBy?: 'createdAt' | 'interestRate' | 'amount' | 'status' | 'expiresAt';
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// REAL-TIME INTERFACES
// ============================================

// Real-time offer update
export interface OfferRealtimeUpdate {
  type: 'offer_created' | 'offer_updated' | 'offer_accepted' | 'offer_rejected' | 'offer_withdrawn' | 'offer_expired';
  offerId: string;
  invoiceId: string;
  lenderId: string;
  sellerId?: string;
  timestamp: Date;
  data?: any;
}

// Real-time marketplace notification
export interface MarketplaceNotification {
  type: 'new_listing' | 'offer_received' | 'offer_accepted' | 'offer_rejected' | 'competitive_bid' | 'offer_expiring';
  userId: string; // Recipient
  invoiceId?: string;
  offerId?: string;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: any;
}

// WebSocket marketplace event
export interface MarketplaceWebSocketEvent {
  event: string;
  channel: string;
  data: OfferRealtimeUpdate | MarketplaceNotification | any;
  timestamp: Date;
}

// ============================================
// ANALYTICS INTERFACES
// ============================================

// Offer analytics for lenders
export interface LenderOfferAnalytics {
  totalOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  expiredOffers: number;
  acceptanceRate: number;
  
  averageInterestRate: number;
  averageFundingAmount: number;
  totalPotentialProfit: number;
  
  portfolioValue: number;
  activeOffersValue: number;
  
  // Performance metrics
  competitiveRank: number; // Rank among lenders
  marketShare: number; // Percentage of total marketplace volume
}

// Marketplace analytics for sellers
export interface SellerMarketplaceAnalytics {
  totalInvoicesListed: number;
  totalOffersReceived: number;
  averageOffersPerInvoice: number;
  
  averageInterestRateOffered: number;
  bestInterestRateReceived: number;
  totalFundingAvailable: number;
  
  averageTimeToFunding: number; // Hours
  marketplaceTrends: {
    popularFundingPercentages: number[];
    competitiveInterestRates: number[];
    averageTenure: number;
  };
}

// Marketplace overview analytics
export interface MarketplaceOverviewAnalytics {
  // Volume metrics
  totalActiveListings: number;
  totalActiveOffers: number;
  totalVolumeAvailable: number; // Sum of all listed invoices
  totalOfferVolume: number; // Sum of all pending offers
  
  // Market metrics
  averageInterestRate: number;
  averageFundingPercentage: number;
  averageTenure: number;
  
  // Activity metrics
  dailyNewOffers: number;
  dailyAcceptedOffers: number;
  averageTimeToFirstOffer: number; // Hours
  averageTimeToAcceptance: number; // Hours
  
  // Trending data
  trendingInvoices: Array<{
    invoiceId: string;
    viewCount: number;
    offerCount: number;
    bestRate: number;
  }>;
  
  topLenders: Array<{
    lenderId: string;
    lenderName: string;
    totalOffers: number;
    totalVolume: number;
    successRate: number;
    averageInterestRate: number;
  }>;
}