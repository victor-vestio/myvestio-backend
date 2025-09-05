import express from 'express';
import { MarketplaceController } from '../controllers/marketplaceController';
import { authenticate as auth } from '../middleware/auth';
import { requireRole, requireKYC } from '../middleware/roleAuth';
import { validateRequest } from '../middleware/validation';
import { 
  createOfferSchema,
  updateOfferSchema,
  acceptOfferSchema,
  rejectOfferSchema,
  withdrawOfferSchema,
  marketplaceFiltersSchema,
  sellerOfferFiltersSchema,
  lenderPortfolioFiltersSchema
} from '../utils/validators';
import { UserRole } from '../interfaces/common';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for marketplace operations
const marketplaceBrowsingLimit = rateLimit({
  windowMs: (parseInt(process.env.MARKETPLACE_BROWSING_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.MARKETPLACE_BROWSING_RATE_LIMIT_MAX_REQUESTS || '200'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many marketplace requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const offerActionLimit = rateLimit({
  windowMs: (parseInt(process.env.OFFER_ACTION_RATE_LIMIT_WINDOW_MINUTES || '15') * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.OFFER_ACTION_RATE_LIMIT_MAX_REQUESTS || '50'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many offer requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const offerCreationLimit = rateLimit({
  windowMs: (parseInt(process.env.OFFER_CREATION_RATE_LIMIT_WINDOW_HOURS || '1') * 60 * 60 * 1000),
  max: process.env.NODE_ENV === 'development' ? 0 : parseInt(process.env.OFFER_CREATION_RATE_LIMIT_MAX_REQUESTS || '20'),
  skip: process.env.NODE_ENV === 'development' ? () => true : undefined,
  message: {
    success: false,
    message: 'Too many offers created, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// LENDER ROUTES - MARKETPLACE BROWSING
// ============================================

/**
 * @route   GET /api/marketplace/browse
 * @desc    Browse marketplace for available invoices
 * @access  Private (Lender only)
 * @query   {MarketplaceOfferFilters} - Filtering and pagination options
 */
router.get(
  '/browse',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.LENDER),
  requireKYC,
  validateRequest(marketplaceFiltersSchema),
  MarketplaceController.browseMarketplace
);

/**
 * @route   GET /api/marketplace/invoices/:invoiceId
 * @desc    Get detailed invoice information for marketplace
 * @access  Private (Lender only)
 * @param   {string} invoiceId - Invoice UUID
 */
router.get(
  '/invoices/:invoiceId',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.LENDER),
  requireKYC,
  MarketplaceController.getMarketplaceInvoiceDetails
);

// ============================================
// LENDER ROUTES - OFFER MANAGEMENT
// ============================================

/**
 * @route   POST /api/marketplace/offers
 * @desc    Create new offer on an invoice
 * @access  Private (Lender only)
 * @body    {CreateOfferRequest} - Offer details
 */
router.post(
  '/offers',
  offerCreationLimit,
  auth,
  requireRole(UserRole.LENDER),
  requireKYC,
  validateRequest(createOfferSchema),
  MarketplaceController.createOffer
);

/**
 * @route   GET /api/marketplace/offers/portfolio
 * @desc    Get lender's offers portfolio
 * @access  Private (Lender only)
 * @query   {LenderPortfolioFilters} - Portfolio filtering options
 */
router.get(
  '/offers/portfolio',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.LENDER),
  requireKYC,
  validateRequest(lenderPortfolioFiltersSchema),
  MarketplaceController.getLenderOffers
);

/**
 * @route   PUT /api/marketplace/offers/:offerId/withdraw
 * @desc    Withdraw an offer
 * @access  Private (Lender only)
 * @param   {string} offerId - Offer UUID
 * @body    {WithdrawOfferRequest} - Withdrawal details
 */
router.put(
  '/offers/:offerId/withdraw',
  offerActionLimit,
  auth,
  requireRole(UserRole.LENDER),
  requireKYC,
  validateRequest(withdrawOfferSchema),
  MarketplaceController.withdrawOffer
);

// ============================================
// SELLER ROUTES - OFFER MANAGEMENT
// ============================================

/**
 * @route   GET /api/marketplace/seller/invoices/:invoiceId/offers
 * @desc    Get offers for seller's invoice
 * @access  Private (Seller only)
 * @param   {string} invoiceId - Invoice UUID
 * @query   {SellerOfferFilters} - Filtering options
 */
router.get(
  '/seller/invoices/:invoiceId/offers',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.SELLER),
  requireKYC,
  validateRequest(sellerOfferFiltersSchema),
  MarketplaceController.getInvoiceOffers
);

/**
 * @route   PUT /api/marketplace/seller/offers/:offerId/accept
 * @desc    Accept an offer (transitions invoice to FUNDED)
 * @access  Private (Seller only)
 * @param   {string} offerId - Offer UUID
 * @body    {AcceptOfferRequest} - Acceptance details
 */
router.put(
  '/seller/offers/:offerId/accept',
  offerActionLimit,
  auth,
  requireRole(UserRole.SELLER),
  requireKYC,
  validateRequest(acceptOfferSchema),
  MarketplaceController.acceptOffer
);

/**
 * @route   PUT /api/marketplace/seller/offers/:offerId/reject
 * @desc    Reject an offer
 * @access  Private (Seller only)
 * @param   {string} offerId - Offer UUID
 * @body    {RejectOfferRequest} - Rejection details
 */
router.put(
  '/seller/offers/:offerId/reject',
  offerActionLimit,
  auth,
  requireRole(UserRole.SELLER),
  requireKYC,
  validateRequest(rejectOfferSchema),
  MarketplaceController.rejectOffer
);

// ============================================
// ANALYTICS ROUTES
// ============================================

/**
 * @route   GET /api/marketplace/analytics/overview
 * @desc    Get marketplace overview analytics
 * @access  Private (Admin, Lender)
 */
router.get(
  '/analytics/overview',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.ADMIN, UserRole.LENDER),
  MarketplaceController.getMarketplaceOverview
);

/**
 * @route   GET /api/marketplace/analytics/competitive/:invoiceId
 * @desc    Get competitive analysis for an invoice
 * @access  Private (Lender, Seller, Admin)
 * @param   {string} invoiceId - Invoice UUID
 */
router.get(
  '/analytics/competitive/:invoiceId',
  marketplaceBrowsingLimit,
  auth,
  requireRole(UserRole.LENDER, UserRole.SELLER, UserRole.ADMIN),
  MarketplaceController.getCompetitiveAnalysis
);

// ============================================
// ADMIN ROUTES - MARKETPLACE MANAGEMENT
// ============================================

/**
 * @route   GET /api/marketplace/admin/overview
 * @desc    Get comprehensive marketplace overview for admin
 * @access  Private (Admin only)
 */
router.get(
  '/admin/overview',
  auth,
  requireRole(UserRole.ADMIN),
  MarketplaceController.getMarketplaceOverview
);

// ============================================
// HEALTH CHECK & METRICS
// ============================================

/**
 * @route   GET /api/marketplace/health
 * @desc    Marketplace health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Marketplace API is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;